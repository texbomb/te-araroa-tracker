"""
Admin routes for database initialization and authentication
"""

from fastapi import APIRouter, HTTPException, Request
from app.database import engine, Base
from app.models.activity import Activity
from app.models.strava_token import StravaToken  # Import to ensure table is created
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
async def initialize_database():
    """
    Initialize database tables
    This should only be called once when deploying to a new environment
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
            "strava_tokens_table_exists": "strava_tokens" in tables
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }


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
