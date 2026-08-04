"""
attendance.py — Attachment period, absence requests, and attendance stats.

Rules:
- Intern can set/update attachment dates up to 3 times (date_change_count).
- Supervisor can update attachment dates without limit.
- Absence requests are submitted by interns from anywhere (no geofence).
- emergency type is auto-acknowledged by the system.
- Attendance stats compute working days, absences, and unexplained gaps.
- Intern dashboard is read-only for 3 days after attachment_end, then locked.
"""
import math
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AbsenceRequest, LogbookEntry, NonWorkingDay, Notification
from backend.schemas import (
    AttachmentDatesRequest, AttachmentDatesResponse,
    AbsenceRequestCreate, AbsenceRequestResponse,
    AttendanceStats, DayStatus,
)
from backend.dependencies import get_current_user, require_role

router = APIRouter(prefix="/attendance", tags=["attendance"])

MAX_INTERN_DATE_CHANGES = 3
GRACE_HOURS = 48
READ_ONLY_DAYS_AFTER_END = 3


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5  # Saturday=5, Sunday=6


def _is_holiday(d: date, holiday_dates: set) -> bool:
    return d in holiday_dates


def _get_holiday_dates(db: Session, year: int) -> set:
    rows = db.query(NonWorkingDay.date).filter(NonWorkingDay.year == year).all()
    return {r.date for r in rows}


def _is_non_working(d: date, holiday_dates: set) -> bool:
    return _is_weekend(d) or _is_holiday(d, holiday_dates)


def _intern_period_status(intern: User, today: date) -> str:
    """
    Returns:
      'no_dates'    — attachment dates not set
      'before'      — today is before attachment_start
      'active'      — within attachment period
      'read_only'   — up to 3 days after attachment_end
      'expired'     — more than 3 days after attachment_end
    """
    if not intern.attachment_start or not intern.attachment_end:
        return "no_dates"
    if today < intern.attachment_start:
        return "before"
    if today <= intern.attachment_end:
        return "active"
    days_after = (today - intern.attachment_end).days
    if days_after <= READ_ONLY_DAYS_AFTER_END:
        return "read_only"
    return "expired"


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


# ── Attachment dates ────────────────────────────────────────────────────────────

@router.get("/dates", response_model=AttachmentDatesResponse)
def get_attachment_dates(
    current_user: User = Depends(require_role("intern")),
):
    return AttachmentDatesResponse(
        attachment_start=current_user.attachment_start,
        attachment_end=current_user.attachment_end,
        date_change_count=current_user.date_change_count,
        changes_remaining=max(0, MAX_INTERN_DATE_CHANGES - current_user.date_change_count),
    )


