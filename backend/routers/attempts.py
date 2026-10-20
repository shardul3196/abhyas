from typing import Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import Attempt, AttemptResponse, Exam, Question, utc_now
    from backend.schemas import (
         VALID_CORRECT_OPTIONS,
        VALID_PALETTE_STATUSES,
        AttemptExamMetadata,
        AttemptQuestionItem,
        AttemptResponsePatchRequest,
        AttemptResponsePatchResult,
        AttemptResponseRead,
        AttemptStartRequest,
        AttemptStateResponse,
        AttemptSubmitRequest,
        AttemptSubmitResponse,
        ExamAttemptHistoryItem,
    )
except ImportError:
    from database import get_session
    from models import Attempt, AttemptResponse, Exam, Question, utc_now
    from schemas import (
        VALID_CORRECT_OPTIONS,
        VALID_PALETTE_STATUSES,
        AttemptExamMetadata,
        AttemptQuestionItem,
        AttemptResponsePatchRequest,
        AttemptResponsePatchResult,
        AttemptResponseRead,
        AttemptStartRequest,
        AttemptStateResponse,
        AttemptSubmitRequest,
        AttemptSubmitResponse,
        ExamAttemptHistoryItem,
    )

router = APIRouter(prefix="/api", tags=["Attempts"])


def _build_attempt_state_response(
    session: Session,
    attempt: Attempt,
    exam: Exam,
    resumed: bool = False,
) -> AttemptStateResponse:
    """
    Constructs the full AttemptStateResponse for a given Attempt and Exam.
    Ensures AttemptResponse rows exist for all questions and hides
    `correct_option` and `explanation` while `attempt.status == "in_progress"`.
    """
    questions = session.exec(
        select(Question).where(Question.exam_id == exam.id).order_by(Question.q_no.asc())
    ).all()

    existing_responses = session.exec(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt.id)
    ).all()
    resp_by_qid: Dict[int, AttemptResponse] = {r.question_id: r for r in existing_responses}

    # Ensure every question in the exam has an AttemptResponse row
    created_missing = False
    for idx, q in enumerate(questions):
        if q.id not in resp_by_qid:
            default_status = "not_answered" if idx == 0 else "not_visited"
            new_resp = AttemptResponse(
                attempt_id=attempt.id,
                question_id=q.id,
                selected_option=None,
                palette_status=default_status,
                time_spent_sec=0,
                is_correct=None,
            )
            session.add(new_resp)
            created_missing = True

    if created_missing:
        session.commit()
        existing_responses = session.exec(
            select(AttemptResponse).where(AttemptResponse.attempt_id == attempt.id)
        ).all()
        resp_by_qid = {r.question_id: r for r in existing_responses}

    is_completed = attempt.status == "completed"
    sections_seen: List[str] = []
    question_items: List[AttemptQuestionItem] = []
    response_reads: List[AttemptResponseRead] = []

    for q in questions:
        if q.section not in sections_seen:
            sections_seen.append(q.section)

        resp = resp_by_qid[q.id]
        resp_read = AttemptResponseRead(
            id=resp.id,
            attempt_id=attempt.id,
            question_id=q.id,
            q_no=q.q_no,
            selected_option=resp.selected_option,
            palette_status=resp.palette_status,
            time_spent_sec=resp.time_spent_sec,
            is_correct=resp.is_correct if is_completed else None,
        )
        response_reads.append(resp_read)

        question_items.append(
            AttemptQuestionItem(
                id=q.id,
                question_id=q.id,
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
                is_bookmarked=q.is_bookmarked,
                correct_option=q.correct_option if is_completed else None,
                explanation=q.explanation if is_completed else None,
                response_id=resp.id,
                selected_option=resp.selected_option,
                palette_status=resp.palette_status,
                time_spent_sec=resp.time_spent_sec,
                is_correct=resp.is_correct if is_completed else None,
                response=resp_read,
            )
        )

    exam_meta = AttemptExamMetadata(
        id=exam.id,
        title=exam.title,
        duration_minutes=exam.duration_minutes,
        positive_marks=exam.positive_marks,
        negative_marks=exam.negative_marks,
        question_count=len(questions),
        sections=sections_seen,
    )

    return AttemptStateResponse(
        id=attempt.id,
        attempt_id=attempt.id,
        exam_id=exam.id,
        status=attempt.status,
        resumed=resumed,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        remaining_seconds=attempt.remaining_seconds,
        total_time_spent_sec=attempt.total_time_spent_sec,
        total_score=attempt.total_score,
        correct_count=attempt.correct_count,
        incorrect_count=attempt.incorrect_count,
        unattempted_count=attempt.unattempted_count,
        exam=exam_meta,
        questions=question_items,
        responses=response_reads,
    )


