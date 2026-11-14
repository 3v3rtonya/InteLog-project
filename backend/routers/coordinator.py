"""
coordinator.py - Coordinator portal routes.

Coordinators are active lecturers with is_coordinator=True.
They have admin-like privileges scoped to their own school/department.

Permissions:
- See all users in their school
- Approve pending/waiting intern and supervisor accounts (both)
- Approve pending lecturer accounts
- Allocate interns to lecturers from CSV (same pre-register workflow)
- View all logs for their school
- View flagged logs for their school
- Cannot promote/demote coordinators
- Cannot delete/suspend admin
"""
import math
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, LogbookEntry, Notification, LecturerInternAssignment
from backend.schemas import UserResponse, LogResponse
from backend.services.email_service import send_approval_email
from backend.dependencies import get_current_admin_or_coordinator
from backend.config import settings

SYSTEM_ADMIN_EMAIL = "admin@mis.local"

router = APIRouter(prefix="/coordinator", tags=["coordinator"])


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


def _school_filter(query, current_user, model, school_field):
    """Scope query to coordinator's school, unless admin (sees all)."""
    if current_user.role == "admin":
        return query
    if current_user.school:
        return query.filter(school_field == current_user.school)
    return query


# -- Dashboard stats ----------------------------------------------------------

@router.get("/stats")
def get_coordinator_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """Summary counts scoped to coordinator's school."""
    def school_q(model, school_field):
        q = db.query(model)
        if current_user.role == "lecturer" and current_user.school:
            q = q.filter(school_field == current_user.school)
        return q

    pending_approvals = school_q(User, User.school).filter(
        User.status.in_(["pending", "waiting"])
    ).count()

    active_interns = school_q(User, User.school).filter(
        User.role == "intern", User.status == "active"
    ).count()

    active_lecturers = school_q(User, User.school).filter(
        User.role == "lecturer", User.status == "active"
    ).count()

    # Flagged logs
    logs_q = db.query(LogbookEntry).filter(LogbookEntry.is_flagged == True)
    if current_user.role == "lecturer" and current_user.school:
        intern_ids = db.query(User.id).filter(
            User.school == current_user.school, User.role == "intern"
        )
        logs_q = logs_q.filter(LogbookEntry.intern_id.in_(intern_ids))
    flagged_logs = logs_q.count()

    return {
        "pending_approvals": pending_approvals,
        "active_interns": active_interns,
        "active_lecturers": active_lecturers,
        "flagged_logs": flagged_logs,
    }


# -- Users in school ----------------------------------------------------------

@router.get("/users")
def get_school_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None),
    user_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """List users scoped to coordinator's school."""
    query = db.query(User)
    if current_user.role == "lecturer":  # coordinator scoped
        query = query.filter(User.school == current_user.school)
    if role:
        query = query.filter(User.role == role)
    if user_status:
        query = query.filter(User.status == user_status)
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


# -- Pending approvals --------------------------------------------------------

@router.get("/pending")
def get_pending(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """Pending intern, supervisor, and lecturer accounts for coordinator's school."""
    query = db.query(User).filter(User.status.in_(["pending", "waiting"]))
    if current_user.role == "lecturer":
        query = query.filter(User.school == current_user.school)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.post("/approve/{user_id}", response_model=UserResponse)
def coordinator_approve(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """Approve any pending/waiting account (intern, supervisor, or lecturer)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.status == "active":
        raise HTTPException(400, "Account is already active")
    # Coordinators can only approve within their school
    if current_user.role == "lecturer" and current_user.school:
        if user.school != current_user.school and user.role != "supervisor":
            raise HTTPException(403, "Cannot approve users outside your school")

    user.status = "active"
    db.commit()
    db.refresh(user)

    _notify(db, user.id, "account_approved",
            "Your account has been activated",
            f"Your {user.role} account has been approved. You can now log in.",
            link_id=user.id, link_type="user")
    db.commit()

    # Send approval email
    try:
        send_approval_email(user.email, user.full_name, user.role)
    except Exception:
        pass

    return user


# -- Intern allocation (same pre-register CSV) --------------------------------

@router.post("/assign-intern", response_model=dict)
def coordinator_assign_intern(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """Assign a single intern to a lecturer. Same as admin assign-intern."""
    intern_id = payload.get("intern_id")
    lecturer_id = payload.get("lecturer_id")
    if not intern_id or not lecturer_id:
        raise HTTPException(400, "intern_id and lecturer_id are required")

    intern = db.query(User).filter(User.id == intern_id, User.role == "intern").first()
    if not intern:
        raise HTTPException(404, "Intern not found")
    lecturer = db.query(User).filter(User.id == lecturer_id, User.role == "lecturer").first()
    if not lecturer:
        raise HTTPException(404, "Lecturer not found")

    # Coordinator can only assign within their school
    if current_user.role == "lecturer" and current_user.school:
        if intern.school != current_user.school:
            raise HTTPException(403, "Cannot assign interns outside your school")

    existing = db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.intern_id == intern.id
    ).first()
    if existing:
        existing.lecturer_id = lecturer_id
        existing.assigned_by = current_user.id
    else:
        db.add(LecturerInternAssignment(
            lecturer_id=lecturer_id,
            intern_id=intern.id,
            assigned_by=current_user.id,
        ))

    _notify(db, lecturer.id, "new_signup",
            f"Intern Assigned - {intern.full_name}",
            f"Coordinator {current_user.full_name} has assigned intern {intern.full_name} to your cohort.",
            link_id=intern.id, link_type="user")
    db.commit()
    return {"assigned": str(intern.id), "lecturer_id": str(lecturer_id)}


# -- Logs for school ----------------------------------------------------------

@router.get("/logs")
def get_school_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intern_id: Optional[UUID] = Query(None),
    log_status: Optional[str] = Query(None, alias="status"),
    is_flagged: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_or_coordinator),
):
    """All logs scoped to coordinator's school."""
    query = db.query(LogbookEntry)

    if current_user.role == "lecturer" and current_user.school:
        intern_ids = db.query(User.id).filter(
            User.school == current_user.school, User.role == "intern"
        )
        query = query.filter(LogbookEntry.intern_id.in_(intern_ids))

    if intern_id:
        query = query.filter(LogbookEntry.intern_id == intern_id)
    if log_status:
        query = query.filter(LogbookEntry.status == log_status)
    if is_flagged is not None:
        query = query.filter(LogbookEntry.is_flagged == is_flagged)

    total = query.count()
    logs = query.order_by(LogbookEntry.entry_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }
