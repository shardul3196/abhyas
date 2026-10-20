import json
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import Attempt, Exam, Question
    from backend.schemas import (
        ExamDetailResponse,
        ExamListItem,
        ExamUploadResponse,
        ExamValidateResponse,
        QuestionRead,
        ValidationSummary,
        validate_exam_payload,
    )
except ImportError:
    from database import get_session
    from models import Attempt, Exam, Question
    from schemas import (
        ExamDetailResponse,
        ExamListItem,
        ExamUploadResponse,
        ExamValidateResponse,
        QuestionRead,
        ValidationSummary,
        validate_exam_payload,
    )

router = APIRouter(prefix="/api/exams", tags=["Exams"])


async def _extract_json_payload(request: Request) -> Any:
    """
    Accepts either a raw `application/json` body OR `multipart/form-data` with a `file` upload
    (or `payload` string field), returning the parsed JSON data or raising a descriptive error.
    """
    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        upload = form.get("file")
        if upload is not None and isinstance(upload, UploadFile) or hasattr(upload, "read"):
            raw_bytes = await upload.read()
            try:
                return json.loads(raw_bytes.decode("utf-8-sig"))
            except Exception as exc:
                raise ValueError(f"Invalid JSON syntax in uploaded file: {exc}")
        payload_str = form.get("payload")
        if isinstance(payload_str, str):
            try:
                return json.loads(payload_str)
            except Exception as exc:
                raise ValueError(f"Invalid JSON syntax in form payload: {exc}")
        raise ValueError("Multipart form request must include a 'file' or 'payload' field.")

    raw_bytes = await request.body()
    if not raw_bytes:
        raise ValueError("Request body is empty.")
    try:
        return json.loads(raw_bytes.decode("utf-8-sig"))
    except Exception as exc:
        raise ValueError(f"Invalid JSON syntax: {exc}")


@router.post("/validate", response_model=ExamValidateResponse)
async def validate_exam_endpoint(request: Request):
    """
    Dry-run validation of an SSC CGL exam JSON payload.
    Inspects every question and collects all errors with exact question numbers.
    """
    try:
        payload = await _extract_json_payload(request)
    except ValueError as exc:
        return ExamValidateResponse(
            valid=False,
            errors=[str(exc)],
            summary=ValidationSummary(),
        )

    is_valid, errors, summary, _ = validate_exam_payload(payload)
    return ExamValidateResponse(
        valid=is_valid,
        errors=errors,
        summary=summary,
    )


@router.post("/upload")
async def upload_exam_endpoint(request: Request, session: Session = Depends(get_session)):
    """
    Validates the incoming exam JSON payload and, if valid, persists Exam and Question rows to cgl_prep.db.
    If invalid, returns HTTP 422 with the full list of question-level errors.
    """
    try:
        payload = await _extract_json_payload(request)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content=ExamValidateResponse(
                valid=False,
                errors=[str(exc)],
                summary=ValidationSummary(),
            ).model_dump(),
        )

    is_valid, errors, summary, normalized = validate_exam_payload(payload)
    if not is_valid or normalized is None:
        return JSONResponse(
            status_code=422,
            content=ExamValidateResponse(
                valid=False,
                errors=errors,
                summary=summary,
            ).model_dump(),
        )

    exam = Exam(
        title=normalized["title"],
        duration_minutes=normalized["duration_minutes"],
        positive_marks=normalized["positive_marks"],
        negative_marks=normalized["negative_marks"],
    )
    session.add(exam)
    session.flush()  # Populate exam.id

    for q_data in normalized["questions"]:
        question = Question(
            exam_id=exam.id,
            q_no=q_data["q_no"],
            section=q_data["section"],
            topic=q_data["topic"],
            sub_topic=q_data["sub_topic"],
            question_text=q_data["question_text"],
            image_path=q_data["image_path"],
            option_a=q_data["option_a"],
            option_b=q_data["option_b"],
            option_c=q_data["option_c"],
            option_d=q_data["option_d"],
            correct_option=q_data["correct_option"],
            explanation=q_data["explanation"],
            is_bookmarked=q_data["is_bookmarked"],
        )
        session.add(question)

    session.commit()
    session.refresh(exam)

    return ExamUploadResponse(
        valid=True,
        exam_id=exam.id,
        title=exam.title,
        question_count=len(normalized["questions"]),
        summary=summary,
    )


@router.get("", response_model=List[ExamListItem])
def list_exams(session: Session = Depends(get_session)):
    """
    Lists all exams with question count, ordered section list, attempt count,
    highest score among completed attempts, and any active 'in_progress' attempt_id.
    """
    exams = session.exec(select(Exam).order_by(Exam.created_at.desc(), Exam.id.desc())).all()
    result: List[ExamListItem] = []

    for exam in exams:
        questions = session.exec(
            select(Question).where(Question.exam_id == exam.id).order_by(Question.q_no.asc())
        ).all()
        attempts = session.exec(
            select(Attempt).where(Attempt.exam_id == exam.id).order_by(Attempt.started_at.desc())
        ).all()

        sections_seen: List[str] = []
        for q in questions:
            if q.section not in sections_seen:
                sections_seen.append(q.section)

        completed_attempts = [a for a in attempts if a.status == "completed"]
        in_progress_attempts = [a for a in attempts if a.status == "in_progress"]

        highest_score: Optional[float] = (
            max(a.total_score for a in completed_attempts) if completed_attempts else None
        )
        active_attempt_id: Optional[int] = (
            in_progress_attempts[0].id if in_progress_attempts else None
        )

        result.append(
            ExamListItem(
                id=exam.id,
                title=exam.title,
                duration_minutes=exam.duration_minutes,
                positive_marks=exam.positive_marks,
                negative_marks=exam.negative_marks,
                created_at=exam.created_at,
                question_count=len(questions),
                sections=sections_seen,
                attempt_count=len(attempts),
                completed_attempt_count=len(completed_attempts),
                highest_score=highest_score,
                active_attempt_id=active_attempt_id,
            )
        )

    return result


@router.get("/{exam_id}", response_model=ExamDetailResponse)
def get_exam(exam_id: int, session: Session = Depends(get_session)):
    """
    Fetch exam metadata and ordered questions.
    """
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {exam_id} not found.")

    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.q_no.asc())
    ).all()

    sections_seen: List[str] = []
    q_reads: List[QuestionRead] = []
    for q in questions:
        if q.section not in sections_seen:
            sections_seen.append(q.section)
        q_reads.append(
            QuestionRead(
                id=q.id,
                exam_id=q.exam_id,
                q_no=q.q_no,
                section=q.section,
                topic=q.topic,
                sub_topic=q.sub_topic,
                question_text=q.question_text,
                image_path=q.image_path,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_option=q.correct_option,
                explanation=q.explanation,
                is_bookmarked=q.is_bookmarked,
            )
        )

    return ExamDetailResponse(
        id=exam.id,
        title=exam.title,
        duration_minutes=exam.duration_minutes,
        positive_marks=exam.positive_marks,
        negative_marks=exam.negative_marks,
        created_at=exam.created_at,
        question_count=len(q_reads),
        sections=sections_seen,
        questions=q_reads,
    )


@router.delete("/{exam_id}")
def delete_exam(exam_id: int, session: Session = Depends(get_session)):
    """
    Delete an exam and cascade-delete all its questions, attempts, and attempt responses.
    """
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {exam_id} not found.")

    title = exam.title
    session.delete(exam)
    session.commit()

    return {"status": "deleted", "exam_id": exam_id, "title": title}
