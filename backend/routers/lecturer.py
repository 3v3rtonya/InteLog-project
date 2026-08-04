"""
lecturer.py - Lecturer portal routes.

Permissions:
  - Approve intern/supervisor auto-linking for their assigned cohort
  - View all logs for their assigned interns (cohort scope)
  - View flagged logs for their cohort
  - View their assigned intern list (name, course, student ID, department)

Lecturers do NOT approve/reject individual log entries — that stays with supervisors.
Geofence pinning/re-pinning is done by supervisors only.
"""
import math
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, LogbookEntry, Notification, LecturerInternAssignment
from backend.schemas import (
    UserResponse, LogResponse, ApproveInternRequest,
)
from backend.services.email_service import send_approval_email
from backend.dependencies import get_current_lecturer

router = APIRouter(prefix="/lecturer", tags=["lecturer"])


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


def _get_cohort_intern_ids(db: Session, lecturer_id: UUID) -> list:
    """Return list of intern UUIDs assigned to this lecturer."""
    rows = db.query(LecturerInternAssignment.intern_id).filter(
        LecturerInternAssignment.lecturer_id == lecturer_id
    ).all()
    return [r.intern_id for r in rows]


# ── My cohort ─────────────────────────────────────────────────────────────────

@router.get("/my-interns")
def get_my_interns(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """
    List all interns assigned to this lecturer with their
    full name, course/department, student ID, status and supervisor.
    """
    intern_ids = _get_cohort_intern_ids(db, current_user.id)
    if not intern_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    query = db.query(User).filter(User.id.in_(intern_ids), User.role == "intern")
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") |
            User.student_id.ilike(f"%{search}%") |
            User.department.ilike(f"%{search}%")
        )
    total = query.count()
    interns = query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in interns],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


# ── Pending linking approvals ─────────────────────────────────────────────────

@router.get("/pending-links")
def get_pending_links(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """
    Returns assigned interns whose intern/supervisor pair is linked
    but not yet approved (status=pending), scoped to this lecturer's cohort.
    """
    intern_ids = _get_cohort_intern_ids(db, current_user.id)
    if not intern_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    query = db.query(User).filter(
        User.id.in_(intern_ids),
        User.role == "intern",
        User.status == "pending",
        User.supervisor_id.isnot(None),        # supervisor is already linked
        User.student_id_status == "linked",    # auto-linking has happened
    )
    total = query.count()
    interns = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in interns],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.post("/approve-link", response_model=UserResponse)
def approve_intern_link(
    payload: ApproveInternRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """
    Lecturer approves the intern/supervisor pairing for one of their assigned interns.
    Both intern and supervisor are set to active.
    """
    # Verify intern is in this lecturer's cohort
    assignment = db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.intern_id == payload.intern_id,
        LecturerInternAssignment.lecturer_id == current_user.id,
    ).first()
    if not assignment:
        raise HTTPException(403, "This intern is not in your cohort")

    intern = db.query(User).filter(User.id == payload.intern_id).first()
    if not intern:
        raise HTTPException(404, "Intern not found")
    if intern.role != "intern":
        raise HTTPException(400, "Selected user is not an intern")
    if intern.status not in ("pending", "waiting"):
        raise HTTPException(400, "Intern is not in a pending state")
    if not intern.supervisor_id:
        raise HTTPException(400, "Intern has no linked supervisor yet — cannot approve")

    supervisor = db.query(User).filter(
        User.id == intern.supervisor_id, User.role == "supervisor"
    ).first()
    if not supervisor:
        raise HTTPException(404, "Linked supervisor not found")

    # Activate both
    intern.status = "active"
    intern.student_id_status = "linked"
    supervisor.status = "active"
    supervisor.student_id_status = "linked"

    db.commit()
    db.refresh(intern)
    db.refresh(supervisor)

    send_approval_email(intern.email, intern.full_name)
    send_approval_email(supervisor.email, supervisor.full_name, role="supervisor")

    _notify(db, intern.id, "pairing_approved",
            "Your account is now active! 🎉",
            "Your account has been approved by your university lecturer. "
            "You can now submit logbook entries.",
            link_id=intern.id, link_type="user")
    _notify(db, supervisor.id, "pairing_approved",
            "Your supervisor account is now active! 🎉",
            f"Your account has been approved. You are now linked to intern {intern.full_name}.",
            link_id=supervisor.id, link_type="user")
    db.commit()
    return intern


# ── Cohort logs ───────────────────────────────────────────────────────────────

@router.get("/logs")
def get_cohort_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intern_id: Optional[UUID] = Query(None),
    log_status: Optional[str] = Query(None, alias="status"),
    is_flagged: Optional[bool] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """View logs for all interns in this lecturer's cohort."""
    intern_ids = _get_cohort_intern_ids(db, current_user.id)
    if not intern_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    query = db.query(LogbookEntry).filter(LogbookEntry.intern_id.in_(intern_ids))

    # Optional: scope to a specific intern in the cohort
    if intern_id:
        if intern_id not in intern_ids:
            raise HTTPException(403, "That intern is not in your cohort")
        query = query.filter(LogbookEntry.intern_id == intern_id)
    if log_status:
        query = query.filter(LogbookEntry.status == log_status)
    if is_flagged is not None:
        query = query.filter(LogbookEntry.is_flagged == is_flagged)
    if date_from:
        query = query.filter(LogbookEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(LogbookEntry.entry_date <= date_to)

    total = query.count()
    logs = query.order_by(LogbookEntry.entry_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.get("/logs/{log_id}", response_model=LogResponse)
def get_cohort_log_detail(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """Lecturer views a single log entry — must belong to their cohort."""
    intern_ids = _get_cohort_intern_ids(db, current_user.id)
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id,
        LogbookEntry.intern_id.in_(intern_ids),
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found or not in your cohort")
    return log


@router.get("/flagged-logs")
def get_flagged_cohort_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_lecturer),
):
    """View flagged logs for this lecturer's cohort."""
    intern_ids = _get_cohort_intern_ids(db, current_user.id)
    if not intern_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    query = db.query(LogbookEntry).filter(
        LogbookEntry.intern_id.in_(intern_ids),
        LogbookEntry.is_flagged == True,
    )
    total = query.count()
    logs = query.order_by(LogbookEntry.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }
