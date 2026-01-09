"""
Garmin Connect API routes
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.services.garmin_sync import garmin_service
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class SyncResponse(BaseModel):
    success: bool
    message: str
    activities_synced: int


class StatusResponse(BaseModel):
    authenticated: bool
    last_sync: str | None


@router.post("/sync", response_model=SyncResponse)
@limiter.limit("10/hour")  # Limit to 10 syncs per hour to prevent API abuse
async def sync_garmin(request: Request, db: Session = Depends(get_db)):
    """
    Manually trigger a sync with Garmin Connect
    Fetches activities from the last 30 days
    """
    try:
        # Sync last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        activities_synced = garmin_service.fetch_activities(start_date, end_date, db)

        return SyncResponse(
            success=True,
            message=f"Successfully synced {activities_synced} new activities",
            activities_synced=activities_synced
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=StatusResponse)
@limiter.limit("30/minute")  # Allow checking status frequently but not excessively
async def get_status(request: Request):
    """Get Garmin sync status"""
    return StatusResponse(
        authenticated=garmin_service.authenticated,
        last_sync=None  # TODO: Store last sync time in database
    )