"""
geo.py - Geofencing validation endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import SiteLocation
from backend.schemas import GeoValidateRequest, GeoValidateResponse
from backend.services.geo_service import find_nearest_site, is_within_geofence
from backend.dependencies import get_current_user
from backend.models import User

router = APIRouter(prefix="/geo", tags=["geo"])


@router.post("/validate", response_model=GeoValidateResponse)
def validate_location(
    payload: GeoValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate if the given GPS coordinates are within any active site's geofence.
    Returns is_onsite status, nearest site name, and distance.
    """
    active_sites = db.query(SiteLocation).filter(SiteLocation.is_active == True).all()

    if not active_sites:
        return GeoValidateResponse(
            is_onsite=False,
            nearest_site=None,
            distance_m=None,
            message="No active site locations configured",
        )

    nearest_site, distance = find_nearest_site(
        payload.latitude, payload.longitude, active_sites
    )

    if nearest_site is None:
        return GeoValidateResponse(
            is_onsite=False,
            nearest_site=None,
            distance_m=None,
            message="No active sites found",
        )

    is_onsite = distance <= nearest_site.radius_meters

    if is_onsite:
        message = f"You are on-site at {nearest_site.name} ({distance:.0f}m away)"
    else:
        message = f"You must be on-site to submit a log entry. Nearest site: {nearest_site.name} ({distance:.0f}m away)"

    return GeoValidateResponse(
        is_onsite=is_onsite,
        nearest_site=nearest_site.name,
        distance_m=round(distance, 2),
        message=message,
    )
