# Te Araroa Trail Tracker - Claude Context

## Project Overview

A web application to track and visualize hiking progress on the Te Araroa trail in New Zealand. The app syncs with Garmin Connect or Strava to display activities, allows GPX file uploads, and supports geotagged photo galleries with automatic activity linking.

**Live Status**: Pre-launch (hiking trip starts mid-January 2026)
**Purpose**: Enable family and friends to follow along with real-time progress on the trail

## Architecture

### Monorepo Structure
```
te-araroa-tracker/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── main.py          # FastAPI app with middleware (CORS, GZip, rate limiting)
│   │   ├── config.py        # Pydantic settings with .env support
│   │   ├── database.py      # SQLAlchemy setup with connection pooling
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routes/          # API endpoints (activities, photos, garmin, strava, admin)
│   │   ├── services/        # Business logic (garmin_sync, strava_sync)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── utils/           # Helper functions (EXIF extraction, GPS utils)
│   └── requirements.txt
└── frontend/         # Next.js 14 React frontend
    ├── app/
    │   ├── page.tsx         # Main tracker view (map + stats)
    │   └── admin/page.tsx   # Admin dashboard (uploads, sync)
    ├── components/          # React components
    ├── lib/
    │   └── api.ts          # API client (all backend calls)
    └── package.json
```

## Tech Stack

### Backend
- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL (production via Railway), SQLite (local dev)
- **ORM**: SQLAlchemy 2.0+
- **Key Libraries**:
  - `garminconnect` (0.2.12) - Unofficial Garmin API (has known issues)
  - `httpx` - Strava OAuth and API calls
  - `slowapi` - Rate limiting middleware
  - `gpxpy` - GPX file parsing
  - `Pillow` + `piexif` - EXIF extraction from photos
  - `polyline` - GPS track encoding

### Frontend
- **Framework**: Next.js 14.1.0 (App Router, React 18.2)
- **Styling**: Tailwind CSS 3.4.19
- **Maps**: Mapbox GL JS 3.0.0
- **Charts**: Recharts 2.15.4
- **Language**: TypeScript 5

### Deployment
- **Backend + Database**: Railway (free tier: 512MB RAM, 1GB PostgreSQL)
- **Frontend**: Vercel (free tier: 100GB bandwidth)
- **Photo Storage**: Railway volume mount at `/data/uploads/photos`
- **Maps**: Mapbox (free tier: 50k loads/month)

## Database Schema

### Activities Table
```python
# app/models/activity.py
- id (PK)
- name, source ("garmin", "strava", "gpx_upload")
- garmin_activity_id (unique, nullable)
- strava_activity_id (unique, nullable)
- date, start_time, end_time
- distance_km, elevation_gain_m, elevation_loss_m
- min_elevation_m, max_elevation_m
- duration_seconds, avg_heart_rate, max_heart_rate, calories
- route_polyline (encoded polyline for map display)
- raw_gps_data (JSON - full GPS trackpoints)
- synced_at, created_at
```

### Photos Table
```python
# app/models/photo.py
- id (PK)
- filename, file_path
- caption
- latitude, longitude, altitude_m (from EXIF GPS)
- date_taken (from EXIF)
- camera_make, camera_model (from EXIF)
- activity_id (nullable - auto-linked based on GPS proximity)
- created_at, updated_at
```

### Strava Tokens Table
```python
# app/models/strava_token.py
- id (PK)
- access_token, refresh_token
- expires_at
- athlete_id
- created_at, updated_at
```

## Environment Variables

### Backend (.env)
```bash
# Database (auto-set by Railway when PostgreSQL added)
DATABASE_URL=postgresql://...  # Don't set locally - uses SQLite

# Required for admin features
ADMIN_PASSWORD=your_password

# Optional: Garmin sync (unofficial API - known to be unreliable)
GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=your_password

# Optional: Strava sync (recommended - official API)
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_WEBHOOK_VERIFY_TOKEN=...  # For real-time webhooks

# Optional: Cloudinary (not currently used)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Production: CORS configuration
FRONTEND_URL=https://your-app.vercel.app

# Production: Photo storage
RAILWAY_VOLUME_MOUNT_PATH=/data  # Set when Railway volume configured
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # or Railway URL
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...  # Optional
```

## Common Development Patterns

### Backend

#### 1. Database Sessions
Always use dependency injection:
```python
from app.database import get_db
from sqlalchemy.orm import Session

@router.get("/endpoint")
def my_route(db: Session = Depends(get_db)):
    # db session auto-closed after request
```

#### 2. Rate Limiting
Use SlowAPI for free-tier protection:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/sync")
@limiter.limit("10/hour")  # Prevent abuse
async def sync_activities(request: Request, ...):  # request MUST be first param
    ...
```

**Critical**: Rate limiter requires `Request` as first parameter in function signature.

#### 3. Response Models
Always use Pydantic schemas for type safety:
```python
from pydantic import BaseModel

class ActivityResponse(BaseModel):
    id: int
    name: str
    # ...
    class Config:
        from_attributes = True  # For SQLAlchemy models
```

#### 4. File Uploads
Photo upload pattern (with Railway volume support):
```python
import os
from pathlib import Path

# Use Railway volume if available, otherwise fall back to /app (ephemeral)
UPLOAD_BASE = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "/app")
UPLOAD_DIR = Path(UPLOAD_BASE) / "uploads" / "photos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
```

### Frontend

#### 1. API Calls
All backend calls go through `lib/api.ts`:
```typescript
import { api } from '@/lib/api'

const data = await api.getActivities()
```

#### 2. Component Structure
- Use 'use client' directive for interactive components
- Keep components in `/components` directory
- Pages in `/app` directory (App Router)

#### 3. Map Integration
Mapbox token from environment:
```typescript
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
```

## Key Files and Their Purposes

### Backend Critical Files
- **`backend/app/main.py`** - FastAPI app entry, middleware setup, router registration
- **`backend/app/database.py`** - Database connection with dual SQLite/PostgreSQL support
- **`backend/app/routes/photos.py`** - Photo upload with EXIF extraction (510+ lines)
- **`backend/app/utils/exif_extractor.py`** - EXIF GPS extraction (244 lines)
- **`backend/app/utils/gps_utils.py`** - Photo-to-activity GPS proximity matching (157 lines)
- **`backend/app/routes/strava.py`** - Strava OAuth and sync (recommended over Garmin)
- **`backend/app/routes/admin.py`** - Database initialization and auth

### Frontend Critical Files
- **`frontend/app/page.tsx`** - Main public tracker view
- **`frontend/app/admin/page.tsx`** - Admin dashboard (454 lines)
- **`frontend/lib/api.ts`** - Single source of truth for API calls
- **`frontend/components/Map/MapView.tsx`** - Mapbox map with routes and photo markers
- **`frontend/components/PhotoUpload.tsx`** - Multi-file photo upload (288 lines)

### Documentation Files
- **`README.md`** - Overview and features
- **`SETUP.md`** - Local development setup
- **`DEPLOYMENT.md`** - Railway + Vercel deployment
- **`PROJECT_PLAN.md`** - Comprehensive architecture and roadmap
- **`STRAVA_SETUP.md`** - Strava OAuth setup guide
- **`GARMIN_ISSUE_SUMMARY.md`** - Known Garmin API issues

## Known Issues & Gotchas

### 1. Garmin Connect API Issues ⚠️
**Problem**: Unofficial `garminconnect` library is unreliable. Activities may not sync even with correct authentication.

**Solution**: Use Strava integration instead (official API, more reliable). GPX manual upload always works as fallback.

**Reference**: See `GARMIN_ISSUE_SUMMARY.md`

### 2. Photo Storage - Railway Volumes
**Important**: Photos stored at `RAILWAY_VOLUME_MOUNT_PATH` if set, otherwise `/app` (ephemeral - files disappear on redeploy!)

**Setup**: Ensure Railway volume is mounted before photo uploads work in production.

**Code**: `backend/app/routes/photos.py:31`

### 3. Database Auto-Creation
**SQLite**: Auto-created on first run (`test.db` in backend/)
**PostgreSQL**: Must run `/api/admin/init-db` to create tables

**Fix**: Models auto-create tables via SQLAlchemy in `main.py`:
```python
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
```

### 4. CORS Configuration
**Development**: `localhost:3000` and `localhost:3001` allowed
**Production**: Must set `FRONTEND_URL` environment variable

**Location**: `backend/app/main.py:25-40`

### 5. Rate Limiting Requires Request Parameter
**Important**: Rate limiter requires `Request` object as first parameter:
```python
@limiter.limit("10/hour")
async def endpoint(request: Request, ...):  # request MUST be first
```

**Recent Fix**: Photo file serving endpoint was missing this parameter, causing backend crash.

### 6. EXIF GPS Extraction May Fail
**Reasons**:
- Photo edited/cropped (removes EXIF)
- Location services disabled when photo taken
- Photo shared via messaging app (strips EXIF)
- Screenshot instead of camera photo

**Debugging**: Check Railway logs for warnings:
```
WARNING: No GPS data in photo: example.jpg
```

**Solution**: Upload fresh photos directly from phone camera with location enabled.

## Free Tier Optimizations

The entire app is optimized to stay within free tiers:

### Backend (Railway)
- **Connection Pooling**: 5 persistent connections max (60 available)
- **Pool Recycling**: Connections recycled every 1 hour
- **Pre-ping**: Validates connections before use (prevents stale connections)
- **GZip Compression**: 70%+ bandwidth savings on JSON responses

### Frontend (Vercel)
- **HTTP Caching**: 2-10 min cache per endpoint
- **Reduced Polling**: 5-minute intervals for stat updates
- **Cache Busting**: Only on data mutations

### Rate Limits
- **Garmin Sync**: Unlimited but unreliable
- **Strava Sync**: 10/hour manual sync (200/15min, 2000/day API limit)
- **Admin Login**: 3 attempts per 15 minutes
- **Photo Upload**: 20 uploads per hour
- **Photo File Serving**: 120 requests per minute

**Code References**:
- Database pooling: `backend/app/database.py:19-29`
- Rate limiting: `backend/app/main.py:12-17`
- GZip: `backend/app/main.py:21`

## Development Workflow

### Starting Development
```bash
# Terminal 1 - Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with backend URL and Mapbox token
npm run dev
```

**Access**:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Testing Workflow
No formal test suite yet. Manual testing via:
- FastAPI auto-generated docs: `/docs`
- Frontend UI interactions
- Test data endpoint: `POST /api/test/create-sample-activities`

## Deployment Workflow

### Railway (Backend)
1. Connect GitHub repo
2. Auto-detects Python (uses `requirements.txt`)
3. Add PostgreSQL service (auto-sets `DATABASE_URL`)
4. Add Volume for photo storage (mount to `/data`)
5. Set environment variables (`ADMIN_PASSWORD`, `FRONTEND_URL`, `RAILWAY_VOLUME_MOUNT_PATH=/data`)
6. Auto-deploys on git push to main
7. Run `/api/admin/init-db` to create tables

### Vercel (Frontend)
1. Import GitHub repo
2. Set root directory: `frontend/`
3. Auto-detects Next.js
4. Set environment variables (`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`)
5. Auto-deploys on git push to main

**Important**: Update backend `FRONTEND_URL` env var with Vercel URL for CORS

## Recent Major Features

### Photo Gallery with Geotagging (January 2026)
**PR**: #22
**Features**:
- EXIF GPS extraction from uploaded photos
- Automatic activity linking based on GPS proximity (nearest within 5km)
- Photo markers on map with preview popups
- Railway volume support for persistent storage
- Rate limiting on photo endpoints
- Enhanced logging for debugging EXIF extraction

**Key Implementation Details**:
- Uses haversine formula for accurate GPS distance calculations
- Searches all GPS track points for closest match to photo location
- 5km threshold appropriate for hiking pace (~2-3 hours)
- Handles both 'lon' and 'lng' formats for backwards compatibility
- Safe: doesn't fail upload if GPS extraction or linking fails

**Files**:
- Backend: `backend/app/routes/photos.py` (510 lines)
- EXIF: `backend/app/utils/exif_extractor.py` (244 lines)
- GPS utils: `backend/app/utils/gps_utils.py` (157 lines)
- Frontend: `frontend/components/PhotoUpload.tsx` (288 lines)
- Map integration: `frontend/components/Map/MapView.tsx`

### Strava Integration
**Features**:
- OAuth2 authentication flow
- Activity sync with GPS streams
- Webhook support for real-time updates
- Rate limiting (10 syncs/hour)

**Files**:
- Service: `backend/app/services/strava_sync.py`
- Routes: `backend/app/routes/strava.py`
- Model: `backend/app/models/strava_token.py`

## Project-Specific Conventions

### Code Style
- **Python**: Follow FastAPI patterns (dependency injection, type hints)
- **TypeScript**: Strict mode, explicit types preferred
- **Component Naming**: PascalCase for components, camelCase for functions

### Git Commit Messages
Recent patterns from git log:
- "Add [feature]" for new features
- "Fix: [description]" for bug fixes
- "Merge pull request #X" for PR merges
- Descriptive and concise

### File Organization
- Backend routes in `/app/routes/`
- Backend services (business logic) in `/app/services/`
- Utilities in `/app/utils/`
- Frontend components in `/components/`
- API client centralized in `/lib/api.ts`

## Common Tasks

### Add a New API Endpoint
1. Create route function in appropriate router (e.g., `app/routes/photos.py`)
2. Add rate limiting decorator with `request: Request` as first param
3. Add Pydantic schema if needed
4. Update frontend API client (`lib/api.ts`)
5. Test via FastAPI `/docs`

### Add a New Database Model
1. Create model in `app/models/`
2. Import in `app/models/__init__.py`
3. Import in `app/routes/admin.py` (ensures table creation)
4. Restart backend (SQLAlchemy auto-creates table)
5. Run `/api/admin/init-db` in production

### Add a New Frontend Component
1. Create in `/components/`
2. Use TypeScript + Tailwind CSS
3. Import and use in page/component
4. Add 'use client' if interactive

## External API Dependencies

### Mapbox
- **Purpose**: Interactive map tiles
- **Free Tier**: 50,000 loads/month
- **Token**: `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Docs**: https://docs.mapbox.com/mapbox-gl-js/

