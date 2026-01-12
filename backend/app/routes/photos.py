"""
Photo upload and management API routes
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List, Optional
from pathlib import Path
import uuid
import logging
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.photo import Photo
from app.utils.exif_extractor import extract_exif_data, validate_image_file
from app.utils.gps_utils import find_nearest_activity

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

# File upload configuration
UPLOAD_DIR = Path("/app/uploads/photos")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.JPG', '.JPEG', '.PNG', '.HEIC'}
ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/heic'}

# Ensure upload directory exists
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class PhotoResponse(BaseModel):
    """Photo response model."""
    id: int
    filename: str
    caption: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    altitude_m: Optional[float]
    date_taken: Optional[datetime]
    camera_make: Optional[str]
    camera_model: Optional[str]
    activity_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PhotoLocationResponse(BaseModel):
    """Simplified photo response for map markers."""
    id: int
    latitude: float
    longitude: float
    caption: Optional[str]
    date_taken: Optional[datetime]
    thumbnail_url: str

    class Config:
        from_attributes = True


def validate_file_type(filename: str, content_type: str) -> bool:
    """
    Validate file extension and MIME type.

    Args:
        filename: Original filename
        content_type: File MIME type

    Returns:
        True if valid, raises HTTPException otherwise
    """
    ext = Path(filename).suffix
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Check MIME type (don't fully trust client)
    if content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"Suspicious MIME type: {content_type} for file {filename}")

    return True


async def validate_file_size(file: UploadFile) -> bool:
    """
    Validate file size without loading entire file into memory.

    Args:
        file: UploadFile object

    Returns:
        True if valid, raises HTTPException otherwise
    """
    size = 0
    file.file.seek(0)

    # Read in chunks to avoid memory issues
    while chunk := await file.read(8192):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

    file.file.seek(0)  # Reset file pointer
    return True


def generate_safe_filename(original_filename: str) -> str:
    """
    Generate a safe, unique filename.

    Args:
        original_filename: Original uploaded filename

    Returns:
        Safe filename with timestamp and UUID
    """
    ext = Path(original_filename).suffix.lower()
    # Normalize extensions
    if ext in {'.jpeg'}:
        ext = '.jpg'

    unique_id = uuid.uuid4().hex[:12]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{timestamp}_{unique_id}{ext}"


def get_file_url(photo_id: int, filename: str, request: Request) -> str:
    """
    Generate photo file URL.

    Args:
        photo_id: Photo database ID
        filename: Photo filename
        request: FastAPI request object

    Returns:
        Full URL to photo file
    """
    base_url = str(request.base_url).rstrip('/')
    return f"{base_url}/api/photos/{photo_id}/file"


@router.post("/upload", response_model=PhotoResponse)
@limiter.limit("20/hour")  # Match GPX upload rate limit
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    activity_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload a photo with automatic EXIF extraction.

    Args:
        file: Image file (JPEG, PNG, HEIC)
        caption: Optional photo caption
        activity_id: Optional activity ID to link photo

    Returns:
        Photo metadata including extracted GPS coordinates
    """
    try:
        # Validate file type
        validate_file_type(file.filename, file.content_type)

        # Validate file size
        await validate_file_size(file)

        # Generate safe filename
        safe_filename = generate_safe_filename(file.filename)
        file_path = UPLOAD_DIR / safe_filename

        # Save file
        content = await file.read()
        with open(file_path, 'wb') as f:
            f.write(content)

        # Validate it's actually an image
        if not validate_image_file(str(file_path)):
            file_path.unlink()  # Delete invalid file
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Extract EXIF data
        exif_data = extract_exif_data(str(file_path))

        # Auto-link to nearest activity if not manually specified
        final_activity_id = activity_id
        if not activity_id and exif_data.latitude and exif_data.longitude:
            # Find nearest activity within 5km
            nearest_activity_id = find_nearest_activity(
                exif_data.latitude,
                exif_data.longitude,
                db,
                max_distance_km=5.0
            )
            if nearest_activity_id:
                final_activity_id = nearest_activity_id
                logger.info(f"Auto-linked photo to activity {nearest_activity_id}")

        # Create Photo record
        new_photo = Photo(
            filename=file.filename,
            file_path=str(file_path),
            caption=caption,
            latitude=exif_data.latitude,
            longitude=exif_data.longitude,
            altitude_m=exif_data.altitude,
            date_taken=exif_data.date_taken or datetime.now(),  # Default to now if no EXIF
            camera_make=exif_data.camera_make,
            camera_model=exif_data.camera_model,
            activity_id=final_activity_id
        )

        db.add(new_photo)
        db.commit()
        db.refresh(new_photo)

        logger.info(f"Photo uploaded: {safe_filename} (ID: {new_photo.id})")

        return PhotoResponse.model_validate(new_photo)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading photo: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading photo: {str(e)}"
        )


