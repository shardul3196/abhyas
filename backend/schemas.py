from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class ValidationSummary(BaseModel):
    exam_title: Optional[str] = None
    duration_minutes: Optional[int] = None
    positive_marks: Optional[float] = None
    negative_marks: Optional[float] = None
    question_count: int = 0
    sections: Dict[str, int] = Field(default_factory=dict)
    topics: List[str] = Field(default_factory=list)


class ExamValidateResponse(BaseModel):
    valid: bool
    errors: List[str]
    summary: ValidationSummary


class QuestionRead(BaseModel):
    id: int
    exam_id: int
    q_no: int
    section: str
    topic: str
    sub_topic: Optional[str] = None
    question_text: str
    image_path: Optional[str] = None
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str
    is_bookmarked: bool


class ExamListItem(BaseModel):
    id: int
    title: str
    duration_minutes: int
    positive_marks: float
    negative_marks: float
    created_at: datetime
    question_count: int
    sections: List[str]
    attempt_count: int
    completed_attempt_count: int
    highest_score: Optional[float] = None
    active_attempt_id: Optional[int] = None


class ExamDetailResponse(BaseModel):
    id: int
    title: str
    duration_minutes: int
    positive_marks: float
    negative_marks: float
    created_at: datetime
    question_count: int
    sections: List[str]
    questions: List[QuestionRead]


class ExamUploadResponse(BaseModel):
    valid: bool = True
    exam_id: int
    title: str
    question_count: int
    summary: ValidationSummary


class BookmarkToggleResponse(BaseModel):
    id: int
    question_id: int
    is_bookmarked: bool


class BookmarkedQuestionItem(BaseModel):
    id: int
    exam_id: int
    exam_title: str
    q_no: int
    section: str
    topic: str
    sub_topic: Optional[str] = None
    question_text: str
    image_path: Optional[str] = None
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str
    is_bookmarked: bool


class CheckpointResponse(BaseModel):
    status: str
    db_size_bytes: int
    timestamp: str
    wal_checkpoint_result: Optional[List[int]] = None


class ImageUploadResponse(BaseModel):
    filename: str
    image_path: str
    url: str
    size_bytes: int


# --- Phase 2: Attempt Lifecycle & Scoring Schemas ---

VALID_PALETTE_STATUSES = {
    "not_visited",
    "not_answered",
    "answered",
    "marked_for_review",
    "answered_and_marked",
}


class AttemptStartRequest(BaseModel):
    exam_id: Optional[int] = None
    force_new: bool = False


class AttemptResponseRead(BaseModel):
    id: int
    attempt_id: int
    question_id: int
    q_no: int
    selected_option: Optional[str] = None
    palette_status: str
    time_spent_sec: int
    is_correct: Optional[bool] = None


class AttemptQuestionItem(BaseModel):
    id: int
    question_id: int
    exam_id: int
    q_no: int
    section: str
    topic: str
    sub_topic: Optional[str] = None
    question_text: str
    image_path: Optional[str] = None
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    is_bookmarked: bool
    correct_option: Optional[str] = None
    explanation: Optional[str] = None
    response_id: int
    selected_option: Optional[str] = None
    palette_status: str
    time_spent_sec: int
    is_correct: Optional[bool] = None
    response: AttemptResponseRead


class AttemptExamMetadata(BaseModel):
    id: int
    title: str
    duration_minutes: int
    positive_marks: float
    negative_marks: float
    question_count: int
    sections: List[str]


class AttemptStateResponse(BaseModel):
    id: int
    attempt_id: int
    exam_id: int
    status: str
    resumed: bool = False
    started_at: datetime
    submitted_at: Optional[datetime] = None
    remaining_seconds: int
    total_time_spent_sec: int
    total_score: float
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    exam: AttemptExamMetadata
    questions: List[AttemptQuestionItem]
    responses: List[AttemptResponseRead]


class AttemptResponsePatchRequest(BaseModel):
    question_id: int
    selected_option: Optional[str] = None
    palette_status: str
    delta_time_spent_sec: int = 0
    remaining_seconds: Optional[int] = None


class AttemptResponsePatchResult(BaseModel):
    attempt_id: int
    question_id: int
    q_no: int
    response_id: int
    selected_option: Optional[str] = None
    palette_status: str
    time_spent_sec: int
    remaining_seconds: int
    total_time_spent_sec: int


class AttemptSubmitRequest(BaseModel):
    remaining_seconds: Optional[int] = None


