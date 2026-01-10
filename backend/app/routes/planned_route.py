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

from app.database import get_db
from app.models.planned_route import PlannedRoute
from app.models.activity import Activity
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


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


@router.get("", response_model=List[PlannedRouteResponse])
@limiter.limit("60/minute")
async def get_planned_route(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Get all planned route sections"""
    # Cache for 1 hour - route changes infrequently
    response.headers["Cache-Control"] = "public, max-age=3600"

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

        # Calculate total distance
        moving_data = gpx.get_moving_data()
        total_distance_km = (moving_data.moving_distance / 1000) if moving_data else 0

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
        raise HTTPException(
            status_code=400,
            detail=f"Error processing GPX file: {str(e)}"
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
