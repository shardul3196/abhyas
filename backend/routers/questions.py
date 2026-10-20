from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import Exam, Question
    from backend.schemas import BookmarkedQuestionItem, BookmarkToggleResponse
except ImportError:
    from database import get_session
    from models import Exam, Question
    from schemas import BookmarkedQuestionItem, BookmarkToggleResponse

router = APIRouter(prefix="/api/questions", tags=["Questions"])


@router.patch("/{question_id}/bookmark", response_model=BookmarkToggleResponse)
def toggle_question_bookmark(question_id: int, session: Session = Depends(get_session)):
    """
    Toggles `is_bookmarked` on a question and returns the updated state.
    """
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail=f"Question with id {question_id} not found.")

    question.is_bookmarked = not question.is_bookmarked
    session.add(question)
    session.commit()
    session.refresh(question)

    return BookmarkToggleResponse(
        id=question.id,
        question_id=question.id,
        is_bookmarked=question.is_bookmarked,
    )


@router.get("/bookmarked", response_model=List[BookmarkedQuestionItem])
def list_bookmarked_questions(
    section: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    exam_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    """
    Lists all bookmarked questions across exams with exam title, section, topic,
    question text, options, correct option, and explanation.
    """
    stmt = (
        select(Question, Exam.title)
        .join(Exam, Question.exam_id == Exam.id)
        .where(Question.is_bookmarked == True)  # noqa: E712
        .order_by(Exam.id.desc(), Question.q_no.asc())
    )

    if section:
        stmt = stmt.where(Question.section == section)
    if topic:
        stmt = stmt.where(Question.topic == topic)
    if exam_id is not None:
        stmt = stmt.where(Question.exam_id == exam_id)

    rows = session.exec(stmt).all()
    items: List[BookmarkedQuestionItem] = []

    for question, exam_title in rows:
        items.append(
            BookmarkedQuestionItem(
                id=question.id,
                exam_id=question.exam_id,
                exam_title=exam_title,
                q_no=question.q_no,
                section=question.section,
                topic=question.topic,
                sub_topic=question.sub_topic,
                question_text=question.question_text,
                image_path=question.image_path,
                option_a=question.option_a,
                option_b=question.option_b,
                option_c=question.option_c,
                option_d=question.option_d,
                correct_option=question.correct_option,
                explanation=question.explanation,
                is_bookmarked=question.is_bookmarked,
            )
        )

    return items
