from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from app.config import get_settings
import os

settings = get_settings()

# Use DATABASE_URL from environment (automatically set by Railway)
# For local development, falls back to SQLite
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Local development fallback
    DATABASE_URL = "sqlite:///./test.db"

# Configure connection pooling for PostgreSQL (free tier optimization)
# Railway/Supabase allow 60 concurrent connections - we limit to 5 for efficiency
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
