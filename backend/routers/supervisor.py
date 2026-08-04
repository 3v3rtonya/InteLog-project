"""
supervisor.py - Supervisor portal routes.
OTP has been removed. Approvals go through the notification bell.
"""
import math
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, LogbookEntry, Notification
from backend.schemas import (
    UserResponse, UserUpdateRequest, LogResponse, RejectLogRequest
)
from backend.dependencies import require_role

router = APIRouter(prefix="/supervisor", tags=["supervisor"])


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


@router.get("/pending-logs")
def get_pending_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    query = db.query(LogbookEntry).filter(
        LogbookEntry.supervisor_id == current_user.id,
        LogbookEntry.status == "pending_approval",
    )
    total = query.count()
    logs = query.order_by(LogbookEntry.submitted_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.post("/approve-log/{log_id}")
def approve_log(
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    """Approve a log entry directly — no OTP required."""
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id,
        LogbookEntry.supervisor_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    if log.status != "pending_approval":
        raise HTTPException(400, "Log is not pending approval")

    log.status = "approved"
    log.approved_at = datetime.now(timezone.utc)

    # Notify the intern
    _notify(
        db, log.intern_id, "log_approved",
        "Your log has been approved! ✅",
        f"Your logbook entry for {log.entry_date} has been approved by your supervisor.",
        link_id=log.id, link_type="log",
    )

    db.commit()
    return {"message": "Log entry approved successfully", "log_id": str(log_id)}


@router.post("/reject-log/{log_id}")
def reject_log(
    log_id: UUID,
    payload: RejectLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id,
        LogbookEntry.supervisor_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    if log.status not in ("pending_approval",):
        raise HTTPException(400, "Log cannot be rejected in its current state")

    log.status = "rejected"
    log.flag_reason = payload.reason

    # Notify intern
    _notify(
        db, log.intern_id, "log_rejected",
        "Your log was returned ❌",
        f"Your logbook entry for {log.entry_date} was returned by your supervisor. "
        f"Reason: {payload.reason}",
        link_id=log.id, link_type="log",
    )

    # Notify all admins
    admins = db.query(User).filter(User.role == "admin", User.status == "active").all()
    for admin in admins:
        _notify(
            db, admin.id, "log_rejected",
            f"Log Rejected — {log.entry_date}",
            f"Supervisor {current_user.full_name} rejected a log from intern "
            f"{log.intern.full_name if log.intern else 'unknown'}. Reason: {payload.reason}",
            link_id=log.id, link_type="log",
        )

    db.commit()
    return {"message": "Log entry rejected", "log_id": str(log_id)}


@router.get("/interns")
def get_interns(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    interns = db.query(User).filter(
        User.supervisor_id == current_user.id, User.role == "intern",
    ).all()
    return [UserResponse.model_validate(u) for u in interns]


@router.put("/interns/{intern_id}", response_model=UserResponse)
def update_intern(
    intern_id: UUID,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    intern = db.query(User).filter(
        User.id == intern_id,
        User.supervisor_id == current_user.id,
        User.role == "intern",
    ).first()
    if not intern:
        raise HTTPException(404, "Intern not found")

    allowed = {"full_name", "phone"}
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k in allowed:
            setattr(intern, k, v)

    db.commit()
    db.refresh(intern)
    return intern


@router.delete("/interns/{intern_id}", status_code=status.HTTP_204_NO_CONTENT)
def suspend_intern(
    intern_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    intern = db.query(User).filter(
        User.id == intern_id,
        User.supervisor_id == current_user.id,
        User.role == "intern",
    ).first()
    if not intern:
        raise HTTPException(404, "Intern not found")
    intern.status = "suspended"
    db.commit()
