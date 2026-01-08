from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
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

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
