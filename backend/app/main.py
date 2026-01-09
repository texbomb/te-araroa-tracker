from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import get_settings
import os

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)

# GZip compression middleware - compress responses to save bandwidth (free tier optimization)
# Compresses responses larger than 1KB, typically saves 70%+ bandwidth on JSON responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware for frontend - restrict to specific domains for security
# and to prevent unauthorized usage that could exceed free tier limits
origins = [
    "http://localhost:3000",  # Local development
    "http://localhost:3001",  # Alternative local port
]

# Add production frontend URL if set in environment
if frontend_url := os.getenv("FRONTEND_URL"):
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Only allow needed methods
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Te Araroa Tracker API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Import and include routers
from app.routes import garmin, activities, test_data, admin
from app.routers import gpx

app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(garmin.router, prefix="/api/garmin", tags=["garmin"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(test_data.router, prefix="/api/test", tags=["test-data"])
app.include_router(gpx.router, prefix="/api", tags=["gpx"])
# app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
# app.include_router(journal.router, prefix="/api/journal", tags=["journal"])
