# Te Araroa Trail Tracker - Project Plan

## Project Overview

A web application to track and visualize your one-month walk on the Te Araroa trail in New Zealand's South Island. The site will automatically sync with Garmin Connect to display your progress, daily stats, photos, and journal entries for friends and family to follow along.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (React, App Router)
- **Hosting:** Vercel (free tier)
- **Mapping:** Mapbox GL JS (50k free map loads/month)
- **Charts:** Recharts (historical data visualization)
- **Styling:** Tailwind CSS
- **PWA:** next-pwa for mobile app experience

### Backend
- **Framework:** Python FastAPI
- **Hosting:** Fly.io (free tier: 3 shared VMs, 256MB RAM)
- **Garmin Integration:** `garminconnect` Python library
- **Scheduled Tasks:** APScheduler (cron jobs for auto-sync)

### Database
- **Service:** Supabase PostgreSQL (free tier: 500MB)
- **ORM:** SQLAlchemy (Python side)
- **Client:** Supabase JS client (Next.js side)

### Storage
- **Photos:** Cloudinary (free tier: 25GB storage, 25GB bandwidth/month)

### External APIs
- **Garmin Connect:** Activity data sync (unofficial API via garminconnect library)
- **Mapbox:** Map tiles and geocoding

---

## Database Schema

### Table: `activities`
Stores daily hiking activities from Garmin.

```sql
CREATE TABLE activities (
  id SERIAL PRIMARY KEY,
  garmin_activity_id BIGINT UNIQUE NOT NULL,
  date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL(6, 2),
  elevation_gain_m INTEGER,
  duration_seconds INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  calories INTEGER,
  route_polyline TEXT,  -- Encoded polyline for map display
  raw_gps_data JSONB,   -- Full GPS trackpoints
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activities_date ON activities(date DESC);
```

### Table: `photos`
Stores photos uploaded from the trail.

```sql
CREATE TABLE photos (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  cloudinary_id VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  thumbnail_url TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  caption TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_activity ON photos(activity_id);
CREATE INDEX idx_photos_location ON photos(latitude, longitude) WHERE latitude IS NOT NULL;
```

### Table: `journal_entries`
Optional text updates for specific days.

```sql
CREATE TABLE journal_entries (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journal_date ON journal_entries(date DESC);
```

### Table: `planned_route`
The complete Te Araroa planned route for South Island.

```sql
CREATE TABLE planned_route (
  id SERIAL PRIMARY KEY,
  section_name VARCHAR(255),  -- e.g., "Bluff to Te Anau"
  section_order INTEGER,
  route_polyline TEXT NOT NULL,  -- Encoded polyline
  distance_km DECIMAL(6, 2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_planned_route_order ON planned_route(section_order);
```

### Table: `waypoints`
Notable waypoints along the trail (towns, huts, landmarks).

```sql
CREATE TABLE waypoints (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),  -- 'town', 'hut', 'landmark', 'resupply'
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_waypoints_location ON waypoints(latitude, longitude);
```

---

## Folder Structure

