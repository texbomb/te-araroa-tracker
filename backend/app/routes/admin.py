"""
Admin routes for database initialization
"""

from fastapi import APIRouter, HTTPException
from app.database import engine, Base
from app.models.activity import Activity

router = APIRouter()


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
            "activities_table_exists": "activities" in tables
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }
