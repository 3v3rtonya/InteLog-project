"""
geo_service.py - Haversine distance calculation and geofencing validation.

Key design decisions for indoor/worst-case GPS accuracy:
- All Decimal DB values are explicitly cast to float before trig functions.
- The effective geofence radius = pinned_radius + GPS_accuracy_buffer.
  GPS accuracy buffer = min(reported_accuracy_m, MAX_GPS_DRIFT_M).
  This handles the worst-case indoor scenario where thick walls cause
  the device to report a position 30-50m from its true location.
- MAX_GPS_DRIFT_M is capped so the buffer cannot be exploited to make
  the whole city "on-site".
"""
import math
from typing import Optional, Tuple

# Maximum GPS drift we'll compensate for (metres).
# 50 m covers concrete/thick-wall office buildings at 99.9% confidence.
# Raise to 80 if your site has very deep basement offices.
MAX_GPS_DRIFT_M: int = 50

# Earth mean radius (IUGG value, metres)
_EARTH_R: float = 6_371_008.8


def haversine_distance(
    lat1: float | object,
    lon1: float | object,
    lat2: float | object,
    lon2: float | object,
) -> float:
    """
    Return the great-circle distance (metres) between two WGS-84 points.

    All arguments are cast to float first so that SQLAlchemy Decimal values
    from PostgreSQL DECIMAL columns do not silently corrupt trig calculations.
    """
    # Critical: cast to float — Decimal from psycopg silently breaks math.*
    lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    )
    # Clamp a to [0, 1] to guard against floating-point rounding > 1
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return _EARTH_R * c


def effective_radius(
    pinned_radius_m: int | float | object,
    gps_accuracy_m: Optional[float] = None,
) -> float:
    """
    Return the effective geofence radius in metres after adding a GPS
    accuracy buffer.

    effective_radius = pinned_radius + min(gps_accuracy, MAX_GPS_DRIFT_M)

    If gps_accuracy_m is None or 0 (unknown / not reported by browser),
    we fall back to adding MAX_GPS_DRIFT_M as a conservative default.

    Args:
        pinned_radius_m : The supervisor's configured radius (metres).
        gps_accuracy_m  : The browser's reported horizontal accuracy (metres,
                          68 % confidence circle).  May be None.
    """
    pinned = float(pinned_radius_m)
    if gps_accuracy_m is None or gps_accuracy_m <= 0:
        buffer = float(MAX_GPS_DRIFT_M)
    else:
        buffer = min(float(gps_accuracy_m), float(MAX_GPS_DRIFT_M))
    return pinned + buffer


def is_within_geofence(
    user_lat: float,
    user_lon: float,
    site_lat: float,
    site_lon: float,
    radius_m: int = 200,
    gps_accuracy_m: Optional[float] = None,
) -> bool:
    """
    Check whether a user's coordinates fall inside the geofence.

    Uses effective_radius() so the GPS accuracy buffer is always applied.
    """
    distance = haversine_distance(user_lat, user_lon, site_lat, site_lon)
    return distance <= effective_radius(radius_m, gps_accuracy_m)


def find_nearest_site(
    user_lat: float,
    user_lon: float,
    sites: list,
) -> Tuple[Optional[object], float]:
    """
    Find the nearest *active* site to the user's coordinates.

    Returns:
        Tuple of (nearest_site, distance_in_metres)
    """
    nearest = None
    min_distance = float("inf")

    for site in sites:
        if not site.is_active:
            continue
        dist = haversine_distance(user_lat, user_lon, site.latitude, site.longitude)
        if dist < min_distance:
            min_distance = dist
            nearest = site

    return nearest, min_distance