```
nz-walk/
├── frontend/                    # Next.js application
│   ├── public/
│   │   ├── icons/              # PWA icons
│   │   ├── manifest.json       # PWA manifest
│   │   └── te-araroa-route.geojson  # Planned route (static)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout
│   │   │   ├── page.tsx        # Main page with map
│   │   │   ├── stats/
│   │   │   │   └── page.tsx    # Historical stats/charts
│   │   │   ├── photos/
│   │   │   │   └── page.tsx    # Photo gallery
│   │   │   ├── api/            # API routes (if needed)
│   │   │   └── admin/
│   │   │       └── page.tsx    # Upload photos, manual sync, journal
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── MapView.tsx            # Main map component
│   │   │   │   ├── PlannedRoute.tsx       # Planned route layer
│   │   │   │   ├── CompletedRoute.tsx     # Completed route layer
│   │   │   │   ├── CurrentLocation.tsx    # Current position marker
│   │   │   │   └── PhotoMarkers.tsx       # Geotagged photo pins
│   │   │   ├── Stats/
│   │   │   │   ├── DailyStatsCard.tsx     # Today's stats
│   │   │   │   ├── SummaryStats.tsx       # Total distance, elevation, etc.
│   │   │   │   └── DaySelector.tsx        # Filter by day
│   │   │   ├── Charts/
│   │   │   │   ├── DistanceChart.tsx      # Distance over time
│   │   │   │   ├── ElevationChart.tsx     # Elevation profile
│   │   │   │   └── ProgressChart.tsx      # % of trail completed
│   │   │   ├── Photos/
│   │   │   │   ├── PhotoGallery.tsx
│   │   │   │   ├── PhotoUpload.tsx        # Upload interface
│   │   │   │   └── PhotoModal.tsx         # Full-size photo view
│   │   │   └── Journal/
│   │   │       └── JournalEntry.tsx       # Small journal display
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client
│   │   │   ├── mapbox.ts       # Mapbox utilities
│   │   │   └── api.ts          # API client for backend
│   │   ├── hooks/
│   │   │   ├── useActivities.ts
│   │   │   ├── usePhotos.ts
│   │   │   └── useStats.ts
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript types
│   │   └── utils/
│   │       ├── polyline.ts     # Polyline encoding/decoding
│   │       └── date.ts         # Date formatting
│   ├── .env.local              # Environment variables
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                     # Python FastAPI application
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── config.py           # Configuration management
│   │   ├── database.py         # Database connection
│   │   ├── models/
│   │   │   ├── activity.py     # SQLAlchemy models
│   │   │   ├── photo.py
│   │   │   ├── journal.py
│   │   │   └── waypoint.py
│   │   ├── routes/
│   │   │   ├── garmin.py       # Garmin sync endpoints
│   │   │   ├── activities.py   # Activity CRUD
│   │   │   ├── photos.py       # Photo upload/management
│   │   │   └── journal.py      # Journal entries
│   │   ├── services/
│   │   │   ├── garmin_sync.py  # Garmin Connect integration
│   │   │   ├── cloudinary.py   # Photo upload to Cloudinary
│   │   │   └── scheduler.py    # APScheduler for cron jobs
│   │   ├── utils/
│   │   │   ├── gps.py          # GPS processing (polyline encoding)
│   │   │   └── helpers.py
│   │   └── schemas/
│   │       ├── activity.py     # Pydantic schemas
│   │       ├── photo.py
│   │       └── journal.py
│   ├── migrations/             # Database migrations (Alembic)
│   │   └── versions/
│   ├── tests/
│   │   ├── test_garmin.py
│   │   └── test_activities.py
│   ├── .env                    # Environment variables
│   ├── requirements.txt
│   ├── fly.toml                # Fly.io deployment config
│   └── Dockerfile              # Container configuration
│
├── scripts/                     # Utility scripts
│   ├── seed_planned_route.py   # Import Te Araroa GPX data
│   ├── seed_waypoints.py       # Import waypoint data
│   └── test_garmin_auth.py     # Test Garmin authentication
│
├── docs/
│   └── SETUP.md                # Setup instructions
│
├── .gitignore
├── README.md
└── PROJECT_PLAN.md             # This file
```

---

## Key Features Breakdown

### 1. Interactive Map (Main Page)
**Components:**
- Full-screen Mapbox map centered on South Island
- **Planned route** (gray/dashed line) - Full Te Araroa trail
- **Completed route** (vibrant color, solid line) - Where you've walked
- **Current position** (animated marker) - Latest GPS point
- **Geotagged photos** (camera pins) - Click to preview photo
- **Waypoints** (markers for towns/huts)

**Data Flow:**
1. Frontend fetches `planned_route` from Supabase (static, loaded once)
2. Fetches `activities` with `route_polyline` (updates every 6 hours)
3. Draws completed route from concatenated polylines
4. Places marker at last GPS point
5. Renders photo markers from `photos` table

### 2. Daily Stats Panel
**Location:** Sidebar or bottom panel on main page

**Displays:**
- Current day's stats (distance, elevation, time, heart rate)
- Day selector dropdown (filter by date)
- Small summary: Total km, Days on trail, % complete

**Data Source:** `activities` table

### 3. Historical Stats Page (`/stats`)
**Charts (using Recharts):**
- **Distance per day** (bar chart)
- **Cumulative distance** (line chart)
- **Elevation gain per day** (bar chart)
- **Cumulative elevation** (area chart)
- **Progress tracker** (% of total trail completed)

**Summary Cards:**
- Total distance
- Total elevation gain
- Days walked
- Average km/day
- Longest day
- Highest elevation gain day

### 4. Photo Gallery (`/photos`)
**Features:**
- Grid layout of all photos
- Filter by day
- Click to open modal with full-size image + caption
- Show location on mini-map

**Data Source:** `photos` table + Cloudinary CDN

### 5. Admin Panel (`/admin`)
**Password protected** (simple, single password in env var)

**Features:**
- **Manual sync button** - Trigger Garmin sync immediately
- **Photo upload** - Upload from phone with optional geotag & caption
- **Journal entry** - Write/edit short text updates for specific days
- **Sync status** - Last sync time, number of activities synced

### 6. Journal (Small Feature)
**Display:**
- Optional collapsible section on main page
- Shows latest journal entry if available
- Link to see all entries

**Not prominent** - Just a nice-to-have for occasional text updates

---

## API Endpoints (Backend)

### Garmin Sync
- `POST /api/garmin/sync` - Manually trigger sync
- `GET /api/garmin/status` - Check last sync time, auth status

### Activities
- `GET /api/activities` - Get all activities (with optional date range)
- `GET /api/activities/{id}` - Get single activity with full GPS data
- `GET /api/activities/stats` - Get summary stats (total distance, etc.)

### Photos
- `POST /api/photos/upload` - Upload photo to Cloudinary + save metadata
- `GET /api/photos` - Get all photos (with optional activity filter)
- `DELETE /api/photos/{id}` - Delete photo

### Journal
- `POST /api/journal` - Create/update journal entry
- `GET /api/journal` - Get all journal entries
- `GET /api/journal/{date}` - Get entry for specific date

### Waypoints (Read-only)
- `GET /api/waypoints` - Get all waypoints for map

---

## Deployment Strategy

### 1. Supabase Setup
**Steps:**
1. Create free Supabase project
2. Run SQL schema from database section
3. Copy connection string to both frontend & backend `.env`
4. Set up Row Level Security (RLS) policies:
   - Public read access to all tables
   - No public write access (backend only)

**Environment Variables:**
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx  # Backend only
```

### 2. Backend (Fly.io)
**Steps:**
1. Install Fly CLI: `brew install flyctl` (Mac) or download
2. Login: `flyctl auth login`
3. Initialize app: `flyctl launch` (in `backend/` directory)
4. Set secrets:
   ```bash
   flyctl secrets set GARMIN_EMAIL=your@email.com
   flyctl secrets set GARMIN_PASSWORD=yourpassword
   flyctl secrets set SUPABASE_URL=xxx
   flyctl secrets set SUPABASE_SERVICE_KEY=xxx
   flyctl secrets set CLOUDINARY_URL=xxx
   flyctl secrets set ADMIN_PASSWORD=xxx
   ```
5. Deploy: `flyctl deploy`

**Scheduled Sync:**
- APScheduler runs inside the app
- Cron job: Every 6 hours, call `garmin_sync.sync_activities()`
- Logs to stdout (visible in `flyctl logs`)

**Cost:** Free tier (3 shared-cpu-1x VMs, 256MB each)

### 3. Cloudinary Setup
**Steps:**
1. Sign up at cloudinary.com (free)
2. Create upload preset (unsigned for client-side, signed for server)
3. Copy API credentials to backend `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=xxx
   CLOUDINARY_API_KEY=xxx
   CLOUDINARY_API_SECRET=xxx
   ```

### 4. Frontend (Vercel)
**Steps:**
1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `frontend/`
4. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=xxx
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
   NEXT_PUBLIC_MAPBOX_TOKEN=xxx
   NEXT_PUBLIC_BACKEND_URL=https://your-app.fly.dev
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=xxx
   ```
5. Deploy (automatic on git push)

**PWA Setup:**
- Add `next-pwa` to `next.config.js`
- Create `manifest.json` in `public/`
- Add icons to `public/icons/`
- Now installable on your phone's home screen

**Cost:** Free tier (100GB bandwidth, unlimited sites)

### 5. Mapbox Setup
**Steps:**
1. Sign up at mapbox.com (free)
2. Create access token
3. Add to frontend `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
   ```

**Free tier:** 50,000 map loads/month (plenty for family site)

---

## Development Roadmap

### Phase 1: Setup & Infrastructure (Days 1-3)
**Backend:**
- [ ] Initialize FastAPI project structure
- [ ] Set up Supabase database & run schema
- [ ] Configure database connection (SQLAlchemy)
- [ ] Test Garmin authentication with `garminconnect` library
- [ ] Deploy skeleton backend to Fly.io