class AttemptSubmitResponse(BaseModel):
    id: int
    attempt_id: int
    exam_id: int
    exam_title: str
    status: str
    started_at: datetime
    submitted_at: datetime
    remaining_seconds: int
    total_time_spent_sec: int
    question_count: int
    attempted_count: int
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    raw_positive_score: float
    negative_penalty: float
    total_score: float
    max_score: float
    accuracy_pct: float


class ExamAttemptHistoryItem(BaseModel):
    id: int
    attempt_id: int
    exam_id: int
    exam_title: str
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    remaining_seconds: int
    total_time_spent_sec: int
    question_count: int
    attempted_count: int
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    total_score: float
    max_score: float
    accuracy_pct: float


# --- Phase 2: Deep Analytics & Action Matrix Schemas ---


class BentoSummaryMetrics(BaseModel):
    attempt_id: int
    exam_id: int
    exam_title: str
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    duration_minutes: int
    positive_marks: float
    negative_marks: float
    total_questions: int
    attempted_count: int
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    raw_positive_score: float
    negative_penalty: float
    total_score: float
    max_score: float
    score_pct: float
    accuracy_pct: float
    attempt_rate_pct: float
    total_time_spent_sec: int
    remaining_seconds: int
    avg_time_per_question_sec: float
    avg_time_per_attempted_sec: float
    slow_threshold_sec: float


class SectionalBreakdownItem(BaseModel):
    section: str
    total_questions: int
    attempted: int
    correct: int
    incorrect: int
    unattempted: int
    positive_score: float
    negative_penalty: float
    score: float
    max_score: float
    accuracy_pct: float
    time_spent_sec: int
    avg_time_sec: float


class TopicMatrixItem(BaseModel):
    topic: str
    section: str
    sub_topics: List[str] = Field(default_factory=list)
    total_questions: int
    attempted: int
    correct: int
    incorrect: int
    unattempted: int
    score: float
    max_score: float
    accuracy_pct: float
    total_time_sec: int
    avg_time_sec: float
    bucket: str  # "concept_gap" | "silly_mistakes" | "needs_speed" | "strong_zone"
    bucket_label: str
    recommendation: str


class TopicActionMatrixBuckets(BaseModel):
    concept_gap: List[TopicMatrixItem] = Field(default_factory=list)
    silly_mistakes: List[TopicMatrixItem] = Field(default_factory=list)
    needs_speed: List[TopicMatrixItem] = Field(default_factory=list)
    strong_zone: List[TopicMatrixItem] = Field(default_factory=list)


class TopicActionMatrix(BaseModel):
    buckets: TopicActionMatrixBuckets
    topics: List[TopicMatrixItem] = Field(default_factory=list)


class QuestionReviewItem(BaseModel):
    id: int
    question_id: int
    response_id: Optional[int] = None
    q_no: int
    section: str
    topic: str
    sub_topic: Optional[str] = None
    question_text: str
    image_path: Optional[str] = None
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    selected_option: Optional[str] = None
    correct_option: str
    explanation: str
    palette_status: str
    is_evaluated: bool
    is_correct: Optional[bool] = None
    result_status: str  # "correct" | "incorrect" | "unattempted"
    marks_awarded: float
    time_spent_sec: int
    avg_question_time_sec: float
    is_slow: bool
    is_over_90s: bool
    is_bookmarked: bool


class AttemptAnalysisResponse(BaseModel):
    summary: BentoSummaryMetrics
    sectional_breakdown: List[SectionalBreakdownItem]
    action_matrix: TopicActionMatrix
    questions: List[QuestionReviewItem]


class GlobalOverviewSummary(BaseModel):
    total_completed_attempts: int
    total_exams_attempted: int
    total_questions_seen: int
    total_attempted: int
    total_correct: int
    total_incorrect: int
    total_unattempted: int
    overall_accuracy_pct: float
    average_score: float
    highest_score: Optional[float] = None
    total_time_spent_sec: int
    avg_time_per_question_sec: float


class ScoreTrendPoint(BaseModel):
    attempt_id: int
    attempt_number: int
    exam_id: int
    exam_title: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    date_label: str
    total_score: float
    max_score: float
    score_pct: float
    accuracy_pct: float
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    total_time_spent_sec: int


class GlobalAnalyticsOverviewResponse(BaseModel):
    overall_summary: GlobalOverviewSummary
    score_trend: List[ScoreTrendPoint]
    sectional_breakdown: List[SectionalBreakdownItem]
    action_matrix: TopicActionMatrix
    top_weak_topics: List[TopicMatrixItem]
    top_slow_topics: List[TopicMatrixItem]


