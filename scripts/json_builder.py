#!/usr/bin/env python3
"""
scripts/json_builder.py

CLI tool to initialize, validate, append batches to, and verify SSC CGL JSON exam files.
Designed for autonomous multi-step LLM batch extraction workflows.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

try:
    from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
except ImportError:
    print(
        "ERROR: 'pydantic' is required by json_builder.py. Please install it with:\n"
        "    pip install pydantic",
        file=sys.stderr,
    )
    sys.exit(1)

VALID_SECTIONS = [
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
]

SectionType = Literal[
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
]

OptionLetter = Literal["A", "B", "C", "D"]


class QuestionSchema(BaseModel):
    q_no: int = Field(..., ge=1, description="1-indexed question number")
    section: SectionType
    topic: str = Field(..., min_length=1, description="Question topic / category")
    sub_topic: Optional[str] = Field(default=None, description="Specific sub-concept or null")
    question_text: str = Field(..., min_length=1, description="Question statement (Markdown + LaTeX)")
    image_path: Optional[str] = Field(default=None, description="Relative image path or null")
    options: Dict[str, str] = Field(..., description="Options dictionary with keys A, B, C, D")
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_option: OptionLetter = Field(..., description="Correct option key ('A', 'B', 'C', or 'D')")
    explanation: str = Field(..., min_length=1, description="Step-by-step solution / explanation")
    is_bookmarked: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # 1. Normalize section names if minor casing / whitespace variation
        sec = data.get("section")
        if isinstance(sec, str):
            clean_sec = sec.strip()
            for valid_sec in VALID_SECTIONS:
                if clean_sec.lower() == valid_sec.lower():
                    data["section"] = valid_sec
                    break

        # 2. Extract options dictionary and flat option_a..d
        raw_options = data.get("options")
        if not isinstance(raw_options, dict):
            raw_options = {}

        opts: Dict[str, str] = {}
        for letter in ["A", "B", "C", "D"]:
            val = raw_options.get(letter) or raw_options.get(letter.lower())
            if val is None:
                val = data.get(f"option_{letter.lower()}")
            if val is not None:
                val = str(val).strip()
            opts[letter] = val or ""

        data["options"] = opts
        data["option_a"] = opts["A"]
        data["option_b"] = opts["B"]
        data["option_c"] = opts["C"]
        data["option_d"] = opts["D"]

        # 3. Normalize correct_option
        corr = data.get("correct_option")
        if isinstance(corr, str):
            data["correct_option"] = corr.strip().upper()

        # 4. Normalize sub_topic & image_path
        sub = data.get("sub_topic")
        if isinstance(sub, str) and not sub.strip():
            data["sub_topic"] = None

        img = data.get("image_path")
        if isinstance(img, str) and not img.strip():
            data["image_path"] = None

        return data

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Dict[str, str]) -> Dict[str, str]:
        for letter in ["A", "B", "C", "D"]:
            if letter not in v or not str(v[letter]).strip():
                raise ValueError(f"Option '{letter}' cannot be empty or missing.")
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Returns standard normalized dictionary representation."""
        return {
            "q_no": self.q_no,
            "section": self.section,
            "topic": self.topic.strip(),
            "sub_topic": self.sub_topic.strip() if self.sub_topic else None,
            "question_text": self.question_text.strip(),
            "image_path": self.image_path.strip() if self.image_path else None,
            "options": {
                "A": self.options["A"],
                "B": self.options["B"],
                "C": self.options["C"],
                "D": self.options["D"],
            },
            "option_a": self.options["A"],
            "option_b": self.options["B"],
            "option_c": self.options["C"],
            "option_d": self.options["D"],
            "correct_option": self.correct_option,
            "explanation": self.explanation.strip(),
            "is_bookmarked": self.is_bookmarked,
        }


# --- CLI Handlers ---