### Garmin Connect (Unofficial)
- **Purpose**: Activity sync
- **Reliability**: Poor (see GARMIN_ISSUE_SUMMARY.md)
- **Library**: `garminconnect` 0.2.12
- **Status**: Use Strava instead

### Strava API (Official)
- **Purpose**: Activity sync (recommended)
- **Free Tier**: 200 requests/15min, 2000/day
- **OAuth**: Client credentials required
- **Docs**: https://developers.strava.com/

## Troubleshooting

### "Module not found" errors (Backend)
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
- Verify backend is running on port 8000
- Check CORS settings in `backend/app/main.py`

### Database connection failed
- Local: Ensure backend directory is writable (SQLite)
- Production: Verify `DATABASE_URL` is set by Railway
- Production: Run `/api/admin/init-db` to create tables

### Photos not persisting (Railway)
- Ensure Railway volume is mounted
- Check `RAILWAY_VOLUME_MOUNT_PATH` environment variable is set to `/data`
- Verify volume is mounted in Railway dashboard

### Garmin sync returns 0 activities
- Expected - Garmin API is unreliable
- Use Strava or GPX upload instead
- See GARMIN_ISSUE_SUMMARY.md for details

### Backend crashes on startup with rate limiter error
- Check that all rate-limited endpoints have `request: Request` as first parameter
- Example: `async def endpoint(request: Request, other_params...)`

### Photos upload but have no GPS coordinates
- Check photo has location data (not all photos do)
- View Railway logs for: "No GPS data in photo: [filename]"
- Try uploading fresh photo from phone camera with location enabled
- Edited/cropped photos often lose EXIF data

## Useful Commands

### Backend
```bash
# Run server
uvicorn app.main:app --reload

# Run on different port
uvicorn app.main:app --reload --port 8001

# Check Python version
python --version  # Need 3.10+

# Install single package
pip install package-name
```

### Frontend
```bash
# Run dev server
npm run dev

# Run on different port
npm run dev -- -p 3001

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

### Database
```bash
# Local SQLite location
backend/test.db

# Reset local database
rm backend/test.db
# Restart backend to recreate

# Production - Initialize tables
# Visit: https://[your-backend]/api/admin/init-db

# Production - Check database status
# Visit: https://[your-backend]/api/admin/db-status
```

## Additional Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Next.js Docs**: https://nextjs.org/docs
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **Railway Docs**: https://docs.railway.app/
- **Vercel Docs**: https://vercel.com/docs
- **Mapbox GL JS**: https://docs.mapbox.com/mapbox-gl-js/
- **Strava API**: https://developers.strava.com/
