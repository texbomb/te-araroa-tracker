"""
Test data routes - for development only
Add sample activities to test the frontend
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.activity import Activity
import polyline

router = APIRouter()


@router.post("/create-sample-activities")
async def create_sample_activities(db: Session = Depends(get_db)):
    """Create sample hiking activities for testing"""

    # Sample GPS coordinates for a hike in New Zealand (Te Araroa trail section)
    # Bluff to Invercargill area
    sample_coords = [
        (-46.6006, 168.3428),  # Bluff
        (-46.5950, 168.3500),
        (-46.5850, 168.3600),
        (-46.5750, 168.3700),
        (-46.5650, 168.3800),
        (-46.5550, 168.3850),
    ]

    # Create 3 sample activities
    activities_data = [
        {
            "garmin_activity_id": 1000001,
            "date": datetime.now().date() - timedelta(days=2),
            "start_time": datetime.now() - timedelta(days=2, hours=2),
            "distance_km": 15.5,
            "elevation_gain_m": 450,
            "duration_seconds": 18000,  # 5 hours
            "avg_heart_rate": 135,
            "max_heart_rate": 165,
            "calories": 1200,
            "route_polyline": polyline.encode(sample_coords),
        },
        {
            "garmin_activity_id": 1000002,
            "date": datetime.now().date() - timedelta(days=1),
            "start_time": datetime.now() - timedelta(days=1, hours=2),
            "distance_km": 22.3,
            "elevation_gain_m": 680,
            "duration_seconds": 25200,  # 7 hours
            "avg_heart_rate": 140,
            "max_heart_rate": 172,
            "calories": 1800,
            "route_polyline": polyline.encode(sample_coords),
        },
        {
            "garmin_activity_id": 1000003,
            "date": datetime.now().date(),
            "start_time": datetime.now() - timedelta(hours=3),
            "distance_km": 18.7,
            "elevation_gain_m": 520,
            "duration_seconds": 21600,  # 6 hours
            "avg_heart_rate": 138,
            "max_heart_rate": 168,
            "calories": 1500,
            "route_polyline": polyline.encode(sample_coords),
        },
    ]

    created = 0
    for activity_data in activities_data:
        # Check if already exists
        existing = db.query(Activity).filter(
            Activity.garmin_activity_id == activity_data["garmin_activity_id"]
        ).first()

        if not existing:
            activity = Activity(**activity_data)
            db.add(activity)
            created += 1

    db.commit()

    return {
        "success": True,
        "message": f"Created {created} sample activities",
        "total_activities": db.query(Activity).count()
    }


@router.delete("/clear-all-activities")
async def clear_all_activities(db: Session = Depends(get_db)):
    """Delete all activities - for testing only"""
    count = db.query(Activity).delete()
    db.commit()

    return {
        "success": True,
        "message": f"Deleted {count} activities"
    }