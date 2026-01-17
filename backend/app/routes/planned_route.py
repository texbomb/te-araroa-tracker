"""
Planned Route API - Manage the planned Te Araroa trail route
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
import polyline
import gpxpy
import math

from app.database import get_db
from app.models.planned_route import PlannedRoute
from app.models.route_section import RouteSection
from app.models.activity import Activity
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth
    Returns distance in meters
    """
    R = 6371000  # Earth's radius in meters

    # Convert to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine formula
    a = math.sin(delta_phi/2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


def calculate_route_distance(points: List[tuple]) -> float:
    """
    Calculate total distance of a route from list of (lat, lon) tuples
    Returns distance in kilometers
    """
    if len(points) < 2:
        return 0.0

    total_distance = 0.0
    for i in range(1, len(points)):
        lat1, lon1 = points[i-1]
        lat2, lon2 = points[i]
        total_distance += haversine_distance(lat1, lon1, lat2, lon2)

    return total_distance / 1000  # Convert to kilometers


def calculate_cumulative_distances(points: List[tuple]) -> List[float]:
    """
    Calculate cumulative distance at each point along the route
    Returns list of distances in kilometers, one for each point
    """
    if len(points) == 0:
        return []

    distances = [0.0]  # First point is at distance 0

    for i in range(1, len(points)):
        lat1, lon1 = points[i-1]
        lat2, lon2 = points[i]
        segment_dist = haversine_distance(lat1, lon1, lat2, lon2) / 1000  # Convert to km
        distances.append(distances[-1] + segment_dist)

    return distances


def find_point_index_by_distance(cumulative_distances: List[float], target_km: float) -> int:
    """
    Find the point index closest to the target distance
    Uses binary search for efficiency
    """
    if not cumulative_distances or target_km <= 0:
        return 0
    if target_km >= cumulative_distances[-1]:
        return len(cumulative_distances) - 1

    # Binary search for closest point
    left, right = 0, len(cumulative_distances) - 1

    while left < right:
        mid = (left + right) // 2
        if cumulative_distances[mid] < target_km:
            left = mid + 1
        else:
            right = mid

    # Check if previous point is closer
    if left > 0:
        if abs(cumulative_distances[left-1] - target_km) < abs(cumulative_distances[left] - target_km):
            return left - 1

    return left


def slice_route_polyline(full_polyline: str, start_index: int, end_index: int) -> str:
    """
    Extract a subsection of a route from encoded polyline
    Returns new encoded polyline for the section
    """
    points = polyline.decode(full_polyline, 5)

    # Validate indices
    if start_index < 0:
        start_index = 0
    if end_index >= len(points):
        end_index = len(points) - 1
    if start_index >= end_index:
        raise ValueError("Invalid indices: start must be less than end")

    section_points = points[start_index:end_index+1]
    return polyline.encode(section_points, 5)


class PlannedRouteResponse(BaseModel):
    id: int
    section_name: Optional[str]
    section_order: Optional[int]
    route_polyline: str
    distance_km: Optional[float]
    description: Optional[str]

    class Config:
        from_attributes = True


class PlannedRouteCreate(BaseModel):
    section_name: Optional[str] = None
    section_order: Optional[int] = None
    route_polyline: str
    distance_km: Optional[float] = None
    description: Optional[str] = None


class ProgressResponse(BaseModel):
    total_planned_km: float
    completed_km: float
    progress_percent: float
    days_on_trail: int
    activities_count: int


class RouteSectionCreate(BaseModel):
    section_name: str
    start_distance_km: float
    end_distance_km: float
    description: Optional[str] = None


class RouteSectionResponse(BaseModel):
    id: int
    full_route_id: int
    section_name: str
    start_point_index: int
    end_point_index: int
    start_distance_km: float
    end_distance_km: float
    is_active: bool
    description: Optional[str]

    class Config:
        from_attributes = True


class FullRouteInfoResponse(BaseModel):
    id: int
    section_name: Optional[str]
    total_distance_km: float
    total_points: int
    has_active_section: bool
    active_section: Optional[RouteSectionResponse]


@router.get("", response_model=List[PlannedRouteResponse])
@limiter.limit("60/minute")
async def get_planned_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Get planned route to display on map
    If an active route section exists, returns only that section
    Otherwise returns the full route(s)
    """
    # Cache for 1 hour - route changes infrequently
    response.headers["Cache-Control"] = "public, max-age=3600"

    # Check if there's an active route section
    active_section = db.query(RouteSection).filter(RouteSection.is_active == True).first()

    if active_section:
        # Return the active section as a sliced route
        full_route = db.query(PlannedRoute).filter(PlannedRoute.id == active_section.full_route_id).first()

        if full_route:
            try:
                # Slice the polyline to get only the active section
                section_polyline = slice_route_polyline(
                    full_route.route_polyline,
                    active_section.start_point_index,
                    active_section.end_point_index
                )

                # Calculate section distance
                section_distance = active_section.end_distance_km - active_section.start_distance_km

                # Return as a PlannedRouteResponse
                return [{
                    "id": full_route.id,
                    "section_name": active_section.section_name,
                    "section_order": 1,
                    "route_polyline": section_polyline,
                    "distance_km": round(section_distance, 2),
                    "description": active_section.description
                }]
            except Exception as e:
                print(f"Error slicing route: {e}")
                # Fall back to returning full routes

    # No active section, return all planned routes
    sections = db.query(PlannedRoute).order_by(PlannedRoute.section_order).all()
    return sections


@router.post("", response_model=PlannedRouteResponse)
@limiter.limit("10/hour")
async def create_planned_route(
    route_data: PlannedRouteCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Create a new planned route section (admin only)"""
    new_section = PlannedRoute(**route_data.dict())
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    return new_section


@router.post("/upload-gpx")
@limiter.limit("10/hour")
async def upload_planned_route_gpx(
    request: Request,
    file: UploadFile = File(...),
    section_name: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Upload GPX file as planned route (admin only)
    Replaces existing planned route with new one
    """
    if not file.filename.endswith(('.gpx', '.GPX')):
        raise HTTPException(status_code=400, detail="File must be a GPX file")

    try:
        # Read and parse GPX file
        content = await file.read()
        gpx_string = content.decode('utf-8')
        gpx = gpxpy.parse(gpx_string)

        if not gpx.tracks:
            raise HTTPException(status_code=400, detail="No tracks found in GPX file")

        # Extract all points from all tracks
        all_points = []
        for track in gpx.tracks:
            for segment in track.segments:
                for point in segment.points:
                    all_points.append((point.latitude, point.longitude))

        if not all_points:
            raise HTTPException(status_code=400, detail="No points found in GPX track")

        # Calculate total distance using Haversine formula
        total_distance_km = calculate_route_distance(all_points)

        # Encode as polyline
        encoded_polyline = polyline.encode(all_points, 5)

        # Clear existing planned route
        db.query(PlannedRoute).delete()

        # Create new planned route
        new_route = PlannedRoute(
            section_name=section_name or f"Te Araroa Section",
            section_order=1,
            route_polyline=encoded_polyline,
            distance_km=round(total_distance_km, 2),
            description=description
        )

        db.add(new_route)
        db.commit()
        db.refresh(new_route)

        return {
            "success": True,
            "message": f"Planned route uploaded successfully",
            "route": {
                "id": new_route.id,
                "section_name": new_route.section_name,
                "distance_km": float(new_route.distance_km),
                "points_count": len(all_points)
            }
        }

    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error processing GPX file: {str(e)}"
        print(f"GPX Upload Error: {error_detail}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=400,
            detail=error_detail
        )


@router.get("/progress", response_model=ProgressResponse)
@limiter.limit("60/minute")
async def get_progress(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Calculate progress on the planned route
    """
    # Cache for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"

    # Get total planned distance
    total_planned = db.query(
        func.sum(PlannedRoute.distance_km)
    ).scalar() or 0

    # Get completed distance from activities
    completed = db.query(
        func.sum(Activity.distance_km)
    ).scalar() or 0

    # Count activities and unique days
    activities_count = db.query(func.count(Activity.id)).scalar() or 0
    days_on_trail = db.query(
        func.count(func.distinct(Activity.date))
    ).scalar() or 0

    # Calculate progress percentage
    progress_percent = (completed / total_planned * 100) if total_planned > 0 else 0

    return ProgressResponse(
        total_planned_km=float(total_planned),
        completed_km=float(completed),
        progress_percent=round(progress_percent, 2),
        days_on_trail=days_on_trail,
        activities_count=activities_count
    )


@router.delete("/all")
@limiter.limit("5/hour")
async def clear_planned_route(
    request: Request,
    db: Session = Depends(get_db)
):
    """Clear all planned route sections (admin only)"""
    deleted_count = db.query(PlannedRoute).delete()
    db.commit()

    return {
        "success": True,
        "message": f"Cleared all planned route sections ({deleted_count} deleted)"
    }


@router.delete("/{route_id}")
@limiter.limit("10/hour")
async def delete_planned_route_section(
    route_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Delete a planned route section (admin only)"""
    section = db.query(PlannedRoute).filter(PlannedRoute.id == route_id).first()

    if not section:
        raise HTTPException(status_code=404, detail="Route section not found")

    db.delete(section)
    db.commit()

    return {"success": True, "message": f"Route section {route_id} deleted"}


@router.post("/set-active-section", response_model=RouteSectionResponse)
@limiter.limit("20/hour")
async def set_active_section(
    section_data: RouteSectionCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Set the active section of a full route by distance (km)
    Creates a new RouteSection that defines which part of the full route is active
    """
    # Find the full route (should only be one)
    full_route = db.query(PlannedRoute).first()

    if not full_route:
        raise HTTPException(status_code=404, detail="No route uploaded. Upload a full route first.")

    # Decode the full route and calculate cumulative distances
    all_points = polyline.decode(full_route.route_polyline, 5)
    cumulative_distances = calculate_cumulative_distances(all_points)

    total_distance = cumulative_distances[-1] if cumulative_distances else 0

    # Validate distance bounds
    if section_data.start_distance_km < 0 or section_data.end_distance_km > total_distance:
        raise HTTPException(
            status_code=400,
            detail=f"Distance out of bounds. Route is 0-{total_distance:.2f} km"
        )

    if section_data.start_distance_km >= section_data.end_distance_km:
        raise HTTPException(
            status_code=400,
            detail="Start distance must be less than end distance"
        )

    # Find point indices for the start and end distances
    start_index = find_point_index_by_distance(cumulative_distances, section_data.start_distance_km)
    end_index = find_point_index_by_distance(cumulative_distances, section_data.end_distance_km)

    # Deactivate any existing active sections
    db.query(RouteSection).filter(RouteSection.is_active == True).update({"is_active": False})

    # Create new active section
    new_section = RouteSection(
        full_route_id=full_route.id,
        section_name=section_data.section_name,
        start_point_index=start_index,
        end_point_index=end_index,
        start_distance_km=round(section_data.start_distance_km, 2),
        end_distance_km=round(section_data.end_distance_km, 2),
        is_active=True,
        description=section_data.description
    )

    db.add(new_section)
    db.commit()
    db.refresh(new_section)

    return new_section


@router.get("/full-route-info", response_model=FullRouteInfoResponse)
@limiter.limit("60/minute")
async def get_full_route_info(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Get information about the full route and active section"""
    response.headers["Cache-Control"] = "public, max-age=300"  # 5 min cache

    full_route = db.query(PlannedRoute).first()

    if not full_route:
        raise HTTPException(status_code=404, detail="No route uploaded")

    # Decode to get point count
    all_points = polyline.decode(full_route.route_polyline, 5)

    # Check for active section
    active_section = db.query(RouteSection).filter(
        RouteSection.full_route_id == full_route.id,
        RouteSection.is_active == True
    ).first()

    return FullRouteInfoResponse(
        id=full_route.id,
        section_name=full_route.section_name,
        total_distance_km=float(full_route.distance_km or 0),
        total_points=len(all_points),
        has_active_section=active_section is not None,
        active_section=active_section
    )


@router.delete("/active-section")
@limiter.limit("10/hour")
async def clear_active_section(
    request: Request,
    db: Session = Depends(get_db)
):
    """Clear the active section, showing the full route again"""
    db.query(RouteSection).filter(RouteSection.is_active == True).delete()
    db.commit()

    return {
        "success": True,
        "message": "Active section cleared. Showing full route."
    }
