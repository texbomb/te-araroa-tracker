from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, Text
from sqlalchemy.sql import func
from app.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    caption = Column(Text)

    # Geolocation data
    latitude = Column(Numeric(10, 8))  # -90 to 90 degrees
    longitude = Column(Numeric(11, 8))  # -180 to 180 degrees
    altitude_m = Column(Numeric(10, 2))  # Altitude in meters

    # Photo metadata
    date_taken = Column(DateTime(timezone=True), index=True)
    camera_make = Column(String(100))
    camera_model = Column(String(100))

    # Optional link to activity
    activity_id = Column(Integer, nullable=True, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
