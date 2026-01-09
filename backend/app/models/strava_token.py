from sqlalchemy import Column, Integer, String, BigInteger, DateTime
from sqlalchemy.sql import func
from app.database import Base


class StravaToken(Base):
    """Store Strava OAuth tokens for API access"""
    __tablename__ = "strava_tokens"

    id = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(BigInteger, unique=True, nullable=False, index=True)  # Strava athlete ID
    access_token = Column(String(255), nullable=False)  # Current access token (expires after 6 hours)
    refresh_token = Column(String(255), nullable=False)  # Refresh token (long-lived)
    expires_at = Column(BigInteger, nullable=False)  # Unix timestamp when access token expires
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