**Frontend:**
- [ ] Initialize Next.js project with TypeScript & Tailwind
- [ ] Set up Supabase client
- [ ] Configure Mapbox GL JS
- [ ] Basic map rendering with South Island view

### Phase 2: Garmin Integration (Days 4-6)
**Backend:**
- [ ] Implement `garmin_sync.py` service
  - [ ] Authenticate with Garmin Connect
  - [ ] Fetch activities from date range
  - [ ] Parse GPS data & calculate stats
  - [ ] Encode polylines for efficient storage
  - [ ] Save to `activities` table
- [ ] Create `/api/garmin/sync` endpoint
- [ ] Set up APScheduler for 6-hourly auto-sync
- [ ] Test with real Garmin data

**Frontend:**
- [ ] Create API client to fetch activities
- [ ] Display completed route on map
- [ ] Add current location marker

### Phase 3: Map & Route Visualization (Days 7-9)
**Data Prep:**
- [ ] Obtain Te Araroa South Island GPX file
- [ ] Run `seed_planned_route.py` to import to database
- [ ] (Optional) Seed waypoints for major towns/huts

**Frontend:**
- [ ] Display planned route (gray/dashed)
- [ ] Display completed route (colored/solid)
- [ ] Differentiate visually
- [ ] Add basic waypoint markers
- [ ] Implement map controls (zoom, pan)
- [ ] Mobile responsive map

### Phase 4: Stats & Dashboard (Days 10-12)
**Frontend:**
- [ ] Create `DailyStatsCard` component
  - [ ] Show current day's distance, elevation, time
  - [ ] Heart rate, calories
- [ ] Create `SummaryStats` component
  - [ ] Total km, elevation, days walked
  - [ ] % of trail completed
- [ ] Add day selector dropdown
- [ ] Build `/stats` page with Recharts
  - [ ] Distance per day chart
  - [ ] Cumulative distance chart
  - [ ] Elevation charts
  - [ ] Summary cards

**Backend:**
- [ ] Create `/api/activities/stats` endpoint
- [ ] Calculate aggregates efficiently

### Phase 5: Photo Upload & Display (Days 13-15)
**Backend:**
- [ ] Integrate Cloudinary SDK
- [ ] Create `/api/photos/upload` endpoint
  - [ ] Accept multipart form data
  - [ ] Upload to Cloudinary
  - [ ] Extract EXIF GPS data if available
  - [ ] Save metadata to `photos` table
- [ ] Create `/api/photos` GET endpoint

**Frontend:**
- [ ] Create `PhotoUpload` component (for `/admin`)
  - [ ] File picker
  - [ ] Optional caption input
  - [ ] Optional manual geotag (click map)
  - [ ] Upload progress indicator
- [ ] Create `PhotoMarkers` map layer
  - [ ] Camera icons on geotagged photos
  - [ ] Click to preview
- [ ] Build `/photos` gallery page
  - [ ] Grid layout
  - [ ] Modal for full-size view
  - [ ] Filter by day

### Phase 6: Admin Panel & Journal (Days 16-17)
**Frontend:**
- [ ] Create `/admin` page
  - [ ] Simple password protection (client-side check, env var)
  - [ ] Manual sync button
  - [ ] Photo upload interface
  - [ ] Journal entry form
  - [ ] Last sync status display

**Backend:**
- [ ] Create `/api/journal` endpoints (CRUD)
- [ ] Simple auth middleware for admin routes (check password header)

**Frontend (Journal):**
- [ ] Display latest journal entry on main page (collapsible)
- [ ] Link to full journal view

### Phase 7: PWA & Mobile Optimization (Days 18-19)
**Frontend:**
- [ ] Install `next-pwa`
- [ ] Create `manifest.json`
- [ ] Add PWA icons (various sizes)
- [ ] Test "Add to Home Screen" on phone
- [ ] Optimize touch interactions
- [ ] Test photo upload from phone
- [ ] Ensure map is touch-friendly

### Phase 8: Polish & Testing (Days 20-21)
- [ ] End-to-end testing
  - [ ] Upload test activity to Garmin
  - [ ] Verify auto-sync works
  - [ ] Test manual sync button
  - [ ] Upload photos from phone
  - [ ] Check map rendering on mobile
- [ ] Performance optimization
  - [ ] Lazy load map components
  - [ ] Optimize image sizes (Cloudinary transformations)
  - [ ] Add loading states
