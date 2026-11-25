"""
admin.py - Admin portal routes.

Permissions:
  - Full user CRUD for all roles
  - Create lecturer accounts
  - Assign interns to lecturers
  - View all logs & flagged logs (system-wide)
  - Legacy site management

Approval of intern/supervisor auto-linking has moved to lecturer.py.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import math

from backend.database import get_db
from backend.models import User, LogbookEntry, Notification, LecturerInternAssignment
from backend.schemas import (
    UserResponse, UserCreateRequest, UserUpdateRequest,
AssignInternRequest, BulkAssignInternRequest,
    LogResponse,
    RepairLinkRequest, LecturerInternAssignmentResponse,
)
from backend.services.auth_service import hash_password
from backend.services.email_service import send_approval_email
from backend.dependencies import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])

# The seeded system admin - protected from deletion and self-demotion
SYSTEM_ADMIN_EMAIL = "admin@mis.local"


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


#  Pending requests (unassigned  waiting for admin to assign to lecturer) 

@router.get("/pending-requests")
def get_pending_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    Returns interns/supervisors in pending or waiting status
    that have not yet been assigned to a lecturer.
    """
    # Subquery: intern IDs that are already assigned to a lecturer
    assigned_intern_ids = db.query(LecturerInternAssignment.intern_id).subquery()

    query = db.query(User).filter(
        User.status.in_(["pending", "waiting"]),
        User.role.in_(["intern", "supervisor"]),
        ~User.id.in_(assigned_intern_ids),
    )
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


#  Assign intern to lecturer 