def _start_or_resume_attempt(
    session: Session,
    exam_id: int,
    force_new: bool = False,
) -> AttemptStateResponse:
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {exam_id} not found.")

    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.q_no.asc())
    ).all()
    if not questions:
        raise HTTPException(
            status_code=400,
            detail=f"Exam with id {exam_id} has no questions.",
        )

    in_progress_attempts = session.exec(
        select(Attempt)
        .where(Attempt.exam_id == exam_id, Attempt.status == "in_progress")
        .order_by(Attempt.started_at.desc(), Attempt.id.desc())
    ).all()

    if in_progress_attempts and not force_new:
        active_attempt = in_progress_attempts[0]
        return _build_attempt_state_response(
            session=session,
            attempt=active_attempt,
            exam=exam,
            resumed=True,
        )

    # If force_new is requested, remove any unfinished in_progress attempts for this exam
    if in_progress_attempts and force_new:
        for old_attempt in in_progress_attempts:
            session.delete(old_attempt)
        session.flush()

    attempt = Attempt(
        exam_id=exam.id,
        status="in_progress",
        remaining_seconds=exam.duration_minutes * 60,
        total_score=0.0,
        correct_count=0,
        incorrect_count=0,
        unattempted_count=len(questions),
        total_time_spent_sec=0,
    )
    session.add(attempt)
    session.flush()  # Populate attempt.id

    for idx, q in enumerate(questions):
        palette_status = "not_answered" if idx == 0 else "not_visited"
        resp = AttemptResponse(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_option=None,
            palette_status=palette_status,
            time_spent_sec=0,
            is_correct=None,
        )
        session.add(resp)

    session.commit()
    session.refresh(attempt)

    return _build_attempt_state_response(
        session=session,
        attempt=attempt,
        exam=exam,
        resumed=False,
    )


@router.post("/exams/{exam_id}/start", response_model=AttemptStateResponse)
def start_exam_attempt(
    exam_id: int,
    force_new: bool = Query(default=False),
    body: Optional[AttemptStartRequest] = Body(default=None),
    session: Session = Depends(get_session),
):
    """
    Resumes an existing 'in_progress' attempt for the exam (unless `force_new=True`)
    or initializes a new Attempt (`status="in_progress"`, `remaining_seconds = exam.duration_minutes * 60`)
    and pre-creates AttemptResponse rows for all questions (`palette_status="not_visited"`,
    with Question #1 initialized to `"not_answered"`).
    """
    effective_force_new = force_new or (body.force_new if body is not None else False)
    return _start_or_resume_attempt(
        session=session,
        exam_id=exam_id,
        force_new=effective_force_new,
    )


@router.post("/attempts/start", response_model=AttemptStateResponse)
def start_attempt_via_body(
    body: AttemptStartRequest,
    session: Session = Depends(get_session),
):
    """
    Alternative start endpoint accepting `{ "exam_id": int, "force_new": bool }`.
    """
    if body.exam_id is None:
        raise HTTPException(status_code=400, detail="Field 'exam_id' is required.")
    return _start_or_resume_attempt(
        session=session,
        exam_id=body.exam_id,
        force_new=body.force_new,
    )


@router.get("/attempts/{attempt_id}", response_model=AttemptStateResponse)
def get_attempt_state(attempt_id: int, session: Session = Depends(get_session)):
    """
    Returns full attempt state (Attempt metadata, Exam details, ordered questions without leaking
    `correct_option` / `explanation` while `status == "in_progress"`, or full details if `"completed"`,
    alongside current AttemptResponse state for each question) for seamless tablet refresh/crash recovery.
    """
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail=f"Attempt with id {attempt_id} not found.")

    exam = session.get(Exam, attempt.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {attempt.exam_id} not found.")

    return _build_attempt_state_response(
        session=session,
        attempt=attempt,
        exam=exam,
        resumed=False,
    )


@router.patch("/attempts/{attempt_id}/response", response_model=AttemptResponsePatchResult)
def patch_attempt_response(
    attempt_id: int,
    payload: AttemptResponsePatchRequest,
    session: Session = Depends(get_session),
):
    """
    Real-time delta auto-save for a question during an active exam attempt.
    Increments `AttemptResponse.time_spent_sec` by `delta_time_spent_sec`, updates
    `selected_option` and `palette_status`, and updates `Attempt.remaining_seconds`
    and `Attempt.total_time_spent_sec`.
    """
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail=f"Attempt with id {attempt_id} not found.")

    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update response for attempt {attempt_id} because its status is '{attempt.status}'.",
        )

    palette_status = payload.palette_status.strip()
    if palette_status not in VALID_PALETTE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid palette_status '{palette_status}'. Must be one of {sorted(VALID_PALETTE_STATUSES)}.",
        )

    normalized_option: Optional[str] = None
    if payload.selected_option is not None and payload.selected_option.strip() != "":
        opt_upper = payload.selected_option.strip().upper()
        if opt_upper not in VALID_CORRECT_OPTIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid selected_option '{payload.selected_option}'. Must be one of A, B, C, D or null.",
            )
        normalized_option = opt_upper

    question = session.get(Question, payload.question_id)
    if not question or question.exam_id != attempt.exam_id:
        raise HTTPException(
            status_code=404,
            detail=f"Question with id {payload.question_id} not found in exam {attempt.exam_id}.",
        )

    resp = session.exec(
        select(AttemptResponse).where(
            AttemptResponse.attempt_id == attempt_id,
            AttemptResponse.question_id == payload.question_id,
        )
    ).first()

    if not resp:
        resp = AttemptResponse(
            attempt_id=attempt_id,
            question_id=payload.question_id,
            selected_option=None,
            palette_status="not_visited",
            time_spent_sec=0,
            is_correct=None,
        )
        session.add(resp)
        session.flush()

    delta_sec = max(0, int(payload.delta_time_spent_sec))
    resp.time_spent_sec = max(0, resp.time_spent_sec + delta_sec)
    resp.selected_option = normalized_option
    resp.palette_status = palette_status
    session.add(resp)
    session.flush()

    all_responses = session.exec(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt_id)
    ).all()
    attempt.total_time_spent_sec = sum(r.time_spent_sec for r in all_responses)

    if payload.remaining_seconds is not None:
        attempt.remaining_seconds = max(0, int(payload.remaining_seconds))

    session.add(attempt)
    session.commit()
    session.refresh(resp)
    session.refresh(attempt)

    return AttemptResponsePatchResult(
        attempt_id=attempt.id,
        question_id=question.id,
        q_no=question.q_no,
        response_id=resp.id,
        selected_option=resp.selected_option,
        palette_status=resp.palette_status,
        time_spent_sec=resp.time_spent_sec,
        remaining_seconds=attempt.remaining_seconds,
        total_time_spent_sec=attempt.total_time_spent_sec,
    )


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptSubmitResponse)
def submit_attempt(
    attempt_id: int,
    body: Optional[AttemptSubmitRequest] = Body(default=None),
    session: Session = Depends(get_session),
):
    """
    Marks `Attempt.status = "completed"`, sets `submitted_at`, and evaluates all responses
    using strict SSC CGL marking rules:
    - `palette_status` in `("answered", "answered_and_marked")` with non-null `selected_option`
      earns `+exam.positive_marks` if correct or `-exam.negative_marks` if wrong.
    - All other statuses (`"marked_for_review"` without answer, `"not_answered"`, `"not_visited"`,
      or null `selected_option`) count as unattempted with `0` marks (`is_correct = None`).
    """
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail=f"Attempt with id {attempt_id} not found.")

    exam = session.get(Exam, attempt.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {attempt.exam_id} not found.")

    if body is not None and body.remaining_seconds is not None and attempt.status == "in_progress":
        attempt.remaining_seconds = max(0, int(body.remaining_seconds))

    questions = session.exec(
        select(Question).where(Question.exam_id == exam.id).order_by(Question.q_no.asc())
    ).all()
    existing_responses = session.exec(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt.id)
    ).all()
    resp_by_qid: Dict[int, AttemptResponse] = {r.question_id: r for r in existing_responses}

    correct_count = 0
    incorrect_count = 0
    unattempted_count = 0
    total_time_spent_sec = 0

    for idx, q in enumerate(questions):
        resp = resp_by_qid.get(q.id)
        if resp is None:
            resp = AttemptResponse(
                attempt_id=attempt.id,
                question_id=q.id,
                selected_option=None,
                palette_status="not_answered" if idx == 0 else "not_visited",
                time_spent_sec=0,
                is_correct=None,
            )
            session.add(resp)

        total_time_spent_sec += resp.time_spent_sec

        # Strict SSC CGL Evaluation Rule
        if (
            resp.palette_status in ("answered", "answered_and_marked")
            and resp.selected_option in VALID_CORRECT_OPTIONS
        ):
            if resp.selected_option == q.correct_option:
                resp.is_correct = True
                correct_count += 1
            else:
                resp.is_correct = False
                incorrect_count += 1
        else:
            resp.is_correct = None
            unattempted_count += 1

        session.add(resp)

    raw_positive_score = round(correct_count * exam.positive_marks, 4)
    negative_penalty = round(incorrect_count * exam.negative_marks, 4)
    total_score = round(raw_positive_score - negative_penalty, 4)
    max_score = round(len(questions) * exam.positive_marks, 4)
    attempted_count = correct_count + incorrect_count
    accuracy_pct = round((correct_count / attempted_count) * 100.0, 2) if attempted_count > 0 else 0.0

    attempt.status = "completed"
    if attempt.submitted_at is None:
        attempt.submitted_at = utc_now()
    attempt.correct_count = correct_count
    attempt.incorrect_count = incorrect_count
    attempt.unattempted_count = unattempted_count
    attempt.total_score = total_score
    attempt.total_time_spent_sec = total_time_spent_sec

    session.add(attempt)
    session.commit()
    session.refresh(attempt)

    return AttemptSubmitResponse(
        id=attempt.id,
        attempt_id=attempt.id,
        exam_id=exam.id,
        exam_title=exam.title,
        status=attempt.status,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        remaining_seconds=attempt.remaining_seconds,
        total_time_spent_sec=attempt.total_time_spent_sec,
        question_count=len(questions),
        attempted_count=attempted_count,
        correct_count=attempt.correct_count,
        incorrect_count=attempt.incorrect_count,
        unattempted_count=attempt.unattempted_count,
        raw_positive_score=raw_positive_score,
        negative_penalty=negative_penalty,
        total_score=attempt.total_score,
        max_score=max_score,
        accuracy_pct=accuracy_pct,
    )


