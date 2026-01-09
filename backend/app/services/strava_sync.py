import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import httpx
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.activity import Activity
from app.models.strava_token import StravaToken
import polyline


class StravaSyncService:
    """Service for syncing activities from Strava API"""

    BASE_URL = "https://www.strava.com/api/v3"
    OAUTH_URL = "https://www.strava.com/oauth"

    def __init__(self):
        self.settings = get_settings()

    def get_authorization_url(self, redirect_uri: str, state: Optional[str] = None) -> str:
        """
        Generate Strava OAuth authorization URL

        Args:
            redirect_uri: Your backend callback URL (e.g., https://your-app.railway.app/api/strava/callback)
            state: Optional state parameter for CSRF protection

        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.settings.strava_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "activity:read_all",
            "approval_prompt": "auto"
        }

        if state:
            params["state"] = state

        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.OAUTH_URL}/authorize?{query_string}"

    async def exchange_code_for_token(self, code: str, db: Session) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens

        Args:
            code: Authorization code from OAuth callback
            db: Database session

        Returns:
            Dictionary with athlete and token information
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.OAUTH_URL}/token",
                data={
                    "client_id": self.settings.strava_client_id,
                    "client_secret": self.settings.strava_client_secret,
                    "code": code,
                    "grant_type": "authorization_code"
                }
            )
            response.raise_for_status()
            data = response.json()

        # Store tokens in database
        athlete_id = data["athlete"]["id"]
        token_record = db.query(StravaToken).filter(StravaToken.athlete_id == athlete_id).first()

        if token_record:
            # Update existing tokens
            token_record.access_token = data["access_token"]
            token_record.refresh_token = data["refresh_token"]
            token_record.expires_at = data["expires_at"]
        else:
            # Create new token record
            token_record = StravaToken(
                athlete_id=athlete_id,
                access_token=data["access_token"],
                refresh_token=data["refresh_token"],
                expires_at=data["expires_at"]
            )
            db.add(token_record)

        db.commit()
        db.refresh(token_record)

        return {
            "athlete": data["athlete"],
            "access_token": data["access_token"],
            "expires_at": data["expires_at"]
        }

    async def get_valid_token(self, db: Session) -> Optional[str]:
        """
        Get a valid access token, refreshing if necessary

        Args:
            db: Database session

        Returns:
            Valid access token or None if not authenticated
        """
        token_record = db.query(StravaToken).first()

        if not token_record:
            return None

        current_time = int(time.time())

        # If token expires in less than 5 minutes, refresh it
        if current_time >= (token_record.expires_at - 300):
            await self._refresh_access_token(token_record, db)

        return token_record.access_token

    async def _refresh_access_token(self, token_record: StravaToken, db: Session):
        """
        Refresh the access token using refresh token

        Args:
            token_record: StravaToken database record
            db: Database session
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.OAUTH_URL}/token",
                data={
                    "client_id": self.settings.strava_client_id,
                    "client_secret": self.settings.strava_client_secret,
                    "refresh_token": token_record.refresh_token,
                    "grant_type": "refresh_token"
                }
            )
            response.raise_for_status()
            data = response.json()

        # Update token record
        token_record.access_token = data["access_token"]
        token_record.refresh_token = data["refresh_token"]
        token_record.expires_at = data["expires_at"]
        db.commit()

    async def fetch_activities(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        per_page: int = 30
    ) -> int:
        """
        Fetch activities from Strava and save to database

        Args:
            db: Database session
            start_date: Optional start date filter
            end_date: Optional end date filter
            per_page: Number of activities per page (max 200)

        Returns:
            Number of new activities synced
        """
        access_token = await self.get_valid_token(db)

        if not access_token:
            raise ValueError("Not authenticated with Strava. Please connect your account first.")

        # Default to last 30 days if no date range provided
        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)

        # Convert to Unix timestamp
        after_timestamp = int(start_date.timestamp()) if start_date else None
        before_timestamp = int(end_date.timestamp()) if end_date else None

        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"per_page": per_page, "page": 1}

        if after_timestamp:
            params["after"] = after_timestamp
        if before_timestamp:
            params["before"] = before_timestamp

        new_activities_count = 0

        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"{self.BASE_URL}/athlete/activities",
                    headers=headers,
                    params=params
                )
                response.raise_for_status()
                activities = response.json()

                if not activities:
                    break

                for strava_activity in activities:
                    # Check if activity already exists
                    existing = db.query(Activity).filter(
                        Activity.strava_activity_id == strava_activity["id"]
                    ).first()

                    if existing:
                        continue  # Skip already synced activities

                    # Fetch detailed activity data with GPS streams
                    activity_data = await self._fetch_activity_details(
                        strava_activity["id"],
                        access_token
                    )

                    # Save to database
                    new_activity = self._create_activity_from_strava(activity_data, db)
                    db.add(new_activity)
                    new_activities_count += 1

                db.commit()

                # Check if there are more pages
                if len(activities) < per_page:
                    break

                params["page"] += 1

        return new_activities_count

    async def _fetch_activity_details(self, activity_id: int, access_token: str) -> Dict[str, Any]:
        """
        Fetch detailed activity data including GPS streams

        Args:
            activity_id: Strava activity ID
            access_token: Valid Strava access token

        Returns:
            Combined activity data with streams
        """
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            # Fetch basic activity details
            activity_response = await client.get(
                f"{self.BASE_URL}/activities/{activity_id}",
                headers=headers
            )
            activity_response.raise_for_status()
            activity = activity_response.json()

            # Fetch GPS streams (latlng, altitude, time, heartrate)
            streams_response = await client.get(
                f"{self.BASE_URL}/activities/{activity_id}/streams",
                headers=headers,
                params={
                    "keys": "latlng,altitude,time,heartrate",
                    "key_by_type": True
                }
            )

            if streams_response.status_code == 200:
                activity["streams"] = streams_response.json()
            else:
                activity["streams"] = {}

        return activity

    def _create_activity_from_strava(self, strava_data: Dict[str, Any], db: Session) -> Activity:
        """
        Convert Strava activity data to Activity model

        Args:
            strava_data: Strava activity data with streams
            db: Database session

        Returns:
            Activity model instance
        """
        # Parse date and time
        start_date_local = datetime.fromisoformat(strava_data["start_date_local"].replace("Z", "+00:00"))

        # Calculate end time
        elapsed_time = strava_data.get("elapsed_time", 0)
        end_time = start_date_local + timedelta(seconds=elapsed_time)

        # Extract GPS data and create polyline
        raw_gps_data = []
        route_polyline_str = None
        min_elevation = None
        max_elevation = None

        streams = strava_data.get("streams", {})

        if "latlng" in streams and "altitude" in streams and "time" in streams:
            latlng_data = streams["latlng"]["data"]
            altitude_data = streams["altitude"]["data"]
            time_data = streams["time"]["data"]

            for i, (lat, lng) in enumerate(latlng_data):
                raw_gps_data.append({
                    "lat": lat,
                    "lng": lng,
                    "elevation": altitude_data[i] if i < len(altitude_data) else None,
                    "time": time_data[i] if i < len(time_data) else None
                })

            # Create polyline from coordinates
            route_polyline_str = polyline.encode(latlng_data, 5)

            # Calculate elevation min/max
            if altitude_data:
                min_elevation = int(min(altitude_data))
                max_elevation = int(max(altitude_data))
        elif strava_data.get("map", {}).get("polyline"):
            # Use Strava's polyline if streams not available
            route_polyline_str = strava_data["map"]["polyline"]

        # Create Activity instance
        activity = Activity(
            name=strava_data.get("name", "Unnamed Activity"),
            source="strava",
            strava_activity_id=strava_data["id"],
            date=start_date_local.date(),
            start_time=start_date_local,
            end_time=end_time,
            distance_km=round(strava_data.get("distance", 0) / 1000, 2),  # meters to km
            elevation_gain_m=int(strava_data.get("total_elevation_gain", 0)),
            elevation_loss_m=None,  # Strava doesn't provide this directly
            min_elevation_m=min_elevation,
            max_elevation_m=max_elevation,
            duration_seconds=strava_data.get("moving_time", 0),
            avg_heart_rate=int(strava_data.get("average_heartrate", 0)) if strava_data.get("average_heartrate") else None,
            max_heart_rate=int(strava_data.get("max_heartrate", 0)) if strava_data.get("max_heartrate") else None,
            calories=int(strava_data.get("calories", 0)) if strava_data.get("calories") else None,
            route_polyline=route_polyline_str,
            raw_gps_data=raw_gps_data if raw_gps_data else None
        )

        return activity

    async def get_connection_status(self, db: Session) -> Dict[str, Any]:
        """
        Check Strava connection status

        Args:
            db: Database session

        Returns:
            Dictionary with connection status information
        """
        token_record = db.query(StravaToken).first()

        if not token_record:
            return {
                "connected": False,
                "athlete_id": None,
                "expires_at": None
            }

        current_time = int(time.time())
        is_expired = current_time >= token_record.expires_at

        return {
            "connected": True,
            "athlete_id": token_record.athlete_id,
            "expires_at": token_record.expires_at,
            "is_expired": is_expired,
            "expires_in_seconds": max(0, token_record.expires_at - current_time)
        }
