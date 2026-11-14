"""
intern.py - Intern logbook routes.
Uses per-supervisor geofence instead of global site_locations.
Sends notification to supervisor on log submission.
"""
import os
import uuid
import math
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, LogbookEntry, LogImage, SupervisorGeofence, Notification, NonWorkingDay, AttendanceRecord
from backend.schemas import LogbookCreate, LogUpdateRequest, LogResponse, ImageResponse
from backend.services.pii_service import scrub_pii
from backend.services.productivity_service import analyze_log_quality
from backend.services.geo_service import haversine_distance, effective_radius
from backend.dependencies import require_role
from backend.config import settings
from backend.routers.attendance import _intern_period_status, _is_non_working, _is_holiday, _is_weekend, _get_holiday_dates

router = APIRouter(prefix="/intern", tags=["intern"])
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg"}
MAX_FILE_SIZE = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024


def _notify(db, user_id, ntype, title, body, link_id=None, link_type=None):
    db.add(Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link_id=link_id, link_type=link_type,
    ))


@router.post("/logs", response_model=LogResponse, status_code=201)
def create_log(
    payload: LogbookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    today = date.today() if hasattr(payload.entry_date, 'year') else datetime.now(timezone.utc).date()
    from datetime import date as _date
    today = _date.today()

    # ── Attachment period enforcement ──────────────────────────────────────
    period_status = _intern_period_status(current_user, today)
    if period_status == "no_dates":
        raise HTTPException(400, "Please set your attachment start and end dates before submitting logs.")
    if period_status == "before":
        raise HTTPException(400, "Your attachment period has not started yet.")
    if period_status == "expired":
        raise HTTPException(400, "Your attachment period has ended. Submissions are no longer accepted.")
    if period_status == "read_only":
        raise HTTPException(400, "Your attachment period has ended. You are in the 3-day read-only window.")

    # ── Entry date must be within attachment period ────────────────────────
    if current_user.attachment_start and payload.entry_date < current_user.attachment_start:
        raise HTTPException(400, f"Entry date cannot be before your attachment start ({current_user.attachment_start}).")
    if current_user.attachment_end and payload.entry_date > current_user.attachment_end:
        raise HTTPException(400, f"Entry date cannot be after your attachment end ({current_user.attachment_end}).")

    # ── Entry date cannot be in the future ────────────────────────────────
    if payload.entry_date > today:
        raise HTTPException(400, "Entry date cannot be in the future.")

    # Check if the entry date is a non-working day
    holiday_dates = _get_holiday_dates(db, payload.entry_date.year)
    is_holiday_day = _is_holiday(payload.entry_date, holiday_dates)
    is_weekend_day = _is_weekend(payload.entry_date)
    is_non_working_day = is_holiday_day or is_weekend_day

    # is_onsite derived from clock-in record for the entry date (Req 3.5)
    _att = db.query(AttendanceRecord).filter(
        AttendanceRecord.intern_id == current_user.id,
        AttendanceRecord.date == payload.entry_date,
    ).first()
    is_onsite = bool(_att and _att.clock_in_time is not None)
    solutions_scrubbed = scrub_pii(payload.solutions_offered)
    is_flagged, flag_reason = analyze_log_quality(
        payload.activities_performed, payload.solutions_offered
    )

    log = LogbookEntry(
        intern_id=current_user.id,
        supervisor_id=current_user.supervisor_id,
        entry_date=payload.entry_date,
        activities_performed=payload.activities_performed,
        solutions_offered=payload.solutions_offered,
        problems_encountered=payload.problems_encountered,
        lessons_learned=payload.lessons_learned,
        solutions_scrubbed=solutions_scrubbed,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_onsite=is_onsite,
        submitted_on_non_working_day=is_non_working_day,
        status=payload.status,
        is_flagged=is_flagged,
        flag_reason=flag_reason if is_flagged else None,
        ai_classification=payload.ai_classification,
        ai_confidence=payload.ai_confidence,
        ai_feedback=payload.ai_feedback,
        submitted_at=datetime.now(timezone.utc) if payload.status == "pending_approval" else None,
    )
    db.add(log)
    db.flush()

    if payload.status == "pending_approval":
        # Notify supervisor
        if current_user.supervisor_id:
            _notify(
                db, current_user.supervisor_id, "log_submitted",
                f"New log submitted — {payload.entry_date}",
                f"{current_user.full_name} has submitted their logbook entry for {payload.entry_date}. "
                f"Please review and approve.",
                link_id=log.id, link_type="log",
            )
        # Notify admins only if flagged
        if is_flagged:
            admins = db.query(User).filter(User.role == "admin", User.status == "active").all()
            for admin in admins:
                _notify(
                    db, admin.id, "log_flagged",
                    f"Flagged Log — {current_user.full_name}",
                    f"A log by {current_user.full_name} for {payload.entry_date} was auto-flagged: {flag_reason}",
                    link_id=log.id, link_type="log",
                )

    db.commit()
    db.refresh(log)
    return log


@router.get("/logs")
def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    log_status: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    query = db.query(LogbookEntry).filter(LogbookEntry.intern_id == current_user.id)
    if log_status:
        query = query.filter(LogbookEntry.status == log_status)
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
def get_log(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id, LogbookEntry.intern_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    return log


@router.put("/logs/{log_id}", response_model=LogResponse)
def update_log(
    log_id: uuid.UUID,
    payload: LogUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id, LogbookEntry.intern_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    if log.status != "draft":
        raise HTTPException(400, "Only draft entries can be edited")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    if "solutions_offered" in update_data:
        log.solutions_scrubbed = scrub_pii(log.solutions_offered)
    if "activities_performed" in update_data or "solutions_offered" in update_data:
        log.is_flagged, log.flag_reason = analyze_log_quality(
            log.activities_performed, log.solutions_offered
        )
    if payload.status == "pending_approval":
        log.submitted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/logs/{log_id}", status_code=204)
def delete_log(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id, LogbookEntry.intern_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    if log.status != "draft":
        raise HTTPException(400, "Only draft entries can be deleted")
    db.delete(log)
    db.commit()


@router.post("/logs/{log_id}/images", response_model=ImageResponse, status_code=201)
async def upload_image(
    log_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id, LogbookEntry.intern_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")

    if db.query(LogImage).filter(LogImage.log_id == log_id).count() >= settings.MAX_IMAGES_PER_LOG:
        raise HTTPException(400, f"Maximum {settings.MAX_IMAGES_PER_LOG} images per log entry")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, "Only JPEG images are allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"Image must be ≤ {settings.MAX_IMAGE_SIZE_MB}MB")

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    image = LogImage(
        log_id=log_id, file_path=file_path,
        original_filename=file.filename, file_size=len(content),
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/logs/{log_id}/images/{image_id}", status_code=204)
def delete_image(
    log_id: uuid.UUID, image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    log = db.query(LogbookEntry).filter(
        LogbookEntry.id == log_id, LogbookEntry.intern_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(404, "Log entry not found")

    image = db.query(LogImage).filter(
        LogImage.id == image_id, LogImage.log_id == log_id,
    ).first()
    if not image:
        raise HTTPException(404, "Image not found")

    if os.path.exists(image.file_path):
        os.remove(image.file_path)
    db.delete(image)
    db.commit()
