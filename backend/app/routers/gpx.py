"""
GPX file upload endpoint for manual activity uploads
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import gpxpy
import gpxpy.gpx
import polyline
from typing import List, Dict, Any

from app.database import get_db
from app.models.activity import Activity

router = APIRouter(prefix="/gpx", tags=["gpx"])


def parse_gpx_file(gpx_content: str) -> Dict[str, Any]:
    """
    Parse GPX file and extract activity data

    Returns:
        Dictionary with activity information:
        - name: Activity name
        - start_time: Start datetime
        - end_time: End datetime
        - duration: Duration in seconds
        - distance: Distance in meters
        - points: List of (lat, lon, elevation, time) tuples
        - stats: Min/max elevation, avg speed, etc.
    """
    gpx = gpxpy.parse(gpx_content)

    if not gpx.tracks:
        raise ValueError("No tracks found in GPX file")

    # Get first track (most GPX files have one track)
    track = gpx.tracks[0]

    # Extract all points
    all_points = []
    for segment in track.segments:
        for point in segment.points:
            all_points.append({
                "lat": point.latitude,
                "lon": point.longitude,
                "elevation": point.elevation,
                "time": point.time.isoformat() if point.time else None
            })

    if not all_points:
        raise ValueError("No points found in GPX track")

    # Calculate statistics
    start_time = all_points[0]["time"]
    end_time = all_points[-1]["time"]

    # Calculate total distance
    moving_data = gpx.get_moving_data()
    uphill_data = gpx.get_uphill_downhill()

    duration = moving_data.moving_time if moving_data else 0
    distance = moving_data.moving_distance if moving_data else 0

    # Extract elevation data
    elevations = [p["elevation"] for p in all_points if p["elevation"] is not None]

    activity_data = {
        "name": track.name or "Unnamed Activity",
        "start_time": start_time,
        "end_time": end_time,
        "duration": duration,  # seconds
        "distance": distance,  # meters
        "points": all_points,
        "stats": {
            "total_points": len(all_points),
            "min_elevation": min(elevations) if elevations else None,
            "max_elevation": max(elevations) if elevations else None,
            "elevation_gain": uphill_data.uphill if uphill_data else None,
            "elevation_loss": uphill_data.downhill if uphill_data else None,
            "avg_speed": (distance / duration) if duration > 0 else 0,  # m/s
        }
    }

    return activity_data


@router.post("/upload")
async def upload_gpx_file(file: UploadFile = File(...)):
    """
    Upload a GPX file and parse it into activity data

    Returns the parsed activity data that can be saved to the database
    """
    if not file.filename.endswith(('.gpx', '.GPX')):
        raise HTTPException(status_code=400, detail="File must be a GPX file")

    try:
        # Read file content
        content = await file.read()
        gpx_string = content.decode('utf-8')

        # Parse GPX
        activity_data = parse_gpx_file(gpx_string)

        return {
            "success": True,
            "message": f"GPX file '{file.filename}' parsed successfully",
            "activity": activity_data
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing GPX file: {str(e)}"
        )


@router.post("/upload-and-save")
async def upload_and_save_gpx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a GPX file, parse it, and save to database

    This combines parsing and saving in one step
    """
    if not file.filename.endswith(('.gpx', '.GPX')):
        raise HTTPException(status_code=400, detail="File must be a GPX file")

    try:
        # Read and parse file
        content = await file.read()
        gpx_string = content.decode('utf-8')
        activity_data = parse_gpx_file(gpx_string)

        # Encode route as polyline for efficient storage
        route_points = [(p["lat"], p["lon"]) for p in activity_data["points"]]
        encoded_polyline = polyline.encode(route_points)

        # Parse start time to datetime
        start_datetime = datetime.fromisoformat(activity_data["start_time"])
        end_datetime = datetime.fromisoformat(activity_data["end_time"]) if activity_data["end_time"] else None

        # Create Activity record
        new_activity = Activity(
            name=activity_data["name"],
            source="gpx_upload",
            date=start_datetime.date(),
            start_time=start_datetime,
            end_time=end_datetime,
            distance_km=round(activity_data["distance"] / 1000, 2),
            duration_seconds=int(activity_data["duration"]),
            elevation_gain_m=int(activity_data["stats"]["elevation_gain"]) if activity_data["stats"]["elevation_gain"] else None,
            elevation_loss_m=int(activity_data["stats"]["elevation_loss"]) if activity_data["stats"]["elevation_loss"] else None,
            min_elevation_m=int(activity_data["stats"]["min_elevation"]) if activity_data["stats"]["min_elevation"] else None,
            max_elevation_m=int(activity_data["stats"]["max_elevation"]) if activity_data["stats"]["max_elevation"] else None,
            route_polyline=encoded_polyline,
            raw_gps_data=activity_data["points"]
        )

        db.add(new_activity)
        db.commit()
        db.refresh(new_activity)

        return {
            "success": True,
            "message": f"Activity '{activity_data['name']}' saved to database successfully",
            "activity": {
                "id": new_activity.id,
                "name": activity_data["name"],
                "start_time": activity_data["start_time"],
                "distance_km": round(activity_data["distance"] / 1000, 2),
                "duration_minutes": round(activity_data["duration"] / 60, 1),
                "elevation_gain_m": activity_data["stats"]["elevation_gain"],
                "points_count": activity_data["stats"]["total_points"]
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Error processing GPX file: {str(e)}"
        )