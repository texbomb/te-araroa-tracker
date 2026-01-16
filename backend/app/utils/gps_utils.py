"""
GPS distance calculation and activity matching utilities.
"""

import math
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.models.activity import Activity


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.

    Args:
        lat1, lon1: Latitude and longitude of first point in decimal degrees
        lat2, lon2: Latitude and longitude of second point in decimal degrees

    Returns:
        Distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lon1_rad = math.radians(lon1)
    lon2_rad = math.radians(lon2)

    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))

    # Earth's radius in kilometers
    radius_km = 6371.0

    return radius_km * c


def find_closest_point_on_track(
    photo_lat: float,
    photo_lon: float,
    gps_track: List[dict]
) -> Tuple[float, int]:
    """
    Find the closest point on a GPS track to a given photo location.

    Args:
        photo_lat, photo_lon: Photo's GPS coordinates
        gps_track: List of GPS points with 'lat' and 'lon' (or 'lng') keys

    Returns:
        Tuple of (minimum_distance_km, closest_point_index)
    """
    if not gps_track:
        return float('inf'), -1

    min_distance = float('inf')
    closest_index = -1

    for i, point in enumerate(gps_track):
        # Handle both 'lon' and 'lng' for backwards compatibility
        point_lon = point.get('lon') or point.get('lng')
        point_lat = point.get('lat')

        if point_lat is None or point_lon is None:
            continue

        distance = haversine_distance(photo_lat, photo_lon, point_lat, point_lon)

        if distance < min_distance:
            min_distance = distance
            closest_index = i

    return min_distance, closest_index


def find_nearest_activity(
    photo_lat: float,
    photo_lon: float,
    db: Session,
    max_distance_km: float = 5.0
) -> Optional[int]:
    """
    Find the nearest activity to a photo based on GPS coordinates.

    Searches all activities and finds the one with a GPS track point
    closest to the photo location. Only returns an activity if the
    minimum distance is within max_distance_km threshold.

    Args:
        photo_lat, photo_lon: Photo's GPS coordinates
        db: Database session
        max_distance_km: Maximum distance threshold in kilometers

    Returns:
        Activity ID if found within threshold, None otherwise
    """
    # Get all activities with GPS data
    activities = db.query(Activity).filter(
        Activity.raw_gps_data.isnot(None)
    ).all()

    if not activities:
        return None

    closest_activity_id = None
    min_distance = float('inf')

    for activity in activities:
        if not activity.raw_gps_data:
            continue

        # Find closest point on this activity's track
        distance, _ = find_closest_point_on_track(
            photo_lat,
            photo_lon,
            activity.raw_gps_data
        )

        if distance < min_distance:
            min_distance = distance
            closest_activity_id = activity.id

    # Only return activity if within threshold
    if min_distance <= max_distance_km:
        return closest_activity_id

    return None


def calculate_distance_to_activity(
    photo_lat: float,
    photo_lon: float,
    activity: Activity
) -> Optional[float]:
    """
    Calculate the minimum distance from a photo to an activity's GPS track.

    Args:
        photo_lat, photo_lon: Photo's GPS coordinates
        activity: Activity object with raw_gps_data

    Returns:
        Minimum distance in kilometers, or None if activity has no GPS data
    """
    if not activity.raw_gps_data:
        return None

    distance, _ = find_closest_point_on_track(
        photo_lat,
        photo_lon,
        activity.raw_gps_data
    )

    return distance if distance != float('inf') else None
