"""
Garmin Connect sync service
Fetches activities from Garmin Connect and stores them in the database
"""

import garth
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.activity import Activity
from app.config import get_settings
import polyline
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class GarminSyncService:
    def __init__(self):
        self.authenticated = False

    def authenticate(self):
        """Authenticate with Garmin Connect using garth"""
        try:
            logger.info(f"Attempting to authenticate with Garmin Connect for user: {settings.garmin_email}")
            garth.login(settings.garmin_email, settings.garmin_password)
            # Workaround: Set a dummy profile to bypass the assertion error in garminconnect library
            if not garth.client._profile:
                garth.client._profile = {
                    "displayName": "User",
                    "userName": settings.garmin_email
                }
            self.authenticated = True
            logger.info("Successfully authenticated with Garmin Connect")
            return True
        except Exception as e:
            logger.error(f"Garmin authentication failed: {str(e)}")
            logger.exception("Full traceback:")
            self.authenticated = False
            return False

    def fetch_activities(self, start_date: datetime, end_date: datetime, db: Session):
        """
        Fetch activities from Garmin Connect and store in database

        Args:
            start_date: Start date for activity search
            end_date: End date for activity search
            db: Database session

        Returns:
            Number of new activities synced
        """
        if not self.authenticated:
            if not self.authenticate():
                raise Exception("Failed to authenticate with Garmin Connect")

        try:
            # Fetch activities from Garmin using garth directly
            response = garth.client.get(
                "connectapi",
                "/activitylist-service/activities/search/activities",
                api=True,
                params={"start": 0, "limit": 100}
            )

            if response.status_code != 200:
                raise Exception(f"Failed to fetch activities: {response.text}")

            activities = response.json()
            logger.info(f"Fetched {len(activities)} activities from Garmin")

            new_activities = 0

            for garmin_activity in activities:
                activity_id = garmin_activity.get('activityId')
                if not activity_id:
                    continue

                # Check if activity already exists
                existing = db.query(Activity).filter(
                    Activity.garmin_activity_id == activity_id
                ).first()

                if existing:
                    logger.info(f"Activity {activity_id} already exists, skipping")
                    continue

                # Get detailed activity data including GPS
                try:
                    detail_response = garth.client.get(
                        "connectapi",
                        f"/activity-service/activity/{activity_id}",
                        api=True
                    )
                    activity_details = detail_response.json() if detail_response.status_code == 200 else garmin_activity

                    # Fetch GPS data
                    gps_response = garth.client.get(
                        "connectapi",
                        f"/activity-service/activity/{activity_id}/details",
                        api=True
                    )
                    gps_data = gps_response.json() if gps_response.status_code == 200 else None
                except Exception as e:
                    logger.warning(f"Could not fetch details for activity {activity_id}: {str(e)}")
                    activity_details = garmin_activity
                    gps_data = None

                # Parse activity data
                activity_data = self._parse_activity(garmin_activity, activity_details, gps_data)

                # Create new activity record
                new_activity = Activity(**activity_data)
                db.add(new_activity)
                new_activities += 1
                logger.info(f"Added new activity: {activity_id}")

            db.commit()
            logger.info(f"Synced {new_activities} new activities")
            return new_activities

        except Exception as e:
            logger.error(f"Error fetching activities: {str(e)}")
            db.rollback()
            raise

    def _parse_activity(self, basic_data: dict, details: dict, gps_data: dict) -> dict:
        """Parse Garmin activity data into our database format"""

        # Extract basic info
        activity_id = basic_data.get('activityId')
        activity_name = basic_data.get('activityName', 'Unknown')

        # Parse dates
        start_time_str = basic_data.get('startTimeLocal') or basic_data.get('beginTimestamp')
        if start_time_str:
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            date = start_time.date()
        else:
            start_time = None
            date = datetime.now().date()

        # Calculate duration
        duration_seconds = basic_data.get('duration') or basic_data.get('movingDuration')

        # Get distance (convert meters to km)
        distance_m = basic_data.get('distance', 0)
        distance_km = distance_m / 1000 if distance_m else None

        # Get elevation gain
        elevation_gain = basic_data.get('elevationGain')

        # Get heart rate data
        avg_hr = basic_data.get('averageHR')
        max_hr = basic_data.get('maxHR')

        # Get calories
        calories = basic_data.get('calories')

        # Process GPS data into polyline
        route_polyline = None
        if gps_data and isinstance(gps_data, list):
            # Extract lat/lng pairs
            coords = []
            for point in gps_data:
                lat = point.get('lat') or point.get('latitude')
                lng = point.get('lng') or point.get('longitude')
                if lat and lng:
                    coords.append((lat, lng))

            # Encode as polyline
            if coords:
                route_polyline = polyline.encode(coords)

        return {
            'garmin_activity_id': activity_id,
            'date': date,
            'start_time': start_time,
            'distance_km': distance_km,
            'elevation_gain_m': elevation_gain,
            'duration_seconds': duration_seconds,
            'avg_heart_rate': avg_hr,
            'max_heart_rate': max_hr,
            'calories': calories,
            'route_polyline': route_polyline,
            'raw_gps_data': gps_data,
        }


# Singleton instance
garmin_service = GarminSyncService()