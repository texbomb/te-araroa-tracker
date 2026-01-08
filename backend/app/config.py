from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Supabase (optional - not currently used)
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # Garmin (optional - only needed for auto-sync)
    garmin_email: Optional[str] = None
    garmin_password: Optional[str] = None

    # Cloudinary (optional - not currently used)
    cloudinary_cloud_name: Optional[str] = None
    cloudinary_api_key: Optional[str] = None
    cloudinary_api_secret: Optional[str] = None

    # Admin (optional - for future authentication)
    admin_password: Optional[str] = None

    # App
    app_name: str = "Te Araroa Tracker"
    debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