@router.put("/dates", response_model=AttachmentDatesResponse)
def set_attachment_dates(
    payload: AttachmentDatesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """Intern sets/updates their attachment period (max 3 changes)."""
    if current_user.date_change_count >= MAX_INTERN_DATE_CHANGES:
        raise HTTPException(
            403,
            f"You have used all {MAX_INTERN_DATE_CHANGES} date changes. "
            "Contact your supervisor to update your attachment dates."
        )
    if payload.attachment_end <= payload.attachment_start:
        raise HTTPException(400, "End date must be after start date")

    is_first = current_user.attachment_start is None
    current_user.attachment_start = payload.attachment_start
    current_user.attachment_end = payload.attachment_end
    if not is_first:
        current_user.date_change_count += 1

    db.commit()
    db.refresh(current_user)
    return AttachmentDatesResponse(
        attachment_start=current_user.attachment_start,
        attachment_end=current_user.attachment_end,
        date_change_count=current_user.date_change_count,
        changes_remaining=max(0, MAX_INTERN_DATE_CHANGES - current_user.date_change_count),
    )


@router.put("/dates/supervisor/{intern_id}", response_model=AttachmentDatesResponse)
def supervisor_set_dates(
    intern_id: UUID,
    payload: AttachmentDatesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    """Supervisor updates an intern's attachment dates — unlimited changes."""
    intern = db.query(User).filter(
        User.id == intern_id,
        User.supervisor_id == current_user.id,
        User.role == "intern",
    ).first()
    if not intern:
        raise HTTPException(404, "Intern not found under your supervision")
    if payload.attachment_end <= payload.attachment_start:
        raise HTTPException(400, "End date must be after start date")

    intern.attachment_start = payload.attachment_start
    intern.attachment_end = payload.attachment_end
    db.commit()
    db.refresh(intern)

    _notify(
        db, intern.id, "dates_updated",
        "Your attachment dates have been updated",
        f"Your supervisor updated your attachment period: "
        f"{payload.attachment_start} → {payload.attachment_end}.",
    )
    db.commit()
    return AttachmentDatesResponse(
        attachment_start=intern.attachment_start,
        attachment_end=intern.attachment_end,
        date_change_count=intern.date_change_count,
        changes_remaining=max(0, MAX_INTERN_DATE_CHANGES - intern.date_change_count),
    )


# ── Period status (used by frontend to gate dashboard) ─────────────────────────

@router.get("/period-status")
def get_period_status(
    current_user: User = Depends(require_role("intern")),
):
    today = date.today()
    ps = _intern_period_status(current_user, today)
    return {
        "status": ps,
        "attachment_start": current_user.attachment_start,
        "attachment_end": current_user.attachment_end,
        "date_change_count": current_user.date_change_count,
        "changes_remaining": max(0, MAX_INTERN_DATE_CHANGES - current_user.date_change_count),
        "read_only": ps in ("read_only", "expired"),
        "expired": ps == "expired",
    }


# ── Absence requests ────────────────────────────────────────────────────────────

@router.post("/absence", response_model=AbsenceRequestResponse, status_code=201)
def submit_absence(
    payload: AbsenceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """Intern submits an absence request — no geofence required."""
    # Must be within attachment period (or read-only window)
    today = date.today()
    ps = _intern_period_status(current_user, today)
    if ps in ("no_dates", "before"):
        raise HTTPException(400, "You can only submit absences during your attachment period.")
    if ps == "expired":
        raise HTTPException(400, "Your attachment period has ended. No new submissions allowed.")

    # Cannot be in the future (max 1 day ahead for half_day planning)
    if payload.date > today + timedelta(days=1):
        raise HTTPException(400, "Absence date cannot be more than 1 day in the future.")

    # No duplicate
    existing = db.query(AbsenceRequest).filter(
        AbsenceRequest.intern_id == current_user.id,
        AbsenceRequest.date == payload.date,
    ).first()
    if existing:
        raise HTTPException(409, f"An absence request for {payload.date} already exists.")

    # Emergency type — auto-acknowledge
    status = "acknowledged" if payload.type == "emergency" else "pending"
    acknowledged_at = datetime.now(timezone.utc) if payload.type == "emergency" else None

    absence = AbsenceRequest(
        intern_id=current_user.id,
        date=payload.date,
        type=payload.type,
        reason=payload.reason,
        status=status,
        acknowledged_at=acknowledged_at,
    )
    db.add(absence)
    db.flush()

    # Notify supervisor
    if current_user.supervisor_id:
        type_label = {
            "sick": "Sick Day 🤒",
            "day_off": "Day Off 🏖️",
            "emergency": "Emergency Absence ⚠️",
            "half_day": "Half Day 🕛",
        }.get(payload.type, payload.type)
        _notify(
            db, current_user.supervisor_id, "absence_submitted",
            f"Absence: {current_user.full_name} — {payload.date}",
            f"{current_user.full_name} submitted a {type_label} for {payload.date}. "
            f"Reason: {payload.reason}",
            link_id=absence.id, link_type="absence",
        )

    # Notify assigned lecturer
    if current_user.lecturer_assignment:
        _notify(
            db, current_user.lecturer_assignment.lecturer_id, "absence_submitted",
            f"Absence: {current_user.full_name} — {payload.date}",
            f"{current_user.full_name} ({current_user.department}) submitted a "
            f"{payload.type} absence for {payload.date}.",
            link_id=absence.id, link_type="absence",
        )

    db.commit()
    db.refresh(absence)
    return absence


@router.get("/absence", response_model=list)
def get_my_absences(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    rows = db.query(AbsenceRequest).filter(
        AbsenceRequest.intern_id == current_user.id
    ).order_by(AbsenceRequest.date.desc()).all()
    from backend.schemas import AbsenceRequestResponse
    return [AbsenceRequestResponse.model_validate(r) for r in rows]


@router.get("/absence/intern/{intern_id}")
def get_intern_absences(
    intern_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supervisor or lecturer fetches an intern's absences."""
    if current_user.role not in ("supervisor", "lecturer", "admin"):
        raise HTTPException(403, "Insufficient permissions")

    rows = db.query(AbsenceRequest).filter(
        AbsenceRequest.intern_id == intern_id
    ).order_by(AbsenceRequest.date.desc()).all()
    from backend.schemas import AbsenceRequestResponse
    return [AbsenceRequestResponse.model_validate(r) for r in rows]


@router.post("/absence/{absence_id}/acknowledge")
def acknowledge_absence(
    absence_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    absence = db.query(AbsenceRequest).filter(AbsenceRequest.id == absence_id).first()
    if not absence:
        raise HTTPException(404, "Absence request not found")

    # Verify this supervisor owns the intern
    intern = db.query(User).filter(
        User.id == absence.intern_id,
        User.supervisor_id == current_user.id,
    ).first()
    if not intern:
        raise HTTPException(403, "This intern is not under your supervision")

    absence.status = "acknowledged"
    absence.acknowledged_by = current_user.id
    absence.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Absence acknowledged"}


# ── Attendance stats + calendar ────────────────────────────────────────────────

@router.get("/stats", response_model=AttendanceStats)
def get_attendance_stats(
    intern_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns attendance stats and full calendar heatmap.
    - Interns see their own stats.
    - Supervisors/lecturers/admins pass ?intern_id=<uuid> to view any intern.
    """
    if current_user.role == "intern":
        intern = current_user
    else:
        if not intern_id:
            raise HTTPException(400, "intern_id is required for non-intern users")
        intern = db.query(User).filter(User.id == intern_id, User.role == "intern").first()
        if not intern:
            raise HTTPException(404, "Intern not found")

    start = intern.attachment_start
    end = intern.attachment_end
    today = date.today()

    if not start or not end:
        return AttendanceStats(
            attachment_start=None, attachment_end=None,
            total_working_days=0, present=0, approved=0, pending=0,
            absent_sick=0, absent_day_off=0, absent_emergency=0,
            absent_half_day=0, unexplained=0, within_grace=0,
            non_working=0, days_calendar=[],
        )

    # Collect all relevant years for holiday lookup
    years = set(range(start.year, end.year + 1))
    holiday_dates: set = set()
    for yr in years:
        holiday_dates |= _get_holiday_dates(db, yr)

    # All logbook entries and absences in period
    logs = {
        e.entry_date: e
        for e in db.query(LogbookEntry).filter(
            LogbookEntry.intern_id == intern.id,
            LogbookEntry.entry_date >= start,
            LogbookEntry.entry_date <= end,
        ).all()
    }
    absences = {
        a.date: a
        for a in db.query(AbsenceRequest).filter(
            AbsenceRequest.intern_id == intern.id,
            AbsenceRequest.date >= start,
            AbsenceRequest.date <= end,
        ).all()
    }

    grace_cutoff = today - timedelta(hours=GRACE_HOURS)

    # Walk every day in the period
    calendar: list[DayStatus] = []
    stats = dict(
        total_working_days=0, present=0, approved=0, pending=0,
        absent_sick=0, absent_day_off=0, absent_emergency=0,
        absent_half_day=0, unexplained=0, within_grace=0, non_working=0,
    )

    current_day = start
    while current_day <= min(end, today + timedelta(days=1)):
        is_nwd = _is_non_working(current_day, holiday_dates)

        if current_day > today:
            status = "future"
        elif current_day in logs:
            # Log exists — always show the log status regardless of working/non-working day
            log = logs[current_day]
            stats["present"] += 1
            if not is_nwd:
                stats["total_working_days"] += 1
            if log.status == "approved":
                status = "approved"
                stats["approved"] += 1
            elif log.status == "rejected":
                status = "rejected"
                # rejected counts as present (they submitted) but not approved
            else:
                status = "pending"
                stats["pending"] += 1
        elif is_nwd:
            # Non-working day with no log — expected, not counted as working day
            status = "holiday" if _is_holiday(current_day, holiday_dates) else "weekend"
            stats["non_working"] += 1
        elif current_day in absences:
            ab = absences[current_day]
            stats["total_working_days"] += 1
            status = f"absent_{ab.type}"
            stats[f"absent_{ab.type}"] += 1
        else:
            # Working day, no log, no absence
            stats["total_working_days"] += 1
            if current_day >= grace_cutoff:
                status = "within_grace"
                stats["within_grace"] += 1
            else:
                status = "unexplained"
                stats["unexplained"] += 1

        calendar.append(DayStatus(date=current_day, status=status))
        current_day += timedelta(days=1)

    # Future days within period
    future_start = min(end, today + timedelta(days=1)) + timedelta(days=1)
    current_day = future_start
    while current_day <= end:
        if _is_non_working(current_day, holiday_dates):
            status = "holiday" if _is_holiday(current_day, holiday_dates) else "weekend"
        else:
            status = "future"
        calendar.append(DayStatus(date=current_day, status=status))
        current_day += timedelta(days=1)

    return AttendanceStats(
        attachment_start=start,
        attachment_end=end,
        **stats,
        days_calendar=calendar,
    )
