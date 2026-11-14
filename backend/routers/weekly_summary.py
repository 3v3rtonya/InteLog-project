"""
weekly_summary.py - Weekly summary CRUD for interns, with review by supervisors
and read access for lecturers and admins.
"""
import math
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, WeeklySummary, Notification, LecturerInternAssignment
from backend.schemas import (
    WeeklySummaryCreate, WeeklySummaryUpdate,
    WeeklySummaryReviewRequest, WeeklySummaryResponse,
)
from backend.dependencies import require_role, get_current_user

router = APIRouter(tags=["weekly-summary"])


def _week_start(d: date) -> date:
    """Return the Monday of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


def _notify(db, user_id, ntype, title, body, link_id=None):
    db.add(Notification(user_id=user_id, type=ntype, title=title, body=body,
                        link_id=link_id, link_type="weekly_summary"))


def _paginate(query, page, page_size):
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if total > 0 else 1}


# ── Intern ─────────────────────────────────────────────────────────────────────

@router.post("/weekly-summary", response_model=WeeklySummaryResponse, status_code=201)
def create_summary(
    payload: WeeklySummaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    today = date.today()
    week_start = _week_start(today)
    week_end = week_start + timedelta(days=6)

    existing = db.query(WeeklySummary).filter(
        WeeklySummary.intern_id == current_user.id,
        WeeklySummary.week_start_date == week_start,
    ).first()
    if existing:
        raise HTTPException(409, "A summary for this week already exists")

    summary = WeeklySummary(
        intern_id=current_user.id,
        supervisor_id=current_user.supervisor_id,
        week_start_date=week_start,
        week_end_date=week_end,
        summary_text=payload.summary_text,
        status="draft",
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


@router.get("/weekly-summary", response_model=dict)
def list_my_summaries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    q = db.query(WeeklySummary).filter(
        WeeklySummary.intern_id == current_user.id
    ).order_by(WeeklySummary.week_start_date.desc())
    result = _paginate(q, page, page_size)
    result["items"] = [WeeklySummaryResponse.model_validate(s) for s in result["items"]]
    return result


@router.get("/weekly-summary/{summary_id}", response_model=WeeklySummaryResponse)
def get_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(WeeklySummary).filter(WeeklySummary.id == summary_id).first()
    if not s:
        raise HTTPException(404, "Summary not found")
    if current_user.role == "intern" and s.intern_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    return s


@router.put("/weekly-summary/{summary_id}", response_model=WeeklySummaryResponse)
def update_summary(
    summary_id: UUID,
    payload: WeeklySummaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    s = db.query(WeeklySummary).filter(
        WeeklySummary.id == summary_id,
        WeeklySummary.intern_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(404, "Summary not found")
    if s.status != "draft":
        raise HTTPException(400, "Only draft summaries can be edited")
    s.summary_text = payload.summary_text
    db.commit()
    db.refresh(s)
    return s


@router.post("/weekly-summary/{summary_id}/submit", response_model=WeeklySummaryResponse)
def submit_summary(
    summary_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    s = db.query(WeeklySummary).filter(
        WeeklySummary.id == summary_id,
        WeeklySummary.intern_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(404, "Summary not found")
    if s.status != "draft":
        raise HTTPException(400, "Only draft summaries can be submitted")

    s.status = "pending"
    s.submitted_at = datetime.now(timezone.utc)
    db.flush()

    if current_user.supervisor_id:
        _notify(db, current_user.supervisor_id, "weekly_summary_submitted",
                f"Weekly Summary submitted - {current_user.full_name}",
                f"{current_user.full_name} submitted their weekly summary for "
                f"{s.week_start_date} to {s.week_end_date}.",
                link_id=s.id)
    db.commit()
    db.refresh(s)
    return s


# ── Supervisor ──────────────────────────────────────────────────────────────────

@router.get("/supervisor/weekly-summaries")
def supervisor_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intern_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    q = db.query(WeeklySummary).filter(
        WeeklySummary.supervisor_id == current_user.id
    )
    if intern_id:
        q = q.filter(WeeklySummary.intern_id == intern_id)
    q = q.order_by(WeeklySummary.submitted_at.desc().nullslast())
    result = _paginate(q, page, page_size)
    result["items"] = [WeeklySummaryResponse.model_validate(s) for s in result["items"]]
    return result


@router.post("/supervisor/weekly-summaries/{summary_id}/review",
             response_model=WeeklySummaryResponse)
def supervisor_review(
    summary_id: UUID,
    payload: WeeklySummaryReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    s = db.query(WeeklySummary).filter(WeeklySummary.id == summary_id).first()
    if not s:
        raise HTTPException(404, "Summary not found")
    if s.supervisor_id != current_user.id:
        raise HTTPException(403, "This summary does not belong to one of your interns")

    s.supervisor_feedback = payload.feedback
    s.supervisor_grade = payload.grade
    s.status = payload.decision
    s.reviewed_at = datetime.now(timezone.utc)
    db.flush()

    _notify(db, s.intern_id, "weekly_summary_reviewed",
            f"Weekly summary {payload.decision}",
            f"Your weekly summary for {s.week_start_date} to {s.week_end_date} "
            f"has been {payload.decision} by your supervisor.",
            link_id=s.id)
    db.commit()
    db.refresh(s)
    return s


# ── Lecturer ───────────────────────────────────────────────────────────────────

@router.get("/lecturer/weekly-summaries")
def lecturer_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intern_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("lecturer")),
):
    cohort_ids = [r.intern_id for r in db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.lecturer_id == current_user.id
    ).all()]
    q = db.query(WeeklySummary).filter(WeeklySummary.intern_id.in_(cohort_ids))
    if intern_id:
        if intern_id not in cohort_ids:
            raise HTTPException(403, "That intern is not in your cohort")
        q = q.filter(WeeklySummary.intern_id == intern_id)
    q = q.order_by(WeeklySummary.submitted_at.desc().nullslast())
    result = _paginate(q, page, page_size)
    result["items"] = [WeeklySummaryResponse.model_validate(s) for s in result["items"]]
    return result


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/admin/weekly-summaries")
def admin_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = db.query(WeeklySummary).order_by(WeeklySummary.submitted_at.desc().nullslast())
    result = _paginate(q, page, page_size)
    result["items"] = [WeeklySummaryResponse.model_validate(s) for s in result["items"]]
    return result