@router.get("", response_model=List[PhotoResponse])
@limiter.limit("60/minute")  # Same as activities
async def get_photos(
    request: Request,
    response: Response,
    activity_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all photos with optional filtering.

    Args:
        activity_id: Filter by activity ID
        start_date: Filter by date taken (YYYY-MM-DD)
        end_date: Filter by date taken (YYYY-MM-DD)

    Returns:
        List of photos
    """
    # Cache for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"

    query = db.query(Photo).order_by(Photo.date_taken.desc())

    # Apply filters
    if activity_id:
        query = query.filter(Photo.activity_id == activity_id)

    if start_date:
        start = datetime.fromisoformat(start_date)
        query = query.filter(Photo.date_taken >= start)

    if end_date:
        end = datetime.fromisoformat(end_date)
        query = query.filter(Photo.date_taken <= end)

    photos = query.all()
    return [PhotoResponse.model_validate(photo) for photo in photos]


@router.get("/by-location", response_model=List[PhotoLocationResponse])
@limiter.limit("60/minute")
async def get_photos_with_location(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Get all photos that have GPS coordinates (for map markers).

    Returns:
        List of photos with location data
    """
    # Cache for 5 minutes
    response.headers["Cache-Control"] = "public, max-age=300"

    photos = db.query(Photo).filter(
        Photo.latitude.isnot(None),
        Photo.longitude.isnot(None)
    ).order_by(Photo.date_taken.desc()).all()

    return [
        PhotoLocationResponse(
            id=photo.id,
            latitude=float(photo.latitude),
            longitude=float(photo.longitude),
            caption=photo.caption,
            date_taken=photo.date_taken,
            thumbnail_url=get_file_url(photo.id, photo.filename, request)
        )
        for photo in photos
    ]


@router.get("/{photo_id}", response_model=PhotoResponse)
@limiter.limit("60/minute")
async def get_photo(
    photo_id: int,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Get a single photo by ID.

    Args:
        photo_id: Photo ID

    Returns:
        Photo metadata
    """
    response.headers["Cache-Control"] = "public, max-age=300"

    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    return PhotoResponse.model_validate(photo)


@router.get("/{photo_id}/file")
@limiter.limit("120/minute")  # Higher limit for image serving
async def get_photo_file(request: Request, photo_id: int, db: Session = Depends(get_db)):
    """
    Serve photo file.

    Args:
        photo_id: Photo ID

    Returns:
        Image file
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = Path(photo.file_path)
    if not file_path.exists():
        logger.error(f"Photo file not found: {file_path}")
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(
        path=file_path,
        media_type="image/jpeg",  # Generic, browser will handle
        filename=photo.filename
    )


@router.delete("/{photo_id}")
@limiter.limit("30/hour")  # Limit deletions
async def delete_photo(
    photo_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Delete a photo (admin only in production).

    Args:
        photo_id: Photo ID

    Returns:
        Success message
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Delete file from disk
    file_path = Path(photo.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            logger.error(f"Failed to delete photo file {file_path}: {e}")

    # Delete database record
    db.delete(photo)
    db.commit()

    logger.info(f"Photo deleted: ID {photo_id}")

    return {"success": True, "message": f"Photo {photo_id} deleted"}


@router.post("/{photo_id}", response_model=PhotoResponse)
@limiter.limit("60/hour")
async def update_photo(
    photo_id: int,
    request: Request,
    caption: Optional[str] = Form(None),
    activity_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Update photo metadata.

    Args:
        photo_id: Photo ID
        caption: New caption
        activity_id: New activity link

    Returns:
        Updated photo
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Update fields
    if caption is not None:
        photo.caption = caption
    if activity_id is not None:
        photo.activity_id = activity_id

    db.commit()
    db.refresh(photo)

    logger.info(f"Photo updated: ID {photo_id}")

    return PhotoResponse.model_validate(photo)


@router.post("/relink-all")
@limiter.limit("5/hour")  # Limit batch operations
async def relink_all_photos_to_activities(
    request: Request,
    max_distance_km: float = 5.0,
    db: Session = Depends(get_db)
):
    """
    Re-link all photos to their nearest activities based on GPS proximity.

    Useful for:
    - Updating links after adding new activities
    - Fixing links if activities were deleted
    - Testing different distance thresholds

    Args:
        max_distance_km: Maximum distance threshold in kilometers (default 5.0)

    Returns:
        Summary of linking results
    """
    # Get all photos with GPS coordinates
    photos = db.query(Photo).filter(
        Photo.latitude.isnot(None),
        Photo.longitude.isnot(None)
    ).all()

    if not photos:
        return {
            "success": True,
            "message": "No photos with GPS coordinates to process",
            "linked": 0,
            "unlinked": 0,
            "total": 0
        }

    linked_count = 0
    unlinked_count = 0

    for photo in photos:
        # Find nearest activity
        nearest_activity_id = find_nearest_activity(
            float(photo.latitude),
            float(photo.longitude),
            db,
            max_distance_km=max_distance_km
        )

        if nearest_activity_id:
            photo.activity_id = nearest_activity_id
            linked_count += 1
        else:
            # Unlink if no nearby activity found
            photo.activity_id = None
            unlinked_count += 1

    db.commit()

    logger.info(
        f"Re-linked {linked_count} photos, "
        f"unlinked {unlinked_count} photos "
        f"(threshold: {max_distance_km}km)"
    )

    return {
        "success": True,
        "message": f"Re-linked photos to activities within {max_distance_km}km",
        "linked": linked_count,
        "unlinked": unlinked_count,
        "total": len(photos)
    }
