"""
Admin routes for database initialization and authentication
"""

from fastapi import APIRouter, HTTPException, Request
from app.database import engine, Base
from app.models.activity import Activity
from app.models.strava_token import StravaToken
from app.models.photo import Photo  # Import to ensure table is created
from app.config import get_settings
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


class PasswordVerifyRequest(BaseModel):
    password: str


@router.post("/init-db")
@router.get("/init-db")
async def initialize_database():
    """
    Initialize database tables
    This should only be called once when deploying to a new environment
    Supports both GET and POST for easy browser access
    """
    try:
        Base.metadata.create_all(bind=engine)
        return {
            "success": True,
            "message": "Database tables created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize database: {str(e)}"
        )


@router.get("/db-status")
async def database_status():
    """Check if database tables exist"""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        return {
            "connected": True,
            "tables": tables,
            "activities_table_exists": "activities" in tables,
            "strava_tokens_table_exists": "strava_tokens" in tables,
            "photos_table_exists": "photos" in tables
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }


@router.post("/migrate-db")
@router.get("/migrate-db")
async def migrate_database():
    """
    Add missing columns to existing tables
    Safe to run multiple times - checks if columns exist first
    """
    try:
        from sqlalchemy import text, inspect

        results = []
        inspector = inspect(engine)

        # Check if activities table exists
        if "activities" not in inspector.get_table_names():
            results.append({"table": "activities", "status": "Table does not exist, run /init-db first"})
            return {"success": False, "results": results}

        # Get existing columns in activities table
        existing_columns = [col["name"] for col in inspector.get_columns("activities")]

        # Add strava_activity_id column if it doesn't exist
        if "strava_activity_id" not in existing_columns:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE activities ADD COLUMN strava_activity_id BIGINT UNIQUE"
                ))
                conn.commit()
            results.append({"column": "strava_activity_id", "status": "added"})
        else:
            results.append({"column": "strava_activity_id", "status": "already exists"})

        return {
            "success": True,
            "message": "Database migration completed",
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {str(e)}"
        )


@router.post("/verify")
@limiter.limit("3/15minute")  # Only 3 attempts per 15 minutes to prevent brute force
async def verify_admin_password(request: Request, data: PasswordVerifyRequest):
    """
    Verify admin password for upload access
    Rate limited to 3 attempts per 15 minutes per IP
    """
    if not settings.admin_password:
        raise HTTPException(
            status_code=500,
            detail="Admin password not configured on server"
        )

    if data.password == settings.admin_password:
        return {
            "success": True,
            "message": "Authentication successful"
        }
    else:
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )
