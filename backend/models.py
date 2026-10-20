from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Exam(SQLModel, table=True):
    __tablename__ = "exam"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    duration_minutes: int = Field(default=60)
    positive_marks: float = Field(default=2.0)
    negative_marks: float = Field(default=0.5)
    created_at: datetime = Field(default_factory=utc_now)

    questions: List["Question"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )
    attempts: List["Attempt"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )


class Question(SQLModel, table=True):
    __tablename__ = "question"

    id: Optional[int] = Field(default=None, primary_key=True)
    exam_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("exam.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    q_no: int = Field(index=True)  # 1-indexed
    section: str = Field(index=True)
    topic: str = Field(index=True)
    sub_topic: Optional[str] = Field(default=None)
    question_text: str
    image_path: Optional[str] = Field(default=None)
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str  # "A" | "B" | "C" | "D"
    explanation: str
    is_bookmarked: bool = Field(default=False, index=True)

    exam: Optional[Exam] = Relationship(back_populates="questions")
    responses: List["AttemptResponse"] = Relationship(
        back_populates="question",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )


class Attempt(SQLModel, table=True):
    __tablename__ = "attempt"

    id: Optional[int] = Field(default=None, primary_key=True)
    exam_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("exam.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    started_at: datetime = Field(default_factory=utc_now)
    submitted_at: Optional[datetime] = Field(default=None)
    status: str = Field(default="in_progress", index=True)  # "in_progress" | "completed"
    remaining_seconds: int
    total_score: float = Field(default=0.0)
    correct_count: int = Field(default=0)
    incorrect_count: int = Field(default=0)
    unattempted_count: int = Field(default=0)
    total_time_spent_sec: int = Field(default=0)

    exam: Optional[Exam] = Relationship(back_populates="attempts")
    responses: List["AttemptResponse"] = Relationship(
        back_populates="attempt",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
        },
    )


class AttemptResponse(SQLModel, table=True):
    __tablename__ = "attempt_response"

    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("attempt.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    question_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("question.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    selected_option: Optional[str] = Field(default=None)  # "A" | "B" | "C" | "D" | None
    palette_status: str = Field(
        default="not_visited"
    )  # "not_visited"|"not_answered"|"answered"|"marked_for_review"|"answered_and_marked"
    time_spent_sec: int = Field(default=0)
    is_correct: Optional[bool] = Field(default=None)

    attempt: Optional[Attempt] = Relationship(back_populates="responses")
    question: Optional[Question] = Relationship(back_populates="responses")
