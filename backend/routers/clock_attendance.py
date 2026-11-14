"""
clock_attendance.py - Clock-in / clock-out endpoints for interns.

Rules:
- First clock-in of the day: always allowed.
- After clocking out, intern may clock back in up to 2 more times (3 total).
- is_onsite computed at each clock-in via supervisor geofence.
- No blocking - geofence only sets the is_onsite flag.
"""
import json
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AttendanceRecord, SupervisorGeofence
from backend.schemas import ClockInRequest, AttendanceRecordResponse
from backend.dependencies import require_role
from backend.services.geo_service import haversine_distance, effective_radius

router = APIRouter(prefix="/attendance", tags=["clock-attendance"])

MAX_CLOCK_INS_PER_DAY = 3


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _compute_is_onsite(db: Session, intern: User, latitude: float, longitude: float) -> bool:
    if not intern.supervisor_id:
        return False
    geo = db.query(SupervisorGeofence).filter(
        SupervisorGeofence.supervisor_id == intern.supervisor_id,
        SupervisorGeofence.is_active == True,
    ).first()
    if not geo:
        return False
    distance = haversine_distance(latitude, longitude, geo.latitude, geo.longitude)
    return distance <= effective_radius(geo.radius_meters, None)


@router.post("/clock-in", response_model=AttendanceRecordResponse)
def clock_in(
    payload: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """
    Clock in for today.
    - First clock-in: creates the record.
    - Subsequent clock-ins (after a clock-out): allowed up to 3 total per day.
      This covers accidental clock-outs.
    """
    today = _today()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.intern_id == current_user.id,
        AttendanceRecord.date == today,
    ).first()

    if record:
        # Already has a record today
        if record.clock_in_time is not None and record.clock_out_time is None:
            raise HTTPException(400, "Already clocked in — please clock out first")
        if record.clock_in_count >= MAX_CLOCK_INS_PER_DAY:
            raise HTTPException(400,
                f"Maximum {MAX_CLOCK_INS_PER_DAY} clock-ins per day reached. "
                "Contact your supervisor if this is an error.")

    is_onsite = _compute_is_onsite(db, current_user, payload.latitude, payload.longitude)
    location_json = json.dumps({"latitude": payload.latitude, "longitude": payload.longitude})
    now = datetime.now(timezone.utc)

    if record:
        # Re-clock-in after a clock-out
        record.clock_in_time     = now
        record.clock_in_location = location_json
        record.clock_out_time    = None        # reset clock-out so they can clock out again
        record.clock_out_location = None
        record.is_onsite         = is_onsite
        record.clock_in_count    = (record.clock_in_count or 0) + 1
    else:
        record = AttendanceRecord(
            intern_id=current_user.id,
            date=today,
            clock_in_time=now,
            clock_in_location=location_json,
            is_onsite=is_onsite,
            clock_in_count=1,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


@router.post("/clock-out", response_model=AttendanceRecordResponse)
def clock_out(
    payload: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """Clock out for today. Records GPS. After this the intern may clock back in (up to 3 times total)."""
    today = _today()
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.intern_id == current_user.id,
        AttendanceRecord.date == today,
    ).first()

    if not record or record.clock_in_time is None:
        raise HTTPException(400, "Must clock in before clocking out")
    if record.clock_out_time is not None:
        raise HTTPException(400, "Already clocked out. Clock back in if needed.")

    record.clock_out_time     = datetime.now(timezone.utc)
    record.clock_out_location = json.dumps(
        {"latitude": payload.latitude, "longitude": payload.longitude}
    )
    db.commit()
    db.refresh(record)
    return record


@router.get("/today", response_model=AttendanceRecordResponse)
def get_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """Get today's attendance record. Returns 404 if no clock-in yet."""
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.intern_id == current_user.id,
        AttendanceRecord.date == _today(),
    ).first()
    if not record:
        raise HTTPException(404, "No clock-in record for today")
    return record