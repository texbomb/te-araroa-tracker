"""
EXIF data extraction utility for photos.

Extracts GPS coordinates, camera metadata, and timestamps from image EXIF data.
"""

from PIL import Image
import piexif
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ExifData:
    """Structured EXIF data container."""

    def __init__(
        self,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        altitude: Optional[float] = None,
        date_taken: Optional[datetime] = None,
        camera_make: Optional[str] = None,
        camera_model: Optional[str] = None,
    ):
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.date_taken = date_taken
        self.camera_make = camera_make
        self.camera_model = camera_model

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage."""
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude_m": self.altitude,
            "date_taken": self.date_taken,
            "camera_make": self.camera_make,
            "camera_model": self.camera_model,
        }


def _convert_to_degrees(value: Tuple[Tuple[int, int], ...]) -> float:
    """
    Convert GPS coordinates from degrees/minutes/seconds to decimal degrees.

    Args:
        value: Tuple of ((degrees, 1), (minutes, 1), (seconds, 100)) format

    Returns:
        Decimal degrees as float
    """
    degrees = value[0][0] / value[0][1]
    minutes = value[1][0] / value[1][1]
    seconds = value[2][0] / value[2][1]

    return degrees + (minutes / 60.0) + (seconds / 3600.0)


def _get_gps_coordinates(gps_info: Dict) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Extract and convert GPS coordinates from EXIF GPS info.

    Args:
        gps_info: GPS EXIF data dictionary

    Returns:
        Tuple of (latitude, longitude, altitude) or (None, None, None) if not available
    """
    try:
        # Extract latitude
        latitude = None
        if piexif.GPSIFD.GPSLatitude in gps_info and piexif.GPSIFD.GPSLatitudeRef in gps_info:
            lat = _convert_to_degrees(gps_info[piexif.GPSIFD.GPSLatitude])
            lat_ref = gps_info[piexif.GPSIFD.GPSLatitudeRef].decode('utf-8')
            if lat_ref == 'S':
                lat = -lat
            latitude = lat

        # Extract longitude
        longitude = None
        if piexif.GPSIFD.GPSLongitude in gps_info and piexif.GPSIFD.GPSLongitudeRef in gps_info:
            lon = _convert_to_degrees(gps_info[piexif.GPSIFD.GPSLongitude])
            lon_ref = gps_info[piexif.GPSIFD.GPSLongitudeRef].decode('utf-8')
            if lon_ref == 'W':
                lon = -lon
            longitude = lon

        # Extract altitude
        altitude = None
        if piexif.GPSIFD.GPSAltitude in gps_info:
            altitude_value = gps_info[piexif.GPSIFD.GPSAltitude]
            altitude = altitude_value[0] / altitude_value[1]

            # Check altitude reference (0 = above sea level, 1 = below sea level)
            if piexif.GPSIFD.GPSAltitudeRef in gps_info:
                alt_ref = gps_info[piexif.GPSIFD.GPSAltitudeRef]
                if alt_ref == 1:
                    altitude = -altitude

        return latitude, longitude, altitude

    except Exception as e:
        logger.warning(f"Failed to extract GPS coordinates: {e}")
        return None, None, None


def _parse_exif_datetime(datetime_str: str) -> Optional[datetime]:
    """
    Parse EXIF datetime string to datetime object.

    EXIF format: "YYYY:MM:DD HH:MM:SS"

    Args:
        datetime_str: EXIF datetime string

    Returns:
        datetime object or None if parsing fails
    """
    try:
        # EXIF datetime format
        return datetime.strptime(datetime_str, "%Y:%m:%d %H:%M:%S")
    except Exception as e:
        logger.warning(f"Failed to parse EXIF datetime '{datetime_str}': {e}")
        return None


def extract_exif_data(image_path: str) -> ExifData:
    """
    Extract GPS coordinates and metadata from image EXIF data.

    This function safely extracts available EXIF data from an image file,
    handling missing data gracefully. It supports JPEG and other formats
    that store EXIF data.

    Args:
        image_path: Path to the image file

    Returns:
        ExifData object with extracted information. Fields will be None if not available.

    Example:
        >>> exif_data = extract_exif_data("/path/to/photo.jpg")
        >>> if exif_data.latitude and exif_data.longitude:
        ...     print(f"Location: {exif_data.latitude}, {exif_data.longitude}")
    """
    exif_data = ExifData()

    try:
        # Open image
        image = Image.open(image_path)

        # Get EXIF data
        exif_dict = piexif.load(image.info.get('exif', b''))

        # Extract GPS coordinates
        if piexif.GPSIFD in exif_dict and exif_dict[piexif.GPSIFD]:
            gps_info = exif_dict[piexif.GPSIFD]
            latitude, longitude, altitude = _get_gps_coordinates(gps_info)
            exif_data.latitude = latitude
            exif_data.longitude = longitude
            exif_data.altitude = altitude

        # Extract camera make and model
        if '0th' in exif_dict:
            zero_ifd = exif_dict['0th']

            if piexif.ImageIFD.Make in zero_ifd:
                make = zero_ifd[piexif.ImageIFD.Make]
                exif_data.camera_make = make.decode('utf-8') if isinstance(make, bytes) else str(make)

            if piexif.ImageIFD.Model in zero_ifd:
                model = zero_ifd[piexif.ImageIFD.Model]
                exif_data.camera_model = model.decode('utf-8') if isinstance(model, bytes) else str(model)

        # Extract date taken (try multiple EXIF fields)
        if 'Exif' in exif_dict:
            exif_ifd = exif_dict['Exif']

            # Try DateTimeOriginal first (most accurate)
            if piexif.ExifIFD.DateTimeOriginal in exif_ifd:
                datetime_str = exif_ifd[piexif.ExifIFD.DateTimeOriginal]
                datetime_str = datetime_str.decode('utf-8') if isinstance(datetime_str, bytes) else datetime_str
                exif_data.date_taken = _parse_exif_datetime(datetime_str)

            # Fall back to DateTimeDigitized
            elif piexif.ExifIFD.DateTimeDigitized in exif_ifd:
                datetime_str = exif_ifd[piexif.ExifIFD.DateTimeDigitized]
                datetime_str = datetime_str.decode('utf-8') if isinstance(datetime_str, bytes) else datetime_str
                exif_data.date_taken = _parse_exif_datetime(datetime_str)

        # Fall back to DateTime in 0th IFD
        if not exif_data.date_taken and '0th' in exif_dict:
            if piexif.ImageIFD.DateTime in exif_dict['0th']:
                datetime_str = exif_dict['0th'][piexif.ImageIFD.DateTime]
                datetime_str = datetime_str.decode('utf-8') if isinstance(datetime_str, bytes) else datetime_str
                exif_data.date_taken = _parse_exif_datetime(datetime_str)

    except Exception as e:
        logger.warning(f"Failed to extract EXIF data from {image_path}: {e}")

    return exif_data


def validate_image_file(file_path: str) -> bool:
    """
    Validate that a file is a valid image.

    Args:
        file_path: Path to the file to validate

    Returns:
        True if valid image, False otherwise
    """
    try:
        image = Image.open(file_path)
        image.verify()
        return True
    except Exception as e:
        logger.warning(f"Invalid image file {file_path}: {e}")
        return False


def get_image_dimensions(file_path: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Get image width and height.

    Args:
        file_path: Path to the image file

    Returns:
        Tuple of (width, height) or (None, None) if failed
    """
    try:
        image = Image.open(file_path)
        return image.size
    except Exception as e:
        logger.warning(f"Failed to get image dimensions for {file_path}: {e}")
        return None, None
