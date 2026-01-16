from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PlannedRoute(Base):
    __tablename__ = "planned_route"

    id = Column(Integer, primary_key=True, index=True)
    section_name = Column(String(255))  # e.g., "Geraldine to Lake Tekapo"
    section_order = Column(Integer, index=True)  # Order of sections
    route_polyline = Column(Text, nullable=False)  # Encoded polyline
    distance_km = Column(Numeric(6, 2))  # Distance of this section
    description = Column(Text)  # Optional description
    created_at = Column(DateTime(timezone=True), server_default=func.now())