- [ ] Error handling
  - [ ] Garmin auth failures
  - [ ] Network errors
  - [ ] User-friendly error messages
- [ ] Add basic analytics (optional - Vercel Analytics is free)

### Phase 9: Pre-Launch (Days 22-24)
- [ ] Populate planned route data
- [ ] Add waypoints for your planned stops
- [ ] Test deployment pipeline
- [ ] Write README with:
  - [ ] Setup instructions
  - [ ] How to use admin panel from phone
  - [ ] Troubleshooting guide
- [ ] Share URL with family for testing
- [ ] Fix any issues found

### Phase 10: Launch & Monitor (Day 25+)
- [ ] Launch! Start your walk
- [ ] Monitor auto-sync (check logs: `flyctl logs`)
- [ ] Upload first photos
- [ ] Write first journal entry
- [ ] Share site URL with friends/family
- [ ] Monitor Fly.io/Vercel dashboards for errors

---

## Data Sources & Preparation

### Te Araroa Planned Route
**Source:**
- Official Te Araroa Trust GPX files: https://www.teararoa.org.nz/before-you-go/maps/
- Or OpenStreetMap extracts
- Or Gaia GPS / AllTrails exports

**Format:** GPX file with trackpoints

**Import Script:** `scripts/seed_planned_route.py`
```python
# Parse GPX file
# Break into sections (optional)
# Encode as polyline
# Insert into `planned_route` table
```

### Waypoints (Towns, Huts)
**Source:**
- Te Araroa Trust website
- DOC (Department of Conservation) hut database
- Manual entry

**Import Script:** `scripts/seed_waypoints.py`
```python
# CSV or JSON with name, lat, lng, type
# Insert into `waypoints` table
```

---

## Environment Variables Reference

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
NEXT_PUBLIC_BACKEND_URL=https://your-app.fly.dev
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
ADMIN_PASSWORD=your-simple-password  # For /admin access
```

### Backend (`.env` / Fly.io Secrets)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=your-garmin-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_PASSWORD=your-simple-password  # Match frontend
DATABASE_URL=postgresql://...  # Auto-set by Fly.io if using Postgres addon
```

---

## Risk Mitigation & Fallbacks

### Risk 1: Garmin Unofficial API Breaks
**Mitigation:**
- Manual GPX upload interface as fallback
- Store raw Garmin data in case we need to switch providers
- Monitor `garminconnect` library GitHub for updates

### Risk 2: Sporadic Internet Access
**Solution:**
- Garmin watch syncs to phone offline (Bluetooth)
- Phone uploads to Garmin Connect when it gets wifi
- Auto-sync picks up activities whenever they appear
- **You don't need to do anything manually**

### Risk 3: Free Tier Limits Exceeded
**Monitoring:**
- Vercel dashboard shows bandwidth usage
- Fly.io dashboard shows resource usage
- Cloudinary shows storage/bandwidth
- Set up email alerts (available in all platforms)

**Unlikely:** For 30 days with modest family traffic, well within limits

### Risk 4: Map Not Loading on Mobile
**Testing:**
- Test on actual phone before trip
- Ensure Mapbox token is valid
- Check CORS settings
- Verify PWA manifest is correct

---

## Success Metrics

### Technical Success
- [ ] Auto-sync runs every 6 hours without errors
- [ ] Map loads in <3 seconds on mobile
- [ ] Photos upload successfully from phone
- [ ] No downtime during the month
- [ ] Stay within free tiers

### User Success
- [ ] Family can see your progress within 6 hours of hiking
- [ ] Photos display with correct locations
- [ ] Site is easy to navigate on phone
- [ ] Historical charts tell the story of your journey

---

## Post-Trip Considerations

After the walk, you can:
- **Archive the site** - Keep it running as a memento (free tiers last forever)
- **Export data** - Download all photos, GPX tracks, stats
- **Enhance** - Add more journal entries, curate photo galleries
- **Share** - Send the URL to friends as a trip report

The site remains a permanent record of your adventure with zero ongoing cost.

---

## Next Steps

1. **Review this plan** - Any questions or changes?
2. **Set up accounts** - Supabase, Fly.io, Cloudinary, Mapbox
3. **Start Phase 1** - Initialize project structure
4. **Test Garmin auth** - Verify you can connect before building everything

Let me know when you're ready to start building!