@router.post("/assign-intern", response_model=LecturerInternAssignmentResponse, status_code=201)
def assign_intern_to_lecturer(
    payload: AssignInternRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin assigns a single intern to a lecturer."""
    intern = db.query(User).filter(User.id == payload.intern_id, User.role == "intern").first()
    if not intern:
        raise HTTPException(404, "Intern not found")

    lecturer = db.query(User).filter(
        User.id == payload.lecturer_id, User.role == "lecturer"
    ).first()
    if not lecturer:
        raise HTTPException(404, "Lecturer not found")

    # Remove existing assignment if any
    existing = db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.intern_id == payload.intern_id
    ).first()
    if existing:
        db.delete(existing)
        db.flush()

    assignment = LecturerInternAssignment(
        lecturer_id=payload.lecturer_id,
        intern_id=payload.intern_id,
        assigned_by=admin.id,
    )
    db.add(assignment)

    # Notify the lecturer
    _notify(
        db, lecturer.id, "new_signup",
        f"Intern Assigned  {intern.full_name}",
        f"Admin has assigned intern {intern.full_name} "
        f"({intern.school} / {intern.department}) to your cohort.",
        link_id=intern.id, link_type="user",
    )

    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/assign-interns/bulk", status_code=201)
def bulk_assign_interns(
    payload: BulkAssignInternRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin bulk-assigns multiple interns to a lecturer."""
    lecturer = db.query(User).filter(
        User.id == payload.lecturer_id, User.role == "lecturer"
    ).first()
    if not lecturer:
        raise HTTPException(404, "Lecturer not found")

    results = []
    for intern_id in payload.intern_ids:
        intern = db.query(User).filter(User.id == intern_id, User.role == "intern").first()
        if not intern:
            continue

        existing = db.query(LecturerInternAssignment).filter(
            LecturerInternAssignment.intern_id == intern_id
        ).first()
        if existing:
            existing.lecturer_id = payload.lecturer_id
            existing.assigned_by = admin.id
        else:
            assignment = LecturerInternAssignment(
                lecturer_id=payload.lecturer_id,
                intern_id=intern_id,
                assigned_by=admin.id,
            )
            db.add(assignment)

        _notify(
            db, lecturer.id, "new_signup",
            f"Intern Assigned  {intern.full_name}",
            f"Admin has assigned intern {intern.full_name} to your cohort.",
            link_id=intern.id, link_type="user",
        )
        results.append(str(intern_id))

    db.commit()
    return {"assigned": results, "lecturer_id": str(payload.lecturer_id)}


@router.delete("/assign-intern/{intern_id}", status_code=204)
def unassign_intern(
    intern_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Remove an intern's lecturer assignment (intern goes back to unassigned queue)."""
    assignment = db.query(LecturerInternAssignment).filter(
        LecturerInternAssignment.intern_id == intern_id
    ).first()
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    db.delete(assignment)
    db.commit()


#  Repair link (admin override) 

@router.post("/repair-link", response_model=UserResponse)
def repair_link(
    payload: RepairLinkRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin manually re-pairs an intern to a different supervisor."""
    intern = db.query(User).filter(User.id == payload.intern_id, User.role == "intern").first()
    if not intern:
        raise HTTPException(404, "Intern not found")

    supervisor = db.query(User).filter(
        User.id == payload.supervisor_id, User.role == "supervisor"
    ).first()
    if not supervisor:
        raise HTTPException(404, "Supervisor not found")

    intern.supervisor_id = payload.supervisor_id
    intern.student_id_status = "linked"
    supervisor.student_id_status = "linked"

    db.commit()
    db.refresh(intern)

    _notify(db, intern.id, "pairing_approved",
            "Your supervisor has been updated",
            f"The university has re-assigned your supervisor to {supervisor.full_name}.",
            link_id=intern.id, link_type="user")
    db.commit()
    return intern


#  Users CRUD 

@router.get("/users")
def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None),
    user_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    school: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if user_status:
        statuses = [s.strip() for s in str(user_status).split(',') if s.strip()]
        if len(statuses) > 1:
            query = query.filter(User.status.in_(statuses))
        else:
            query = query.filter(User.status == statuses[0])
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    if school:
        query = query.filter(User.school == school)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        status="active",
        school=payload.school,
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete your own account")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    if target.email == SYSTEM_ADMIN_EMAIL:
        raise HTTPException(403, "The system administrator account cannot be deleted")
    db.delete(target)
    db.commit()






# -- Approve any pending account (intern, supervisor, lecturer) -------------------

@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin activates any pending/waiting account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.status == "active":
        raise HTTPException(400, "Account is already active")
    user.status = "active"
    db.commit()
    db.refresh(user)
    _notify(
        db, user.id, "account_approved",
        "Your account has been activated",
        f"Your {user.role} account has been approved by the administrator. You can now log in.",
        link_id=user.id, link_type="user",
    )
    db.commit()
    return user


@router.post("/users/{user_id}/promote-coordinator", response_model=UserResponse)
def promote_coordinator(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Promote an active lecturer to coordinator role."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role != "lecturer":
        raise HTTPException(400, "Only lecturers can be promoted to coordinator")
    if user.status != "active":
        raise HTTPException(400, "User must be active to be promoted")
    if user.is_coordinator:
        raise HTTPException(400, "User is already a coordinator")
    user.is_coordinator = True
    db.commit()
    db.refresh(user)
    _notify(db, user.id, "coordinator_promoted",
            "You have been promoted to Coordinator",
            "You now have coordinator privileges. You can approve accounts, manage users in your school, and allocate interns.",
            link_id=user.id, link_type="user")
    db.commit()
    return user


@router.post("/users/{user_id}/demote-coordinator", response_model=UserResponse)
def demote_coordinator(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove coordinator privileges from a lecturer."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if not user.is_coordinator:
        raise HTTPException(400, "User is not a coordinator")
    if user.email == SYSTEM_ADMIN_EMAIL:
        raise HTTPException(403, "Cannot modify the system administrator")
    user.is_coordinator = False
    db.commit()
    db.refresh(user)
    return user


#  All intern logs (admin view  system-wide) 

@router.get("/logs")
def get_all_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    intern_id: Optional[UUID] = Query(None),
    log_status: Optional[str] = Query(None, alias="status"),
    is_flagged: Optional[bool] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    school: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    query = db.query(LogbookEntry)
    if intern_id:
        query = query.filter(LogbookEntry.intern_id == intern_id)
    if log_status:
        query = query.filter(LogbookEntry.status == log_status)
    if is_flagged is not None:
        query = query.filter(LogbookEntry.is_flagged == is_flagged)
    if date_from:
        query = query.filter(LogbookEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(LogbookEntry.entry_date <= date_to)
    if school:
        intern_ids = db.query(User.id).filter(User.school == school, User.role == "intern")
        query = query.filter(LogbookEntry.intern_id.in_(intern_ids))

    total = query.count()
    logs = query.order_by(LogbookEntry.entry_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }


@router.get("/logs/{log_id}", response_model=LogResponse)
def get_log_detail(
    log_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    log = db.query(LogbookEntry).filter(LogbookEntry.id == log_id).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    return log


@router.get("/flagged-logs")
def get_flagged_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    Returns flagged logs belonging ONLY to interns not yet assigned to a lecturer.
    Interns assigned to a lecturer fall under that lecturer's flagged-logs view.
    """
    # Intern IDs that ARE assigned to a lecturer
    assigned_intern_ids = db.query(LecturerInternAssignment.intern_id).subquery()

    query = db.query(LogbookEntry).filter(
        LogbookEntry.is_flagged == True,
        LogbookEntry.intern_id.notin_(assigned_intern_ids),
    )
    total = query.count()
    logs = query.order_by(LogbookEntry.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LogResponse.model_validate(log) for log in logs],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    }
