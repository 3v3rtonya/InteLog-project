"""
holidays.py — Non-working day calendar.

Public holidays (type='public_holiday') are seeded automatically and are
READ-ONLY — the system manages them. Admins can only add/remove
custom entries (type='custom'), e.g. school-specific breaks.

Weekends are computed dynamically — never stored here.
"""
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import NonWorkingDay, User
from backend.schemas import NonWorkingDayCreate, NonWorkingDayRangeCreate, NonWorkingDayResponse
from backend.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/holidays", tags=["holidays"])


@router.get("", response_model=list)
def get_holidays(
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Any authenticated user can view holidays (needed for calendar rendering)."""
    query = db.query(NonWorkingDay)
    if year:
        query = query.filter(NonWorkingDay.year == year)
    rows = query.order_by(NonWorkingDay.date).all()
    return [NonWorkingDayResponse.model_validate(r) for r in rows]


@router.post("", response_model=NonWorkingDayResponse, status_code=201)
def add_holiday(
    payload: NonWorkingDayCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Admin adds a custom non-working day (e.g. school break, institutional closure).
    Public holidays (type='public_holiday') are system-seeded and cannot be
    created here — use type='custom' for all admin-created entries.
    """
    # Force admin-created entries to 'custom' — public_holiday is system-only
    entry_type = "custom"

    existing = db.query(NonWorkingDay).filter(NonWorkingDay.date == payload.date).first()
    if existing:
        raise HTTPException(409, f"{payload.date} is already a non-working day ({existing.name})")

    nwd = NonWorkingDay(
        date=payload.date,
        type=entry_type,
        name=payload.name,
        year=payload.date.year,
        created_by=admin.id,
    )
    db.add(nwd)
    db.commit()
    db.refresh(nwd)
    return nwd


@router.post("/range", status_code=201)
def add_holiday_range(
    payload: NonWorkingDayRangeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Admin adds a consecutive range of custom non-working days
    (e.g. Easter break Apr 18–22).
    """
    if payload.end_date < payload.start_date:
        raise HTTPException(400, "End date must be on or after start date")

    added = []
    skipped = []
    current = payload.start_date
    while current <= payload.end_date:
        existing = db.query(NonWorkingDay).filter(NonWorkingDay.date == current).first()
        if existing:
            skipped.append(str(current))
        else:
            nwd = NonWorkingDay(
                date=current,
                type="custom",   # always custom for admin-created ranges
                name=payload.name,
                year=current.year,
                created_by=admin.id,
            )
            db.add(nwd)
            added.append(str(current))
        current += timedelta(days=1)

    db.commit()
    return {"added": added, "skipped": skipped}


@router.delete("/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """
    Admin can only remove custom entries.
    Public holidays are system-seeded and protected from deletion.
    """
    nwd = db.query(NonWorkingDay).filter(NonWorkingDay.id == holiday_id).first()
    if not nwd:
        raise HTTPException(404, "Holiday not found")
    if nwd.type == "public_holiday":
        raise HTTPException(
            403,
            f"'{nwd.name}' is a national public holiday managed by the system "
            f"and cannot be removed. Only custom entries can be deleted."
        )
    db.delete(nwd)
    db.commit()