def handle_init(args: argparse.Namespace) -> int:
    target_path = Path(args.output or args.file)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    exam_title = args.title or "SSC CGL Tier-1 Exam"
    duration = int(args.duration)
    positive_marks = float(args.pos)
    negative_marks = float(args.neg)

    base_payload = {
        "exam_title": exam_title,
        "duration_minutes": duration,
        "positive_marks": positive_marks,
        "negative_marks": negative_marks,
        "questions": [],
    }

    if target_path.exists() and not args.force:
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            existing_count = len(existing.get("questions", []))
            if existing_count > 0:
                print(
                    f"WARNING: '{target_path}' already exists with {existing_count} questions. "
                    f"Use --force to re-initialize.",
                    file=sys.stderr,
                )
                return 1
        except Exception:
            pass

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(base_payload, f, indent=2, ensure_ascii=False)

    print(f"Initialized exam template at '{target_path}' with 0 questions.")
    print(f"Title: {exam_title} | Duration: {duration} mins | Marking: +{positive_marks} / -{negative_marks}")
    return 0


def handle_append(args: argparse.Namespace) -> int:
    target_path = Path(args.output or args.file)
    batch_path = Path(args.batch)

    if not target_path.exists():
        print(
            f"ERROR: Target file '{target_path}' does not exist. Initialize it first using 'init'.",
            file=sys.stderr,
        )
        return 1

    if not batch_path.exists():
        print(f"ERROR: Batch file '{batch_path}' does not exist.", file=sys.stderr)
        return 1

    # Load Target Exam
    try:
        with open(target_path, "r", encoding="utf-8-sig") as f:
            exam_data = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to read target JSON '{target_path}': {e}", file=sys.stderr)
        return 1

    if "questions" not in exam_data or not isinstance(exam_data["questions"], list):
        exam_data["questions"] = []

    # Load Batch Data
    try:
        with open(batch_path, "r", encoding="utf-8-sig") as f:
            batch_raw = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to parse batch JSON '{batch_path}': {e}", file=sys.stderr)
        return 1

    if isinstance(batch_raw, dict) and "questions" in batch_raw:
        raw_list = batch_raw["questions"]
    elif isinstance(batch_raw, list):
        raw_list = batch_raw
    else:
        print(
            f"ERROR: Batch file must contain a JSON list or an object with a 'questions' key.",
            file=sys.stderr,
        )
        return 1

    if not raw_list:
        print(f"WARNING: Batch file '{batch_path}' contains 0 questions. Nothing to append.")
        try:
            batch_path.unlink()
        except Exception:
            pass
        return 0

    # Validate Each Question in Batch
    validation_errors: List[str] = []
    validated_questions: List[Dict[str, Any]] = []

    for i, item in enumerate(raw_list):
        q_label = f"Item #{i + 1}"
        if isinstance(item, dict) and "q_no" in item:
            q_label = f"Q{item['q_no']}"

        if not isinstance(item, dict):
            validation_errors.append(f"{q_label}: Question payload must be a JSON object.")
            continue

        try:
            q_model = QuestionSchema(**item)
            validated_questions.append(q_model.to_dict())
        except ValidationError as ve:
            for err in ve.errors():
                loc = ".".join(str(l) for l in err["loc"])
                validation_errors.append(f"{q_label} [{loc}]: {err['msg']}")
        except Exception as exc:
            validation_errors.append(f"{q_label}: Unexpected validation error: {exc}")

    if validation_errors:
        print(f"ERROR: Validation failed for batch '{batch_path}' with {len(validation_errors)} error(s):", file=sys.stderr)
        for err in validation_errors:
            print(f"  - {err}", file=sys.stderr)
        print("Note: The temporary batch file was retained for correction.", file=sys.stderr)
        return 1

    # Merge into Master (Deduplicate by q_no)
    existing_map: Dict[int, Dict[str, Any]] = {
        q["q_no"]: q for q in exam_data["questions"] if isinstance(q, dict) and "q_no" in q
    }

    updated_count = 0
    added_count = 0
    for q in validated_questions:
        q_no = q["q_no"]
        if q_no in existing_map:
            updated_count += 1
        else:
            added_count += 1
        existing_map[q_no] = q

    # Sort questions by q_no
    sorted_questions = sorted(existing_map.values(), key=lambda x: x["q_no"])
    exam_data["questions"] = sorted_questions

    # Write back to target file
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(exam_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"ERROR: Failed writing updated exam to '{target_path}': {e}", file=sys.stderr)
        return 1

    # Remove temporary batch file on success
    try:
        batch_path.unlink()
        batch_deleted = True
    except Exception as e:
        batch_deleted = False
        print(f"WARNING: Could not delete batch file '{batch_path}': {e}", file=sys.stderr)

    total_now = len(sorted_questions)
    min_q = sorted_questions[0]["q_no"] if sorted_questions else 0
    max_q = sorted_questions[-1]["q_no"] if sorted_questions else 0

    print(
        f"Successfully appended {len(validated_questions)} questions ({added_count} new, {updated_count} overwritten).\n"
        f"Master file '{target_path}' now has {total_now} questions (Q{min_q}..Q{max_q})."
    )
    if batch_deleted:
        print(f"Deleted batch file '{batch_path}'.")

    return 0


