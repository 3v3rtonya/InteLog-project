"""
geofence.py - Supervisor self-service geofence pinning and intern location check.

Each supervisor controls their own office location.

GPS accuracy handling:
  /check accepts an optional accuracy_m query param (the browser's reported
  horizontal accuracy circle radius).  The effective geofence radius is:

      effective_radius = pinned_radius + min(accuracy_m, MAX_GPS_DRIFT_M)

  This means an intern standing in the exact pinned spot but inside a thick-
  walled building (where GPS drifts 20-50 m) will still be marked on-site,
  while someone 300 m away cannot exploit a large accuracy value to fake
  presence because the buffer is hard-capped at MAX_GPS_DRIFT_M (50 m).
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, SupervisorGeofence, GeofenceRepinLog, Notification
from backend.schemas import GeofencePinRequest, GeofenceResponse
from backend.dependencies import require_role
from backend.services.geo_service import haversine_distance, effective_radius, MAX_GPS_DRIFT_M

router = APIRouter(prefix="/geofence", tags=["geofence"])


def _notify_admins(db: Session, supervisor: User, body: str, link_id=None):
    admins = db.query(User).filter(User.role == "admin", User.status == "active").all()
    for admin in admins:
        n = Notification(
            user_id=admin.id,
            type="geofence_repin",
            title=f"Geofence Re-pinned by {supervisor.full_name}",
            body=body,
            link_id=link_id,
            link_type="geofence",
        )
        db.add(n)


#  Supervisor: read own geofence 

@router.get("/my", response_model=GeofenceResponse)
def get_my_geofence(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    """Get the supervisor's current pinned geofence."""
    geo = db.query(SupervisorGeofence).filter(
        SupervisorGeofence.supervisor_id == current_user.id
    ).first()
    if not geo:
        raise HTTPException(404, "No office location pinned yet. Please pin your office location.")
    return geo


#  Supervisor: pin / re-pin 

@router.post("/pin", response_model=GeofenceResponse)
def pin_geofence(
    payload: GeofencePinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    """
    Pin or re-pin the supervisor's office location.
    First pin: no reason required.
    Re-pin: reason is required and triggers an admin notification.
    """
    existing = db.query(SupervisorGeofence).filter(
        SupervisorGeofence.supervisor_id == current_user.id
    ).first()

    if existing:
        if not payload.reason or not payload.reason.strip():
            raise HTTPException(
                400,
                "A reason is required when updating your office location. "
                "Please explain why you are moving the pin."
            )
        repin_log = GeofenceRepinLog(
            supervisor_id=current_user.id,
            old_latitude=existing.latitude,
            old_longitude=existing.longitude,
            new_latitude=payload.latitude,
            new_longitude=payload.longitude,
            reason=payload.reason.strip(),
        )
        db.add(repin_log)

        dist = haversine_distance(
            existing.latitude, existing.longitude,
            payload.latitude, payload.longitude,
        )
        _notify_admins(
            db, current_user,
            f"{current_user.full_name} moved their office pin {dist:.0f} m. "
            f"Reason: {payload.reason.strip()}",
            link_id=existing.id,
        )

        existing.name          = payload.name
        existing.latitude      = payload.latitude
        existing.longitude     = payload.longitude
        existing.radius_meters = payload.radius_meters
        existing.pinned_at     = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        geo = SupervisorGeofence(
            supervisor_id  = current_user.id,
            name           = payload.name,
            latitude       = payload.latitude,
            longitude      = payload.longitude,
            radius_meters  = payload.radius_meters,
        )
        db.add(geo)
        db.commit()
        db.refresh(geo)
        return geo
