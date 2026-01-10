from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.strava_sync import StravaSyncService
from app.config import get_settings
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
settings = get_settings()


@router.get("/auth/authorize")
async def get_authorization_url(
    request: Request,
    redirect_uri: str = Query(..., description="OAuth callback URL")
):
    """
    Get Strava OAuth authorization URL to redirect user to

    Args:
        redirect_uri: Your backend callback URL (e.g., https://your-app.railway.app/api/strava/callback)

    Returns:
        Authorization URL to redirect user to
    """
    if not settings.strava_client_id:
        raise HTTPException(
            status_code=500,
            detail="Strava Client ID not configured. Please set STRAVA_CLIENT_ID in environment variables."
        )

    service = StravaSyncService()
    auth_url = service.get_authorization_url(redirect_uri=redirect_uri)

    return {
        "authorization_url": auth_url,
        "instructions": "Redirect user to this URL to authorize access to Strava"
    }


@router.get("/auth/callback")
async def oauth_callback(
    code: str = Query(None, description="Authorization code from Strava"),
    error: str = Query(None, description="Error from Strava"),
    scope: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    OAuth callback endpoint - Strava redirects here after user authorization
    After token exchange, redirects to frontend with status

    Args:
        code: Authorization code from Strava
        error: Error message if authorization failed
        scope: Granted scopes (optional)
        db: Database session

    Returns:
        Redirect to frontend with success or error status
    """
    from fastapi.responses import RedirectResponse
    import os

    # Get frontend URL from environment or use default
    # Strip trailing slash to avoid URL issues
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    # Handle authorization error
    if error:
        return RedirectResponse(
            url=f"{frontend_url}/admin?strava_error={error}",
            status_code=302
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_url}/admin?strava_error=no_code",
            status_code=302
        )

    service = StravaSyncService()

    try:
        result = await service.exchange_code_for_token(code, db)

        # Redirect to frontend with success
        athlete_name = f"{result['athlete'].get('firstname', '')} {result['athlete'].get('lastname', '')}".strip()
        return RedirectResponse(
            url=f"{frontend_url}/admin?strava_connected=true&athlete_name={athlete_name}",
            status_code=302
        )

    except Exception as e:
        # Redirect to frontend with error
        return RedirectResponse(
            url=f"{frontend_url}/admin?strava_error={str(e)}",
            status_code=302
        )


@router.get("/auth/status")
async def get_auth_status(db: Session = Depends(get_db)):
    """
    Check Strava connection status

    Returns:
        Connection status and expiration information
    """
    service = StravaSyncService()
    status = await service.get_connection_status(db)

    return status


@router.post("/auth/disconnect")
@limiter.limit("5/minute")
async def disconnect_strava(request: Request, db: Session = Depends(get_db)):
    """
    Disconnect Strava account by removing stored tokens

    Returns:
        Success message
    """
    from app.models.strava_token import StravaToken

    token_record = db.query(StravaToken).first()

    if not token_record:
        raise HTTPException(status_code=404, detail="No Strava connection found")

    db.delete(token_record)
    db.commit()

    return {
        "success": True,
        "message": "Strava account disconnected successfully"
    }


@router.post("/sync")
@limiter.limit("10/hour")
async def sync_activities(
    request: Request,
    days: int = Query(30, ge=1, le=180, description="Number of days to sync (max 180)"),
    db: Session = Depends(get_db)
):
    """
    Manually trigger Strava activity sync

    Args:
        days: Number of past days to sync (default 30, max 180)
        db: Database session

    Returns:
        Number of new activities synced
    """
    service = StravaSyncService()

    # Check if authenticated
    status = await service.get_connection_status(db)
    if not status["connected"]:
        raise HTTPException(
            status_code=401,
            detail="Not connected to Strava. Please authorize first."
        )

    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    try:
        new_count = await service.fetch_activities(
            db=db,
            start_date=start_date,
            end_date=end_date
        )

        return {
            "success": True,
            "message": f"Sync completed successfully",
            "new_activities": new_count,
            "days_synced": days
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/webhook")
async def verify_webhook(
    request: Request,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    Verify Strava webhook subscription

    This endpoint is called by Strava to verify your webhook endpoint.
    Required for webhook setup.

    Returns:
        Hub challenge for verification
    """
    if not settings.strava_webhook_verify_token:
        raise HTTPException(
            status_code=500,
            detail="Webhook verify token not configured"
        )

    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="Invalid mode")

    if hub_verify_token != settings.strava_webhook_verify_token:
        raise HTTPException(status_code=403, detail="Invalid verify token")

    # Return the challenge to verify the webhook
    return {"hub.challenge": hub_challenge}


@router.post("/webhook")
@limiter.limit("100/minute")
async def webhook_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receive Strava webhook events for activity updates

    Event types:
    - create: New activity created
    - update: Activity updated
    - delete: Activity deleted

    Returns:
        Success status
    """
    try:
        event = await request.json()

        # Validate event structure
        if "object_type" not in event or "aspect_type" not in event:
            raise HTTPException(status_code=400, detail="Invalid event structure")

        # Only process activity events
        if event["object_type"] != "activity":
            return {"status": "ignored", "reason": "Not an activity event"}

        aspect_type = event["aspect_type"]
        activity_id = event.get("object_id")

        if aspect_type == "create":
            # New activity created - fetch and save it
            service = StravaSyncService()
            access_token = await service.get_valid_token(db)

            if not access_token:
                return {"status": "error", "reason": "Not authenticated"}

            # Check if activity already exists
            from app.models.activity import Activity
            existing = db.query(Activity).filter(
                Activity.strava_activity_id == activity_id
            ).first()

            if existing:
                return {"status": "ignored", "reason": "Activity already exists"}

            # Fetch and save the new activity
            activity_data = await service._fetch_activity_details(activity_id, access_token)
            new_activity = service._create_activity_from_strava(activity_data, db)
            db.add(new_activity)
            db.commit()

            return {
                "status": "success",
                "action": "created",
                "activity_id": activity_id
            }

        elif aspect_type == "update":
            # Activity updated - you could re-fetch and update here
            return {"status": "ignored", "reason": "Updates not processed"}

        elif aspect_type == "delete":
            # Activity deleted - optionally delete from your database
            from app.models.activity import Activity
            activity = db.query(Activity).filter(
                Activity.strava_activity_id == activity_id
            ).first()

            if activity:
                db.delete(activity)
                db.commit()
                return {
                    "status": "success",
                    "action": "deleted",
                    "activity_id": activity_id
                }

            return {"status": "ignored", "reason": "Activity not found"}

        return {"status": "ignored"}

    except Exception as e:
        # Log error but return 200 to prevent Strava from retrying
        print(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}
