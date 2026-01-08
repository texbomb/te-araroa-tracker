#!/usr/bin/env python3
"""
Run garmin_diagnostic.py with credentials from backend/.env file
"""
import sys
import os

# Load environment variables from backend/.env
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / "backend" / ".env")

# Set environment variables so diagnostic script can find them
os.environ["GARMIN_EMAIL"] = os.getenv("GARMIN_EMAIL", "")
os.environ["GARMIN_PASSWORD"] = os.getenv("GARMIN_PASSWORD", "")

# Now run the diagnostic
exec(open(Path(__file__).parent / "garmin_diagnostic.py", encoding="utf-8").read())