def handle_verify(args: argparse.Namespace) -> int:
    target_path = Path(args.output or args.file)
    expected_count = int(args.expected_count) if args.expected_count is not None else 100

    if not target_path.exists():
        print(f"ERROR: Exam file '{target_path}' does not exist.", file=sys.stderr)
        return 1

    try:
        with open(target_path, "r", encoding="utf-8-sig") as f:
            exam_data = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to read exam JSON '{target_path}': {e}", file=sys.stderr)
        return 1

    title = exam_data.get("exam_title") or exam_data.get("title") or "Untitled"
    duration = exam_data.get("duration_minutes", 60)
    pos_marks = exam_data.get("positive_marks", 2.0)
    neg_marks = exam_data.get("negative_marks", 0.5)
    questions = exam_data.get("questions", [])

    if not isinstance(questions, list):
        print(f"ERROR: 'questions' field is not a list.", file=sys.stderr)
        return 1

    total_questions = len(questions)

    # Sequence and Duplicate checks
    q_nos = [q.get("q_no") for q in questions if isinstance(q, dict) and "q_no" in q]
    q_counter = Counter(q_nos)
    duplicates = [q for q, count in q_counter.items() if count > 1]

    # Section breakdown
    section_counter: Counter = Counter()
    topic_counter: Dict[str, Counter] = {}
    image_questions: List[int] = []
    missing_explanation: List[int] = []

    for q in questions:
        q_num = q.get("q_no")
        sec = q.get("section", "Unknown")
        section_counter[sec] += 1

        top = q.get("topic", "Uncategorized")
        if sec not in topic_counter:
            topic_counter[sec] = Counter()
        topic_counter[sec][top] += 1

        img = q.get("image_path")
        if img and str(img).strip():
            image_questions.append(q_num)

        expl = q.get("explanation")
        if not expl or not str(expl).strip():
            missing_explanation.append(q_num)

    # Missing sequence numbers in expected 1..expected_count
    present_set = set(q_nos)
    expected_set = set(range(1, expected_count + 1))
    missing_q_nos = sorted(list(expected_set - present_set))

    # Print Summary Report
    print("=" * 60)
    print(f"SSC CGL EXAM VERIFICATION REPORT: {title}")
    print("=" * 60)
    print(f"File Path        : {target_path}")
    print(f"Total Questions  : {total_questions} / {expected_count}")
    print(f"Duration         : {duration} minutes")
    print(f"Marking Scheme   : +{pos_marks} / -{neg_marks}")
    print("-" * 60)

    print("Breakdown by Section:")
    for valid_sec in VALID_SECTIONS:
        cnt = section_counter.get(valid_sec, 0)
        status = "OK" if cnt == 25 else f"Notice ({cnt}/25)"
        print(f"  - {valid_sec:<36}: {cnt:>2} questions [{status}]")

    other_sections = [s for s in section_counter if s not in VALID_SECTIONS]
    if other_sections:
        print("  Other Sections:")
        for s in other_sections:
            print(f"  - {s:<36}: {section_counter[s]:>2} questions [NON-STANDARD]")

    print("-" * 60)
    print("Topic Coverage:")
    for sec, t_cnt in topic_counter.items():
        topics_str = ", ".join([f"{t} ({c})" for t, c in t_cnt.most_common()])
        print(f"  * {sec}: {topics_str}")

    print("-" * 60)
    # Check Issues
    has_issues = False

    if duplicates:
        has_issues = True
        print(f"[!] DUPLICATE QUESTION NUMBERS FOUND: {duplicates}")

    if missing_q_nos:
        has_issues = True
        print(f"[!] MISSING QUESTION NUMBERS (1..{expected_count}): {missing_q_nos}")

    if missing_explanation:
        has_issues = True
        print(f"[!] QUESTIONS MISSING EXPLANATION: {missing_explanation}")

    if image_questions:
        print(f"[*] QUESTIONS REQUIRING DIAGRAM SCREENSHOTS ({len(image_questions)}):")
        print(f"    Q numbers: {image_questions}")
        # Check if files exist locally
        missing_images = []
        for q_num in image_questions:
            q_match = next((q for q in questions if q.get("q_no") == q_num), None)
            if q_match and q_match.get("image_path"):
                img_p = Path(q_match["image_path"].lstrip("/"))
                if not img_p.exists():
                    missing_images.append((q_num, str(q_match["image_path"])))
        if missing_images:
            print("    Pending screenshot files not yet found on disk:")
            for q_num, path_str in missing_images:
                print(f"      - Q{q_num}: {path_str}")
        else:
            print("    All referenced image files exist on disk.")
    else:
        print("[*] No questions require visual diagram screenshots.")

    print("=" * 60)

    if total_questions == expected_count and not has_issues:
        print("RESULT: PASS - Exam JSON is 100% complete, sequenced, and validated.")
        return 0
    elif has_issues:
        print(f"RESULT: FAIL - Found issues (Total: {total_questions}/{expected_count}). Review above.")
        return 1
    else:
        print(f"RESULT: INCOMPLETE - Progress: {total_questions}/{expected_count} questions.")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Helper script to initialize, batch-append, and verify SSC CGL JSON exam files."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: init
    init_parser = subparsers.add_parser("init", help="Initialize a new empty exam JSON file.")
    init_parser.add_argument("--output", "-o", help="Target output JSON path.")
    init_parser.add_argument("--file", "-f", help="Alias for --output.")
    init_parser.add_argument("--title", "-t", default="SSC CGL Tier-1 Mock Exam", help="Exam title.")
    init_parser.add_argument("--duration", "-d", type=int, default=60, help="Exam duration in minutes.")
    init_parser.add_argument("--pos", "-p", type=float, default=2.0, help="Positive marks per question.")
    init_parser.add_argument("--neg", "-n", type=float, default=0.5, help="Negative marks penalty.")
    init_parser.add_argument("--force", action="store_true", help="Force overwrite existing file.")

    # Subcommand: append
    append_parser = subparsers.add_parser("append", help="Validate and append a batch of questions.")
    append_parser.add_argument("--output", "-o", help="Master exam JSON path.")
    append_parser.add_argument("--file", "-f", help="Alias for --output.")
    append_parser.add_argument("--batch", "-b", required=True, help="Path to batch JSON file.")

    # Subcommand: verify
    verify_parser = subparsers.add_parser("verify", help="Verify completeness and validity of exam JSON.")
    verify_parser.add_argument("--output", "-o", help="Target exam JSON path.")
    verify_parser.add_argument("--file", "-f", help="Alias for --output.")
    verify_parser.add_argument(
        "--expected-count", "-c", type=int, default=100, help="Expected question count (default: 100)."
    )

    args = parser.parse_args()

    # Validate output/file argument
    if args.command in ("init", "append", "verify"):
        if not (args.output or args.file):
            parser.error(f"Command '{args.command}' requires --output or --file.")

    if args.command == "init":
        sys.exit(handle_init(args))
    elif args.command == "append":
        sys.exit(handle_append(args))
    elif args.command == "verify":
        sys.exit(handle_verify(args))


if __name__ == "__main__":
    main()
