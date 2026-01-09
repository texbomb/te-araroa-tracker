"""
Activities API routes
"""

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from app.database import get_db
from app.models.activity import Activity
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class ActivityResponse(BaseModel):
    id: int
    name: Optional[str]
    source: str
    garmin_activity_id: Optional[int]
    date: date
    start_time: Optional[datetime]  # DateTime with timezone
    distance_km: Optional[float]
    elevation_gain_m: Optional[int]
    elevation_loss_m: Optional[int]
    min_elevation_m: Optional[int]
    max_elevation_m: Optional[int]
    duration_seconds: Optional[int]
    avg_heart_rate: Optional[int]
    max_heart_rate: Optional[int]
    calories: Optional[int]
    route_polyline: Optional[str]
    raw_gps_data: Optional[list]

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class StatsResponse(BaseModel):
    total_distance_km: float
    total_elevation_m: int
    total_days: int
    avg_distance_per_day: float
    longest_day_km: float
    highest_elevation_day_m: int


@router.get("", response_model=List[ActivityResponse])
@limiter.limit("60/minute")  # Allow reasonable polling frequency
async def get_activities(
    request: Request,
    response: Response,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all activities, optionally filtered by date range"""
    # Cache for 2 minutes - activities don't change frequently
    response.headers["Cache-Control"] = "public, max-age=120"

    query = db.query(Activity)

    if start_date:
        query = query.filter(Activity.date >= start_date)
    if end_date:
        query = query.filter(Activity.date <= end_date)

    activities = query.order_by(Activity.date.desc()).all()
    return activities


@router.get("/stats", response_model=StatsResponse)
@limiter.limit("60/minute")  # Match activities endpoint limit
async def get_stats(request: Request, response: Response, db: Session = Depends(get_db)):
    """Get summary statistics for all activities"""
    # Cache for 5 minutes - stats change infrequently (only on new activities)
    response.headers["Cache-Control"] = "public, max-age=300"

    # Get aggregates
    stats = db.query(
        func.sum(Activity.distance_km).label('total_distance'),
        func.sum(Activity.elevation_gain_m).label('total_elevation'),
        func.count(func.distinct(Activity.date)).label('total_days'),  # Count unique dates
        func.max(Activity.distance_km).label('longest_day'),
        func.max(Activity.elevation_gain_m).label('highest_elevation')
    ).first()

    total_distance = float(stats.total_distance or 0)
    total_elevation = int(stats.total_elevation or 0)
    total_days = int(stats.total_days or 0)
    longest_day = float(stats.longest_day or 0)
    highest_elevation = int(stats.highest_elevation or 0)

    avg_distance = total_distance / total_days if total_days > 0 else 0

    return StatsResponse(
        total_distance_km=round(total_distance, 2),
        total_elevation_m=total_elevation,
        total_days=total_days,
        avg_distance_per_day=round(avg_distance, 2),
        longest_day_km=round(longest_day, 2),
        highest_elevation_day_m=highest_elevation
    )


@router.get("/{activity_id}", response_model=ActivityResponse)
@limiter.limit("60/minute")  # Allow reasonable access to individual activities
async def get_activity(activity_id: int, request: Request, response: Response, db: Session = Depends(get_db)):
    """Get a single activity by ID"""
    # Cache individual activities for 10 minutes - they never change once created
    response.headers["Cache-Control"] = "public, max-age=600"

    activity = db.query(Activity).filter(Activity.id == activity_id).first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    return activity