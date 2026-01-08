from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Te Araroa Tracker API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Import and include routers
from app.routes import garmin, activities, test_data
from app.routers import gpx

app.include_router(garmin.router, prefix="/api/garmin", tags=["garmin"])
app.include_router(activities.router, prefix="/api/activities", tags=["activities"])
app.include_router(test_data.router, prefix="/api/test", tags=["test-data"])
app.include_router(gpx.router, prefix="/api", tags=["gpx"])
# app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
# app.include_router(journal.router, prefix="/api/journal", tags=["journal"])
