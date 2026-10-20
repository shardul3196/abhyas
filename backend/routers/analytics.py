from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

try:
    from backend.database import get_session
    from backend.models import Attempt, AttemptResponse, Exam, Question
    from backend.schemas import (
        VALID_CORRECT_OPTIONS,
        AttemptAnalysisResponse,
        BentoSummaryMetrics,
        GlobalAnalyticsOverviewResponse,
        GlobalOverviewSummary,
        QuestionReviewItem,
        ScoreTrendPoint,
        SectionalBreakdownItem,
        TopicActionMatrix,
        TopicActionMatrixBuckets,
        TopicMatrixItem,
    )
except ImportError:
    from database import get_session
    from models import Attempt, AttemptResponse, Exam, Question
    from schemas import (
        VALID_CORRECT_OPTIONS,
        AttemptAnalysisResponse,
        BentoSummaryMetrics,
        GlobalAnalyticsOverviewResponse,
        GlobalOverviewSummary,
        QuestionReviewItem,
        ScoreTrendPoint,
        SectionalBreakdownItem,
        TopicActionMatrix,
        TopicActionMatrixBuckets,
        TopicMatrixItem,
    )

router = APIRouter(prefix="/api", tags=["Analytics"])


def classify_topic_bucket(accuracy_pct: float, avg_time_sec: float) -> Tuple[str, str, str]:
    """
    4-Bucket Topic Action Matrix classification engine:
    1. `concept_gap`: accuracy_pct < 60 and avg_time_sec > 60 -> Low Accuracy, High Time — Needs study
    2. `silly_mistakes`: accuracy_pct < 60 and avg_time_sec <= 60 -> Low Accuracy, Low Time — Slow down & read carefully
    3. `needs_speed`: accuracy_pct >= 75 (or >= 60) and avg_time_sec > 90 -> High Accuracy, High Time (>90s) — Learn faster methods
    4. `strong_zone`: accuracy_pct >= 75 (or >= 60) and avg_time_sec <= 90 -> High Accuracy, Optimal Time
    """
    if accuracy_pct < 60.0:
        if avg_time_sec > 60.0:
            return (
                "concept_gap",
                "Concept Gap",
                "Low Accuracy (<60%), High Time (>60s) — Needs conceptual study & revision",
            )
        return (
            "silly_mistakes",
            "Silly Mistakes / Guessing",
            "Low Accuracy (<60%), Low Time (<=60s) — Slow down & read carefully",
        )

    # accuracy_pct >= 60.0 (handles both >= 75% high accuracy and 60-75% intermediate accuracy cleanly)
    if avg_time_sec > 90.0:
        rec = (
            "High Accuracy (>=75%), High Time (>90s) — Learn faster methods & shortcuts"
            if accuracy_pct >= 75.0
            else "Moderate Accuracy (60-75%), High Time (>90s) — Practice speed & shortcuts"
        )
        return ("needs_speed", "Needs Speed / Shortcuts", rec)

    rec = (
        "High Accuracy (>=75%), Optimal Time (<=90s) — Strong mastery zone"
        if accuracy_pct >= 75.0
        else "Moderate Accuracy (60-75%), Optimal Time (<=90s) — Push accuracy above 75%"
    )
    return ("strong_zone", "Strong Zone", rec)


def _evaluate_response(
    resp: Optional[AttemptResponse],
    question: Question,
    positive_marks: float,
    negative_marks: float,
) -> Tuple[bool, Optional[bool], str, float, int, str, Optional[str]]:
    """
    Evaluates a single question response according to strict SSC CGL rules.
    Returns (is_evaluated, is_correct, result_status, marks_awarded, time_spent_sec, palette_status, selected_option).
    """
    if resp is None:
        return (False, None, "unattempted", 0.0, 0, "not_visited", None)

    time_spent = max(0, resp.time_spent_sec)
    palette_status = resp.palette_status
    selected_opt = resp.selected_option

    if (
        palette_status in ("answered", "answered_and_marked")
        and selected_opt in VALID_CORRECT_OPTIONS
    ):
        if selected_opt == question.correct_option:
            return (
                True,
                True,
                "correct",
                round(positive_marks, 4),
                time_spent,
                palette_status,
                selected_opt,
            )
        return (
            True,
            False,
            "incorrect",
            round(-negative_marks, 4),
            time_spent,
            palette_status,
            selected_opt,
        )

    return (False, None, "unattempted", 0.0, time_spent, palette_status, selected_opt)


