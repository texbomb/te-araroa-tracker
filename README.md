# Te Araroa Trail Tracker

A web application to track and visualize your journey on the Te Araroa trail in New Zealand. Automatically syncs with Garmin Connect to display progress, daily stats, and interactive maps for friends and family.

## ✨ Features

- **🗺️ Interactive Map** - Live tracking with clickable route history
- **📊 Trek History** - View all activities with elevation profiles
- **📈 Daily Stats** - Distance, elevation, heart rate, and more
- **🔐 Admin Dashboard** - Password-protected upload and management
- **📱 GPX Upload** - Manual activity uploads from any device
- **🎯 Garmin Sync** - Automatic sync with Garmin Connect (optional)

## 🏗️ Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, Mapbox GL JS
- **Backend:** Python FastAPI, SQLAlchemy
- **Database:** PostgreSQL (Railway)
- **Hosting:**
  - Frontend: Vercel
  - Backend + Database: Railway
- **Storage:** Cloudinary (for photos, optional)

## 🚀 Getting Started

See [SETUP.md](SETUP.md) for detailed setup instructions.

### Quick Start

1. **Setup accounts** (all have generous free tiers):
   - [Railway](https://railway.app) - Backend + Database
   - [Mapbox](https://mapbox.com) - Interactive maps
   - [Vercel](https://vercel.com) - Frontend hosting
   - [Cloudinary](https://cloudinary.com) - Photo storage (optional)

2. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your credentials
   uvicorn app.main:app --reload
   ```

3. **Frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your credentials
   npm run dev
   ```

4. Open `http://localhost:3000`

## 📁 Project Structure

```
te-araroa-tracker/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI app + middleware
│   │   ├── routes/      # API endpoints
│   │   ├── models/      # Database models
│   │   └── services/    # Business logic
│   └── requirements.txt
├── frontend/            # Next.js React frontend
│   ├── app/
│   │   ├── page.tsx    # Main tracker view
│   │   └── admin/      # Admin dashboard
│   ├── components/     # React components
│   └── lib/            # API client
├── SETUP.md            # Detailed setup guide
├── DEPLOYMENT.md       # Deployment instructions
└── README.md          # This file
```

## 🌐 Routes

- `/` - Public tracker (view-only for family/friends)
- `/admin` - Admin dashboard (password protected)
  - Upload GPX files
  - Manage activities (delete, edit)
  - View detailed stats

## 💻 Development

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

## 🔐 Authentication

Simple password authentication for admin features:
- Set `ADMIN_PASSWORD` in backend `.env`
- 24-hour sessions with localStorage
- Rate limited (3 attempts per 15 minutes)
- Lockout after failed attempts

## 📊 Free Tier Usage

Optimized to stay within free tier limits:
- **Mapbox:** ~1% usage (500/50K loads)
- **Vercel:** ~1% usage (1GB/100GB bandwidth)
- **Railway:** ~10% usage (DB + backend)
- **Cloudinary:** ~1% usage (photos)

Features:
- ✅ HTTP caching (2-10 min per endpoint)
- ✅ GZip compression (70% bandwidth savings)
- ✅ Rate limiting (prevents abuse)
- ✅ Connection pooling (efficient DB usage)
- ✅ Reduced polling (5 min intervals)

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step deployment to Railway and Vercel.

**Quick Deploy:**
1. Railway: Connect GitHub repo, auto-deploy backend + PostgreSQL
2. Vercel: Import project, auto-deploy frontend
3. Set environment variables in each platform
4. Done! 🎉

## 📝 Environment Variables

**Backend (.env):**
```bash
DATABASE_URL=postgresql://...         # Auto-set by Railway
ADMIN_PASSWORD=your_password         # Required
GARMIN_EMAIL=your@email.com          # Optional
GARMIN_PASSWORD=your_password        # Optional
CLOUDINARY_CLOUD_NAME=...            # Optional
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-api.railway.app
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...    # Optional
```

## 🛠️ Features

### Implemented ✅
- Interactive map with route highlighting
- Trek history with elevation profiles
- Daily trek tracker
- Admin authentication
- GPX file upload
- Activity deletion
- Free tier optimizations

### Coming Soon 🚧
- Activity editing
- Photo uploads with geotags
- Journal entries
- Bulk operations
- Export functionality

## 📖 Documentation

- [SETUP.md](SETUP.md) - Local development setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [PROJECT_PLAN.md](PROJECT_PLAN.md) - Architecture & features

## 📄 License

MIT

---

Built for tracking the Te Araroa journey, January 2026 🥾🇳🇿