@router.get("/exams/{exam_id}/attempts", response_model=List[ExamAttemptHistoryItem])
def list_exam_attempts(exam_id: int, session: Session = Depends(get_session)):
    """
    Lists all historical attempts for a given exam ordered from newest to oldest.
    """
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {exam_id} not found.")

    questions = session.exec(select(Question).where(Question.exam_id == exam_id)).all()
    q_count = len(questions)
    max_score = round(q_count * exam.positive_marks, 4)

    attempts = session.exec(
        select(Attempt)
        .where(Attempt.exam_id == exam_id)
        .order_by(Attempt.started_at.desc(), Attempt.id.desc())
    ).all()

    history: List[ExamAttemptHistoryItem] = []
    for a in attempts:
        attempted_count = a.correct_count + a.incorrect_count
        accuracy_pct = (
            round((a.correct_count / attempted_count) * 100.0, 2) if attempted_count > 0 else 0.0
        )
        history.append(
            ExamAttemptHistoryItem(
                id=a.id,
                attempt_id=a.id,
                exam_id=exam.id,
                exam_title=exam.title,
                status=a.status,
                started_at=a.started_at,
                submitted_at=a.submitted_at,
                remaining_seconds=a.remaining_seconds,
                total_time_spent_sec=a.total_time_spent_sec,
                question_count=q_count,
                attempted_count=attempted_count,
                correct_count=a.correct_count,
                incorrect_count=a.incorrect_count,
                unattempted_count=a.unattempted_count,
                total_score=a.total_score,
                max_score=max_score,
                accuracy_pct=accuracy_pct,
            )
        )

    return history