def _build_topic_action_matrix(topic_accum: Dict[str, Dict[str, Any]]) -> TopicActionMatrix:
    buckets = TopicActionMatrixBuckets()
    all_topics: List[TopicMatrixItem] = []

    for topic_name, stats in topic_accum.items():
        total_q = stats["total_questions"]
        attempted = stats["attempted"]
        correct = stats["correct"]
        incorrect = stats["incorrect"]
        unattempted = stats["unattempted"]
        total_time = stats["total_time_sec"]
        score = round(stats["score"], 4)
        max_score = round(stats["max_score"], 4)

        accuracy_pct = round((correct / attempted) * 100.0, 2) if attempted > 0 else 0.0
        avg_time_sec = round(total_time / total_q, 2) if total_q > 0 else 0.0

        bucket_key, bucket_label, recommendation = classify_topic_bucket(
            accuracy_pct=accuracy_pct,
            avg_time_sec=avg_time_sec,
        )

        item = TopicMatrixItem(
            topic=topic_name,
            section=stats["section"],
            sub_topics=stats["sub_topics"],
            total_questions=total_q,
            attempted=attempted,
            correct=correct,
            incorrect=incorrect,
            unattempted=unattempted,
            score=score,
            max_score=max_score,
            accuracy_pct=accuracy_pct,
            total_time_sec=total_time,
            avg_time_sec=avg_time_sec,
            bucket=bucket_key,
            bucket_label=bucket_label,
            recommendation=recommendation,
        )
        all_topics.append(item)
        getattr(buckets, bucket_key).append(item)

    return TopicActionMatrix(buckets=buckets, topics=all_topics)


