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


# ── Supervisor: read own geofence ─────────────────────────────────────────────

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


# ── Supervisor: pin / re-pin ──────────────────────────────────────────────────

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


# ── Intern: check whether they are on-site ────────────────────────────────────

@router.get("/check")
def check_location(
    latitude:   float = Query(..., description="Intern's current latitude"),
    longitude:  float = Query(..., description="Intern's current longitude"),
    accuracy_m: Optional[float] = Query(
        None,
        description=(
            "Browser-reported horizontal accuracy in metres (68 % confidence circle). "
            "Added to the geofence radius as an indoor-drift buffer, capped at "
            f"{MAX_GPS_DRIFT_M} m."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("intern")),
):
    """
    Check whether the intern is within their supervisor's geofence.
    Called by the frontend before log submission.

    Returns is_onsite, raw distance, effective radius used, and a human
    message.  The accuracy_m buffer ensures that an intern standing at the
    exact pinned location inside a thick-walled building (where GPS reports
    a 20-50 m drift) is still correctly marked on-site.
    """
    if not current_user.supervisor_id:
        return {
            "is_onsite":        False,
            "distance_m":       None,
            "effective_radius": None,
            "message": "You have not been assigned a supervisor yet.",
        }

    geo = db.query(SupervisorGeofence).filter(
        SupervisorGeofence.supervisor_id == current_user.supervisor_id,
        SupervisorGeofence.is_active     == True,
    ).first()

    if not geo:
        return {
            "is_onsite":        False,
            "distance_m":       None,
            "effective_radius": None,
            "message": (
                "Submission unavailable. "
                "Awaiting your company supervisor to set the on-site location."
            ),
        }

    distance   = haversine_distance(latitude, longitude, geo.latitude, geo.longitude)
    eff_radius = effective_radius(geo.radius_meters, accuracy_m)
    is_onsite  = distance <= eff_radius

    # Build a useful human message
    accuracy_note = (
        f" (GPS accuracy: ±{accuracy_m:.0f} m, buffer applied)"
        if accuracy_m and accuracy_m > 0
        else ""
    )
    if is_onsite:
        msg = (
            f"You are on-site at {geo.name} "
            f"({distance:.0f} m from pin, radius {eff_radius:.0f} m{accuracy_note})"
        )
    else:
        msg = (
            f"You must be on-site to submit. "
            f"Nearest office: {geo.name} — you are {distance:.0f} m away "
            f"(effective radius: {eff_radius:.0f} m{accuracy_note})"
        )

    return {
        "is_onsite":        is_onsite,
        "nearest_site":     geo.name,
        "distance_m":       round(distance, 1),
        "effective_radius": round(eff_radius, 1),
        "message":          msg,
    }


# ── Supervisor: live debug / test endpoint ────────────────────────────────────

@router.get("/debug")
def debug_geofence(
    latitude:   float = Query(..., description="Test latitude"),
    longitude:  float = Query(..., description="Test longitude"),
    accuracy_m: Optional[float] = Query(None, description="Simulated GPS accuracy (m)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("supervisor")),
):
    """
    Diagnostic endpoint for supervisors to test their geofence configuration.

    Returns the raw distance from the submitted coordinates to the pinned
    location, the effective radius with the accuracy buffer applied, and
    whether those coordinates would be accepted as on-site.

    Useful for verifying the pin is correct before interns arrive.
    """
    geo = db.query(SupervisorGeofence).filter(
        SupervisorGeofence.supervisor_id == current_user.id,
        SupervisorGeofence.is_active     == True,
    ).first()

    if not geo:
        raise HTTPException(
            404,
            "You have not pinned an office location yet. "
            "Use the Office Location page to pin your site first."
        )

    distance   = haversine_distance(latitude, longitude, geo.latitude, geo.longitude)
    eff_radius = effective_radius(geo.radius_meters, accuracy_m)
    is_onsite  = distance <= eff_radius

    accuracy_buffer = min(float(accuracy_m), float(MAX_GPS_DRIFT_M)) if accuracy_m else float(MAX_GPS_DRIFT_M)

    return {
        "pinned_location": {
            "name":           geo.name,
            "latitude":       float(geo.latitude),
            "longitude":      float(geo.longitude),
            "pinned_radius_m": int(geo.radius_meters),
        },
        "test_point": {
            "latitude":   latitude,
            "longitude":  longitude,
            "accuracy_m": accuracy_m,
        },
        "result": {
            "distance_m":       round(distance, 2),
            "accuracy_buffer_m": round(accuracy_buffer, 1),
            "effective_radius_m": round(eff_radius, 1),
            "is_onsite":         is_onsite,
            "verdict": "ON-SITE ✓" if is_onsite else "OFF-SITE ✗",
        },
        "explanation": (
            f"Distance to pin: {distance:.2f} m. "
            f"Pinned radius: {geo.radius_meters} m + "
            f"GPS buffer: {accuracy_buffer:.0f} m = "
            f"Effective radius: {eff_radius:.0f} m. "
            f"{'Within' if is_onsite else 'Outside'} effective radius → "
            f"{'ON-SITE' if is_onsite else 'OFF-SITE'}."
        ),
    }
