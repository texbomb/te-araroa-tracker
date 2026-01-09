from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from app.config import get_settings
import os

settings = get_settings()

# Use DATABASE_URL if set, otherwise construct from Supabase URL
# For now, we'll use Supabase's REST API via the service, not direct PostgreSQL
# DATABASE_URL will be set when deploying or can be manually configured
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Extract project ref from Supabase URL for PostgreSQL connection
    # Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
    # For local dev, we'll skip database for now since we're using Supabase's REST API
    DATABASE_URL = "sqlite:///./test.db"  # Fallback for local development

# Configure connection pooling for PostgreSQL (free tier optimization)
# Supabase free tier allows 60 concurrent connections - we limit to 5 to leave headroom
if DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,              # Max 5 persistent connections (free tier: 60 total)
        max_overflow=2,           # Allow 2 extra connections during high load
        pool_timeout=30,          # Wait max 30s for a connection
        pool_recycle=3600,        # Recycle connections after 1 hour
        pool_pre_ping=True,       # Verify connections before use (prevents stale connections)
    )
else:
    # SQLite for local development - use StaticPool for thread safety
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