@router.get("/attempts/{attempt_id}/analysis", response_model=AttemptAnalysisResponse)
def get_attempt_analysis(attempt_id: int, session: Session = Depends(get_session)):
    """
    Returns deep post-exam analytics for a completed attempt:
    1. Bento-Grid summary metrics
    2. Sectional Breakdown
    3. 4-Bucket Topic-Wise Action Matrix
    4. Full Question-by-Question Review items (with `is_bookmarked`, `time_spent_sec`, `is_slow`, etc.)
    """
    attempt = session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail=f"Attempt with id {attempt_id} not found.")

    if attempt.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Attempt {attempt_id} is still '{attempt.status}'. Submit the attempt before viewing analysis.",
        )

    exam = session.get(Exam, attempt.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with id {attempt.exam_id} not found.")

    questions = session.exec(
        select(Question).where(Question.exam_id == exam.id).order_by(Question.q_no.asc())
    ).all()
    responses = session.exec(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt.id)
    ).all()
    resp_by_qid: Dict[int, AttemptResponse] = {r.question_id: r for r in responses}

    total_questions = len(questions)
    total_time_spent_sec = sum(max(0, r.time_spent_sec) for r in responses)
    avg_time_per_question_sec = (
        round(total_time_spent_sec / total_questions, 2) if total_questions > 0 else 0.0
    )

    # Slow threshold: a question is flagged `is_slow` if `time_spent_sec > 90` OR `time_spent_sec > 2 * avg_question_time`
    slow_threshold_sec = (
        round(min(90.0, 2.0 * avg_time_per_question_sec), 2)
        if avg_time_per_question_sec > 0
        else 90.0
    )

    section_accum: Dict[str, Dict[str, Any]] = {}
    section_order: List[str] = []
    topic_accum: Dict[str, Dict[str, Any]] = {}

    correct_count = 0
    incorrect_count = 0
    unattempted_count = 0
    attempted_time_sec = 0

    review_items: List[QuestionReviewItem] = []

    for q in questions:
        resp = resp_by_qid.get(q.id)
        (
            is_evaluated,
            is_correct,
            result_status,
            marks_awarded,
            time_spent,
            palette_status,
            selected_opt,
        ) = _evaluate_response(
            resp=resp,
            question=q,
            positive_marks=exam.positive_marks,
            negative_marks=exam.negative_marks,
        )

        if result_status == "correct":
            correct_count += 1
            attempted_time_sec += time_spent
        elif result_status == "incorrect":
            incorrect_count += 1
            attempted_time_sec += time_spent
        else:
            unattempted_count += 1

        # Sectional aggregation
        if q.section not in section_accum:
            section_order.append(q.section)
            section_accum[q.section] = {
                "total_questions": 0,
                "attempted": 0,
                "correct": 0,
                "incorrect": 0,
                "unattempted": 0,
                "positive_score": 0.0,
                "negative_penalty": 0.0,
                "max_score": 0.0,
                "time_spent_sec": 0,
            }
        sec_stats = section_accum[q.section]
        sec_stats["total_questions"] += 1
        sec_stats["max_score"] += exam.positive_marks
        sec_stats["time_spent_sec"] += time_spent
        if result_status == "correct":
            sec_stats["attempted"] += 1
            sec_stats["correct"] += 1
            sec_stats["positive_score"] += exam.positive_marks
        elif result_status == "incorrect":
            sec_stats["attempted"] += 1
            sec_stats["incorrect"] += 1
            sec_stats["negative_penalty"] += exam.negative_marks
        else:
            sec_stats["unattempted"] += 1

        # Topic aggregation
        if q.topic not in topic_accum:
            topic_accum[q.topic] = {
                "section": q.section,
                "sub_topics": [],
                "total_questions": 0,
                "attempted": 0,
                "correct": 0,
                "incorrect": 0,
                "unattempted": 0,
                "score": 0.0,
                "max_score": 0.0,
                "total_time_sec": 0,
            }
        top_stats = topic_accum[q.topic]
        if q.sub_topic and q.sub_topic not in top_stats["sub_topics"]:
            top_stats["sub_topics"].append(q.sub_topic)
        top_stats["total_questions"] += 1
        top_stats["max_score"] += exam.positive_marks
        top_stats["total_time_sec"] += time_spent
        top_stats["score"] += marks_awarded
        if result_status == "correct":
            top_stats["attempted"] += 1
            top_stats["correct"] += 1
        elif result_status == "incorrect":
            top_stats["attempted"] += 1
            top_stats["incorrect"] += 1
        else:
            top_stats["unattempted"] += 1

        is_over_90s = time_spent > 90
        is_slow = is_over_90s or (
            avg_time_per_question_sec > 0 and time_spent > (2.0 * avg_time_per_question_sec)
        )

        review_items.append(
            QuestionReviewItem(
                id=q.id,
                question_id=q.id,
                response_id=resp.id if resp else None,
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
                selected_option=selected_opt,
                correct_option=q.correct_option,
                explanation=q.explanation,
                palette_status=palette_status,
                is_evaluated=is_evaluated,
                is_correct=is_correct,
                result_status=result_status,
                marks_awarded=marks_awarded,
                time_spent_sec=time_spent,
                avg_question_time_sec=avg_time_per_question_sec,
                is_slow=is_slow,
                is_over_90s=is_over_90s,
                is_bookmarked=q.is_bookmarked,
            )
        )

    attempted_count = correct_count + incorrect_count
    raw_positive_score = round(correct_count * exam.positive_marks, 4)
    negative_penalty = round(incorrect_count * exam.negative_marks, 4)
    total_score = round(raw_positive_score - negative_penalty, 4)
    max_score = round(total_questions * exam.positive_marks, 4)
    score_pct = round((total_score / max_score) * 100.0, 2) if max_score > 0 else 0.0
    accuracy_pct = (
        round((correct_count / attempted_count) * 100.0, 2) if attempted_count > 0 else 0.0
    )
    attempt_rate_pct = (
        round((attempted_count / total_questions) * 100.0, 2) if total_questions > 0 else 0.0
    )
    avg_time_per_attempted_sec = (
        round(attempted_time_sec / attempted_count, 2) if attempted_count > 0 else 0.0
    )

    summary = BentoSummaryMetrics(
        attempt_id=attempt.id,
        exam_id=exam.id,
        exam_title=exam.title,
        status=attempt.status,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        duration_minutes=exam.duration_minutes,
        positive_marks=exam.positive_marks,
        negative_marks=exam.negative_marks,
        total_questions=total_questions,
        attempted_count=attempted_count,
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        unattempted_count=unattempted_count,
        raw_positive_score=raw_positive_score,
        negative_penalty=negative_penalty,
        total_score=total_score,
        max_score=max_score,
        score_pct=score_pct,
        accuracy_pct=accuracy_pct,
        attempt_rate_pct=attempt_rate_pct,
        total_time_spent_sec=total_time_spent_sec,
        remaining_seconds=attempt.remaining_seconds,
        avg_time_per_question_sec=avg_time_per_question_sec,
        avg_time_per_attempted_sec=avg_time_per_attempted_sec,
        slow_threshold_sec=slow_threshold_sec,
    )

    sectional_breakdown: List[SectionalBreakdownItem] = []
    for sec_name in section_order:
        s = section_accum[sec_name]
        sec_pos = round(s["positive_score"], 4)
        sec_neg = round(s["negative_penalty"], 4)
        sec_score = round(sec_pos - sec_neg, 4)
        sec_max = round(s["max_score"], 4)
        sec_acc = (
            round((s["correct"] / s["attempted"]) * 100.0, 2) if s["attempted"] > 0 else 0.0
        )
        sec_avg_time = (
            round(s["time_spent_sec"] / s["total_questions"], 2)
            if s["total_questions"] > 0
            else 0.0
        )
        sectional_breakdown.append(
            SectionalBreakdownItem(
                section=sec_name,
                total_questions=s["total_questions"],
                attempted=s["attempted"],
                correct=s["correct"],
                incorrect=s["incorrect"],
                unattempted=s["unattempted"],
                positive_score=sec_pos,
                negative_penalty=sec_neg,
                score=sec_score,
                max_score=sec_max,
                accuracy_pct=sec_acc,
                time_spent_sec=s["time_spent_sec"],
                avg_time_sec=sec_avg_time,
            )
        )

    action_matrix = _build_topic_action_matrix(topic_accum)

    return AttemptAnalysisResponse(
        summary=summary,
        sectional_breakdown=sectional_breakdown,
        action_matrix=action_matrix,
        questions=review_items,
    )


