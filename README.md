# Te Araroa Trail Tracker

A web application to track and visualize your journey on the Te Araroa trail in New Zealand. Automatically syncs with Garmin Connect to display progress, daily stats, photos, and journal entries for friends and family.

## Features

- **Live Map Tracking** - See your progress on an interactive map
- **Automatic Garmin Sync** - Activities sync every 6 hours from your Garmin watch
- **Photo Gallery** - Upload geotagged photos from your phone
- **Trail Stats** - Track distance, elevation, and progress
- **Journal Entries** - Add text updates about your journey
- **Historical Charts** - Visualize your journey over time

## Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, Mapbox GL JS
- **Backend:** Python FastAPI, Garmin Connect API
- **Database:** Supabase (PostgreSQL)
- **Storage:** Cloudinary (photos)
- **Hosting:** Vercel (frontend), Fly.io (backend)

## Getting Started

See [SETUP.md](SETUP.md) for detailed setup instructions.

### Quick Start

1. **Setup accounts** (free tiers):
   - Supabase
   - Mapbox
   - Cloudinary
   - (Optional) Fly.io for deployment

2. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your credentials
   python test_garmin.py  # Test Garmin connection
   uvicorn app.main:app --reload
   ```

3. **Frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   npm run dev
   ```

4. Open `http://localhost:3000`

## Project Structure

```
nz-walk/
├── backend/          # Python FastAPI backend
├── frontend/         # Next.js React frontend
├── PROJECT_PLAN.md  # Detailed project plan
├── SETUP.md         # Setup instructions
└── README.md        # This file
```

## Development

- Backend runs on `http://localhost:8000`
- Frontend runs on `http://localhost:3000`
- API docs at `http://localhost:8000/docs`

## Deployment

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for deployment instructions to Vercel and Fly.io.

## License

MIT

---

Built for tracking the Te Araroa journey, January 2026 🥾🇳🇿