VALID_CORRECT_OPTIONS = {"A", "B", "C", "D"}


def _is_non_empty_str(val: Any) -> bool:
    return isinstance(val, str) and len(val.strip()) > 0


def validate_exam_payload(payload: Any) -> Tuple[bool, List[str], ValidationSummary, Optional[Dict[str, Any]]]:
    """
    Inspects incoming raw JSON payload against the expected SSC CGL exam schema.
    Collects ALL top-level and question-level errors in human-readable format
    pinpointing the exact question number/index.
    Returns (is_valid, errors, summary, normalized_payload).
    """
    errors: List[str] = []
    summary = ValidationSummary()

    if not isinstance(payload, dict):
        errors.append("Root JSON payload must be an object (dictionary).")
        return False, errors, summary, None

    # 1. Validate Exam Title (supports 'exam_title' or 'title')
    raw_title = payload.get("exam_title") if "exam_title" in payload else payload.get("title")
    if raw_title is None:
        errors.append("Exam metadata: missing required field 'exam_title'.")
    elif not _is_non_empty_str(raw_title):
        errors.append("Exam metadata: 'exam_title' must be a non-empty string.")
    else:
        summary.exam_title = raw_title.strip()

    # 2. Validate duration_minutes (default 60 if omitted, else must be positive int)
    raw_duration = payload.get("duration_minutes", 60)
    if isinstance(raw_duration, bool) or not isinstance(raw_duration, int) or raw_duration <= 0:
        errors.append("Exam metadata: 'duration_minutes' must be a positive integer.")
    else:
        summary.duration_minutes = raw_duration

    # 3. Validate positive_marks (default 2.0 if omitted, else must be > 0)
    raw_pos = payload.get("positive_marks", 2.0)
    if isinstance(raw_pos, bool) or not isinstance(raw_pos, (int, float)) or float(raw_pos) <= 0:
        errors.append("Exam metadata: 'positive_marks' must be a positive number.")
    else:
        summary.positive_marks = float(raw_pos)

    # 4. Validate negative_marks (default 0.5 if omitted, else must be >= 0)
    raw_neg = payload.get("negative_marks", 0.5)
    if isinstance(raw_neg, bool) or not isinstance(raw_neg, (int, float)) or float(raw_neg) < 0:
        errors.append("Exam metadata: 'negative_marks' must be a non-negative number.")
    else:
        summary.negative_marks = float(raw_neg)

    # 5. Validate questions list
    raw_questions = payload.get("questions")
    if raw_questions is None:
        errors.append("Exam metadata: missing required field 'questions'.")
        return False, errors, summary, None
    if not isinstance(raw_questions, list):
        errors.append("Exam metadata: 'questions' must be a list of question objects.")
        return False, errors, summary, None
    if len(raw_questions) == 0:
        errors.append("Exam metadata: 'questions' list cannot be empty (at least 1 question is required).")
        return False, errors, summary, None

    normalized_questions: List[Dict[str, Any]] = []
    sections_counter: Dict[str, int] = {}
    topics_seen: List[str] = []
    seen_q_nos = set()

    for idx, q in enumerate(raw_questions, start=1):
        if not isinstance(q, dict):
            errors.append(f"Question #{idx}: question entry must be a JSON object.")
            continue

        # Determine display question number and normalized q_no
        raw_q_no = q.get("q_no", idx)
        if isinstance(raw_q_no, bool) or not isinstance(raw_q_no, int) or raw_q_no <= 0:
            q_label = f"Question #{idx}"
            errors.append(f"{q_label}: 'q_no' must be a positive integer.")
            q_no = idx
        else:
            q_no = raw_q_no
            q_label = f"Question #{q_no}"
            if q_no in seen_q_nos:
                errors.append(f"{q_label} (at index {idx}): duplicate 'q_no' {q_no}.")
            seen_q_nos.add(q_no)

        # Required string fields check
        # section
        if "section" not in q or q.get("section") is None:
            errors.append(f"{q_label}: missing 'section' field")
            section_val = ""
        elif not _is_non_empty_str(q.get("section")):
            errors.append(f"{q_label}: 'section' cannot be empty")
            section_val = ""
        else:
            section_val = q["section"].strip()
            sections_counter[section_val] = sections_counter.get(section_val, 0) + 1

        # topic
        if "topic" not in q or q.get("topic") is None:
            errors.append(f"{q_label}: missing 'topic' tag")
            topic_val = ""
        elif not _is_non_empty_str(q.get("topic")):
            errors.append(f"{q_label}: 'topic' cannot be empty")
            topic_val = ""
        else:
            topic_val = q["topic"].strip()
            if topic_val not in topics_seen:
                topics_seen.append(topic_val)

        # sub_topic (optional)
        raw_sub_topic = q.get("sub_topic")
        sub_topic_val: Optional[str] = None
        if raw_sub_topic is not None:
            if not isinstance(raw_sub_topic, str):
                errors.append(f"{q_label}: 'sub_topic' must be a string or null")
            else:
                sub_topic_val = raw_sub_topic.strip() or None

        # question_text
        if "question_text" not in q or q.get("question_text") is None:
            errors.append(f"{q_label}: missing 'question_text' field")
            q_text_val = ""
        elif not _is_non_empty_str(q.get("question_text")):
            errors.append(f"{q_label}: 'question_text' cannot be empty")
            q_text_val = ""
        else:
            q_text_val = q["question_text"].strip()

        # image_path (optional)
        raw_image_path = q.get("image_path")
        image_path_val: Optional[str] = None
        if raw_image_path is not None:
            if not isinstance(raw_image_path, str):
                errors.append(f"{q_label}: 'image_path' must be a string or null")
            else:
                image_path_val = raw_image_path.strip() or None

        # Options: support either flat option_a..option_d OR nested options: {A, B, C, D}
        nested_opts = q.get("options") if isinstance(q.get("options"), dict) else {}
        option_vals: Dict[str, str] = {}
        for opt_letter, opt_key in [("A", "option_a"), ("B", "option_b"), ("C", "option_c"), ("D", "option_d")]:
            raw_opt = q.get(opt_key)
            if raw_opt is None and nested_opts:
                raw_opt = nested_opts.get(opt_letter) or nested_opts.get(opt_letter.lower())
            if raw_opt is None:
                errors.append(f"{q_label}: missing '{opt_key}' field")
                option_vals[opt_key] = ""
            elif not _is_non_empty_str(raw_opt):
                errors.append(f"{q_label}: '{opt_key}' cannot be empty")
                option_vals[opt_key] = ""
            else:
                option_vals[opt_key] = raw_opt.strip()

        # correct_option
        raw_correct = q.get("correct_option")
        if raw_correct is None:
            errors.append(f"{q_label}: missing 'correct_option' field")
            correct_val = ""
        elif not isinstance(raw_correct, str) or raw_correct.strip().upper() not in VALID_CORRECT_OPTIONS:
            errors.append(f"{q_label}: 'correct_option' must be one of A, B, C, D")
            correct_val = ""
        else:
            correct_val = raw_correct.strip().upper()

        # explanation
        if "explanation" not in q or q.get("explanation") is None:
            errors.append(f"{q_label}: missing 'explanation' field")
            explanation_val = ""
        elif not _is_non_empty_str(q.get("explanation")):
            errors.append(f"{q_label}: 'explanation' cannot be empty")
            explanation_val = ""
        else:
            explanation_val = q["explanation"].strip()

        # is_bookmarked (optional bool)
        raw_bookmarked = q.get("is_bookmarked", False)
        is_bookmarked_val = bool(raw_bookmarked) if isinstance(raw_bookmarked, bool) else False

        normalized_questions.append(
            {
                "q_no": q_no,
                "section": section_val,
                "topic": topic_val,
                "sub_topic": sub_topic_val,
                "question_text": q_text_val,
                "image_path": image_path_val,
                "option_a": option_vals["option_a"],
                "option_b": option_vals["option_b"],
                "option_c": option_vals["option_c"],
                "option_d": option_vals["option_d"],
                "correct_option": correct_val,
                "explanation": explanation_val,
                "is_bookmarked": is_bookmarked_val,
            }
        )

    summary.question_count = len(normalized_questions)
    summary.sections = sections_counter
    summary.topics = topics_seen

    is_valid = len(errors) == 0
    normalized_payload = (
        {
            "title": summary.exam_title,
            "duration_minutes": summary.duration_minutes,
            "positive_marks": summary.positive_marks,
            "negative_marks": summary.negative_marks,
            "questions": sorted(normalized_questions, key=lambda x: x["q_no"]),
        }
        if is_valid
        else None
    )

    return is_valid, errors, summary, normalized_payload