@router.get("/analytics/overview", response_model=GlobalAnalyticsOverviewResponse)
def get_global_analytics_overview(session: Session = Depends(get_session)):
    """
    Aggregates global analytics across all completed attempts:
    - Overall summary KPIs
    - Chronological score trend series
    - Global sectional accuracy & speed breakdown
    - Global 4-Bucket Topic Action Matrix
    - Top weak topics & top slow topics
    """
    completed_attempts = session.exec(
        select(Attempt)
        .where(Attempt.status == "completed")
        .order_by(Attempt.submitted_at.asc(), Attempt.started_at.asc(), Attempt.id.asc())
    ).all()

    if not completed_attempts:
        empty_matrix = TopicActionMatrix(buckets=TopicActionMatrixBuckets(), topics=[])
        return GlobalAnalyticsOverviewResponse(
            overall_summary=GlobalOverviewSummary(
                total_completed_attempts=0,
                total_exams_attempted=0,
                total_questions_seen=0,
                total_attempted=0,
                total_correct=0,
                total_incorrect=0,
                total_unattempted=0,
                overall_accuracy_pct=0.0,
                average_score=0.0,
                highest_score=None,
                total_time_spent_sec=0,
                avg_time_per_question_sec=0.0,
            ),
            score_trend=[],
            sectional_breakdown=[],
            action_matrix=empty_matrix,
            top_weak_topics=[],
            top_slow_topics=[],
        )

    exams = session.exec(select(Exam)).all()
    exams_by_id: Dict[int, Exam] = {e.id: e for e in exams}

    all_questions = session.exec(select(Question).order_by(Question.q_no.asc())).all()
    questions_by_exam: Dict[int, List[Question]] = {}
    for q in all_questions:
        questions_by_exam.setdefault(q.exam_id, []).append(q)

    attempt_ids = [a.id for a in completed_attempts]
    all_responses = session.exec(
        select(AttemptResponse).where(AttemptResponse.attempt_id.in_(attempt_ids))
    ).all()
    resp_map: Dict[Tuple[int, int], AttemptResponse] = {
        (r.attempt_id, r.question_id): r for r in all_responses
    }

    score_trend: List[ScoreTrendPoint] = []
    section_accum: Dict[str, Dict[str, Any]] = {}
    section_order: List[str] = []
    topic_accum: Dict[str, Dict[str, Any]] = {}

    total_questions_seen = 0
    total_attempted = 0
    total_correct = 0
    total_incorrect = 0
    total_unattempted = 0
    total_time_spent_sec = 0
    exam_ids_seen = set()

    for idx, attempt in enumerate(completed_attempts, start=1):
        exam = exams_by_id.get(attempt.exam_id)
        if not exam:
            continue
        exam_ids_seen.add(exam.id)
        exam_questions = questions_by_exam.get(exam.id, [])
        q_count = len(exam_questions)
        max_score = round(q_count * exam.positive_marks, 4)

        att_attempted = attempt.correct_count + attempt.incorrect_count
        att_acc = (
            round((attempt.correct_count / att_attempted) * 100.0, 2)
            if att_attempted > 0
            else 0.0
        )
        score_pct = (
            round((attempt.total_score / max_score) * 100.0, 2) if max_score > 0 else 0.0
        )
        ref_dt = attempt.submitted_at or attempt.started_at
        date_label = ref_dt.strftime("%Y-%m-%d")

        score_trend.append(
            ScoreTrendPoint(
                attempt_id=attempt.id,
                attempt_number=idx,
                exam_id=exam.id,
                exam_title=exam.title,
                started_at=attempt.started_at,
                submitted_at=attempt.submitted_at,
                date_label=date_label,
                total_score=attempt.total_score,
                max_score=max_score,
                score_pct=score_pct,
                accuracy_pct=att_acc,
                correct_count=attempt.correct_count,
                incorrect_count=attempt.incorrect_count,
                unattempted_count=attempt.unattempted_count,
                total_time_spent_sec=attempt.total_time_spent_sec,
            )
        )

        for q in exam_questions:
            resp = resp_map.get((attempt.id, q.id))
            (
                _is_eval,
                _is_corr,
                result_status,
                marks_awarded,
                time_spent,
                _pal_status,
                _sel_opt,
            ) = _evaluate_response(
                resp=resp,
                question=q,
                positive_marks=exam.positive_marks,
                negative_marks=exam.negative_marks,
            )

            total_questions_seen += 1
            total_time_spent_sec += time_spent
            if result_status == "correct":
                total_attempted += 1
                total_correct += 1
            elif result_status == "incorrect":
                total_attempted += 1
                total_incorrect += 1
            else:
                total_unattempted += 1

            # Global Section aggregation
            if q.section not in section_accum:
                section_order.append(q.section)
                section_accum[q.section] = {
                    "total_questions": 0,
                    "attempted": 0,
                    "correct": 0,
                    "incorrect": 0,
                    "unattempted": 0,
                    "positive_score": 0.0,
                    "negative_penalty": 0.0,
                    "max_score": 0.0,
                    "time_spent_sec": 0,
                }
            sec_stats = section_accum[q.section]
            sec_stats["total_questions"] += 1
            sec_stats["max_score"] += exam.positive_marks
            sec_stats["time_spent_sec"] += time_spent
            if result_status == "correct":
                sec_stats["attempted"] += 1
                sec_stats["correct"] += 1
                sec_stats["positive_score"] += exam.positive_marks
            elif result_status == "incorrect":
                sec_stats["attempted"] += 1
                sec_stats["incorrect"] += 1
                sec_stats["negative_penalty"] += exam.negative_marks
            else:
                sec_stats["unattempted"] += 1

            # Global Topic aggregation
            if q.topic not in topic_accum:
                topic_accum[q.topic] = {
                    "section": q.section,
                    "sub_topics": [],
                    "total_questions": 0,
                    "attempted": 0,
                    "correct": 0,
                    "incorrect": 0,
                    "unattempted": 0,
                    "score": 0.0,
                    "max_score": 0.0,
                    "total_time_sec": 0,
                }
            top_stats = topic_accum[q.topic]
            if q.sub_topic and q.sub_topic not in top_stats["sub_topics"]:
                top_stats["sub_topics"].append(q.sub_topic)
            top_stats["total_questions"] += 1
            top_stats["max_score"] += exam.positive_marks
            top_stats["total_time_sec"] += time_spent
            top_stats["score"] += marks_awarded
            if result_status == "correct":
                top_stats["attempted"] += 1
                top_stats["correct"] += 1
            elif result_status == "incorrect":
                top_stats["attempted"] += 1
                top_stats["incorrect"] += 1
            else:
                top_stats["unattempted"] += 1

    sectional_breakdown: List[SectionalBreakdownItem] = []
    for sec_name in section_order:
        s = section_accum[sec_name]
        sec_pos = round(s["positive_score"], 4)
        sec_neg = round(s["negative_penalty"], 4)
        sec_score = round(sec_pos - sec_neg, 4)
        sec_max = round(s["max_score"], 4)
        sec_acc = (
            round((s["correct"] / s["attempted"]) * 100.0, 2) if s["attempted"] > 0 else 0.0
        )
        sec_avg_time = (
            round(s["time_spent_sec"] / s["total_questions"], 2)
            if s["total_questions"] > 0
            else 0.0
        )
        sectional_breakdown.append(
            SectionalBreakdownItem(
                section=sec_name,
                total_questions=s["total_questions"],
                attempted=s["attempted"],
                correct=s["correct"],
                incorrect=s["incorrect"],
                unattempted=s["unattempted"],
                positive_score=sec_pos,
                negative_penalty=sec_neg,
                score=sec_score,
                max_score=sec_max,
                accuracy_pct=sec_acc,
                time_spent_sec=s["time_spent_sec"],
                avg_time_sec=sec_avg_time,
            )
        )

    action_matrix = _build_topic_action_matrix(topic_accum)

    # Top Weak Topics: sorted by lowest accuracy_pct first, then highest incorrect count, then highest avg_time_sec
    top_weak_topics = sorted(
        action_matrix.topics,
        key=lambda t: (t.accuracy_pct, -t.incorrect, -t.avg_time_sec),
    )[:10]

    # Top Slow Topics: sorted by highest avg_time_sec descending
    top_slow_topics = sorted(
        action_matrix.topics,
        key=lambda t: (-t.avg_time_sec, -t.total_time_sec),
    )[:10]

    overall_accuracy_pct = (
        round((total_correct / total_attempted) * 100.0, 2) if total_attempted > 0 else 0.0
    )
    scores = [pt.total_score for pt in score_trend]
    average_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    highest_score = max(scores) if scores else None
    avg_time_per_question_sec = (
        round(total_time_spent_sec / total_questions_seen, 2)
        if total_questions_seen > 0
        else 0.0
    )

    overall_summary = GlobalOverviewSummary(
        total_completed_attempts=len(score_trend),
        total_exams_attempted=len(exam_ids_seen),
        total_questions_seen=total_questions_seen,
        total_attempted=total_attempted,
        total_correct=total_correct,
        total_incorrect=total_incorrect,
        total_unattempted=total_unattempted,
        overall_accuracy_pct=overall_accuracy_pct,
        average_score=average_score,
        highest_score=highest_score,
        total_time_spent_sec=total_time_spent_sec,
        avg_time_per_question_sec=avg_time_per_question_sec,
    )

    return GlobalAnalyticsOverviewResponse(
        overall_summary=overall_summary,
        score_trend=score_trend,
        sectional_breakdown=sectional_breakdown,
        action_matrix=action_matrix,
        top_weak_topics=top_weak_topics,
        top_slow_topics=top_slow_topics,
    )
