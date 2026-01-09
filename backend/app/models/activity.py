from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, BigInteger, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))  # Activity name from GPX, Garmin, or Strava
    source = Column(String(50), nullable=False, default="garmin")  # "garmin", "gpx_upload", or "strava"
    garmin_activity_id = Column(BigInteger, unique=True, nullable=True, index=True)  # Nullable for manual uploads
    strava_activity_id = Column(BigInteger, unique=True, nullable=True, index=True)  # Nullable for non-Strava sources
    date = Column(Date, nullable=False, index=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    distance_km = Column(Numeric(10, 2))  # Increased precision for longer distances
    elevation_gain_m = Column(Integer)
    elevation_loss_m = Column(Integer)  # Added for GPX data
    min_elevation_m = Column(Integer)  # Added for GPX data
    max_elevation_m = Column(Integer)  # Added for GPX data
    duration_seconds = Column(Integer)
    avg_heart_rate = Column(Integer)
    max_heart_rate = Column(Integer)
    calories = Column(Integer)
    route_polyline = Column(Text)  # Encoded polyline
    raw_gps_data = Column(JSON)  # Full GPS trackpoints (JSON for SQLite compatibility)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
