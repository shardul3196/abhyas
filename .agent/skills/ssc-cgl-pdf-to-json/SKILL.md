---
name: ssc-cgl-pdf-to-json
description: Autonomously extract all questions from an attached SSC CGL PDF and build a complete, validated JSON exam file in batches of 25 without user intervention.
---

# SSC CGL Autonomous PDF-to-JSON Converter

When the user provides an SSC CGL PDF (or raw text) and asks to convert it into an exam JSON file, execute this workflow end-to-end autonomously without stopping between batches.

## Autonomous Execution Workflow (CRITICAL: Do Not Stop Between Batches!)
Generating 100 complete questions with step-by-step solutions and LaTeX in a single output exceeds model token limits. Therefore, **never attempt to output more than 25 questions in a single tool call, and NEVER pause to ask the user to say "Next" or "Continue" between batches.** Run the multi-step tool loop continuously until 100% of the questions in the PDF are written to disk:

1. **Inspect PDF & Initialize the Exam File:**
   - Determine question count and exam title (e.g., using `pymupdf` or `pypdf` text extraction or vision).
   - Initialize the target JSON:
     ```bash
     python scripts/json_builder.py init --output exams/<exam_slug>.json --title "<Exam Title>" --duration 60 --pos 2.0 --neg 0.5
     ```

2. **Loop Over the PDF in 25-Question Batches:**
   - **Turn 1 (Q1–Q25):** Extract Q1 to Q25, write `temp_batch.json`, and run:
     ```bash
     python scripts/json_builder.py append --output exams/<exam_slug>.json --batch temp_batch.json
     ```
   - **Turn 2 (Q26–Q50):** Immediately proceed to extract Q26 to Q50, write `temp_batch.json`, and run:
     ```bash
     python scripts/json_builder.py append --output exams/<exam_slug>.json --batch temp_batch.json
     ```
   - **Turn 3 (Q51–Q75):** Immediately proceed to extract Q51 to Q75, write `temp_batch.json`, and run:
     ```bash
     python scripts/json_builder.py append --output exams/<exam_slug>.json --batch temp_batch.json
     ```
   - **Turn 4 (Q76–Q100):** Immediately proceed to extract Q76 to Q100, write `temp_batch.json`, and run:
     ```bash
     python scripts/json_builder.py append --output exams/<exam_slug>.json --batch temp_batch.json
     ```
   *(If the PDF has more or fewer questions, adjust the number of loops until the last question in the PDF is reached).*

3. **Verify & Report:**
   Run the verification command:
   ```bash
   python scripts/json_builder.py verify --output exams/<exam_slug>.json
   ```
   Present the final verification summary to the user, highlighting section counts and any image diagram placeholders.

---

## Content & Formatting Rules for Every Question

1. **Strict Schema:** Every question object MUST contain:
   - `q_no` (int, 1-indexed, e.g. `1` to `100`)
   - `section` (Must be strictly one of: `"General Intelligence & Reasoning"`, `"General Awareness"`, `"Quantitative Aptitude"`, `"English Comprehension"`)
   - `topic` (e.g., `"Percentage"`, `"Geometry"`, `"Syllogism"`, `"Polity"`, `"Error Spotting"`, `"Algebra"`, `"History"`)
   - `sub_topic` (Specific concept string, or `null`)
   - `question_text` (Markdown + LaTeX string)
   - `image_path` (`"uploads/q_<q_no>.png"` if the question relies on a visual figure/diagram/non-tabular drawing; otherwise `null`)
   - `options` (Object with keys `"A"`, `"B"`, `"C"`, `"D"`)
   - `correct_option` (`"A"`, `"B"`, `"C"`, or `"D"`)
   - `explanation` (Detailed step-by-step Markdown + LaTeX explanation)

2. **LaTeX Escaping in JSON:**
   - Wrap all mathematical expressions, numbers with units, formulas, and symbols in `$inline$` or `$$display$$`.
   - **Double-escape backslashes** when writing JSON strings: `\\frac{a}{b}`, `\\sqrt{x}`, `\\times`, `\\theta`, `20\\%`, `\\text{CP}`.

3. **High-Yield Explanations:**
   - If the PDF contains solutions, reformat them into structured Markdown with LaTeX.
   - If the PDF only contains questions or an answer key, solve every question step-by-step.
   - For **Quantitative Aptitude** and **Reasoning**, always include the **Exam Shortcut / Ratio / Elimination Method** so students learn how to solve the problem in under 45 seconds.

4. **Data Interpretation Tables:**
   - Convert tables in Data Interpretation or Reasoning into clean **Markdown tables** inside `question_text`.
   - **Do NOT** flag standard tabular questions as images unless there are complex geometric drawings or non-textual figures.

5. **Bilingual PDFs:**
   - SSC CGL exam papers are often bilingual (English & Hindi).
   - Ignore the Hindi text; extract only the English version of questions and options (unless the question specifically tests Hindi language/translation).

---

## Batch Payload Template (`temp_batch.json`)

```json
[
  {
    "q_no": 1,
    "section": "General Intelligence & Reasoning",
    "topic": "Analogy",
    "sub_topic": "Number Analogy",
    "question_text": "Select the option that is related to the third number in the same way as the second number is related to the first number.\n\n$$12 : 156 :: 14 : ?$$",
    "image_path": null,
    "options": {
      "A": "210",
      "B": "196",
      "C": "182",
      "D": "224"
    },
    "correct_option": "A",
    "explanation": "Pattern: $n : n(n + 1)$\n\n- $12 \\times (12 + 1) = 12 \\times 13 = 156$\n- $14 \\times (14 + 1) = 14 \\times 15 = 210$\n\nHence, the correct option is **A**."
  }
]
```

---

## Helper Script Reference

The companion script `scripts/json_builder.py` provides three subcommands:

1. **Initialize File:**
   ```bash
   python scripts/json_builder.py init --output exams/<exam_slug>.json --title "<Exam Title>" --duration 60 --pos 2.0 --neg 0.5
   ```
2. **Append & Deduplicate Batch (Auto-deletes batch file on success):**
   ```bash
   python scripts/json_builder.py append --output exams/<exam_slug>.json --batch temp_batch.json
   ```
3. **Verify Complete Exam:**
   ```bash
   python scripts/json_builder.py verify --output exams/<exam_slug>.json
   ```
