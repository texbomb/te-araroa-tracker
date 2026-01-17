from sqlalchemy import Column, Integer, String, Boolean, Numeric, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class RouteSection(Base):
    __tablename__ = "route_sections"

    id = Column(Integer, primary_key=True, index=True)
    full_route_id = Column(Integer, ForeignKey("planned_route.id", ondelete="CASCADE"), nullable=False)
    section_name = Column(String(255), nullable=False)
    start_point_index = Column(Integer, nullable=False)
    end_point_index = Column(Integer, nullable=False)
    start_distance_km = Column(Numeric(6, 2), nullable=False)
    end_distance_km = Column(Numeric(6, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to planned_route
    planned_route = relationship("PlannedRoute", back_populates="sections")

    # Table constraints
    __table_args__ = (
        CheckConstraint('start_point_index >= 0 AND end_point_index > start_point_index', name='valid_indices'),
        CheckConstraint('start_distance_km >= 0 AND end_distance_km > start_distance_km', name='valid_distances'),
    )
