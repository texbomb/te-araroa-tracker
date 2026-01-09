# Setup Guide - Te Araroa Tracker

Quick start guide to get your trail tracker up and running.

## Prerequisites

- Python 3.10+ installed
- Node.js 18+ installed
- Garmin Connect account with activity data
- Git installed

---

## Phase 1: Account Setup (Do this first!)

### 1. Mapbox (Maps)

1. Go to [mapbox.com](https://mapbox.com)
2. Sign up for free account
3. Go to **Access Tokens**
4. Copy your default public token (starts with `pk.`)
5. That's it!

### 2. Cloudinary (Photo Storage)

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for free account
3. Go to **Dashboard**
4. Copy these values:
   - Cloud Name
   - API Key
   - API Secret
5. Done!

### 3. Railway (Production Deployment) - Optional for now

You can set this up later when ready to deploy. For local development, the app will use SQLite automatically (no setup needed).

---

## Phase 2: Backend Setup

### 1. Install Python Dependencies

```bash
cd backend
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
# On Windows: notepad .env
# On Mac/Linux: nano .env
```

Fill in your `.env` file:

```bash
# Leave DATABASE_URL commented for local dev (uses SQLite)
# DATABASE_URL=postgresql://...  # Railway sets this automatically in production

GARMIN_EMAIL=your-garmin-email@example.com
GARMIN_PASSWORD=your-garmin-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_PASSWORD=choose-a-simple-password-for-admin-panel
```

### 3. Test Garmin Authentication

```bash
python test_garmin.py
```

You should see:
- ✅ Successfully authenticated
- Your Garmin profile name
- List of recent activities

If it fails, check your Garmin email/password.

### 4. Run Backend Server

```bash
# Make sure you're in the backend directory and venv is activated
uvicorn app.main:app --reload --port 8000
```

Open browser to `http://localhost:8000` - you should see:
```json
{"message": "Te Araroa Tracker API", "status": "running"}
```

Keep this terminal running!

---

## Phase 3: Frontend Setup

### 1. Install Node Dependencies

Open a **new terminal** (keep backend running in the other):

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Copy example file
cp .env.local.example .env.local

# Edit the file
# On Windows: notepad .env.local
# On Mac/Linux: nano .env.local
```

Fill in your `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
```

### 3. Run Frontend Server

```bash
npm run dev
```

Open browser to `http://localhost:3000` - you should see the Next.js app!

---

## Phase 4: Verify Everything Works

### Checklist:

- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] SQLite database created automatically (test.db in backend folder)
- [ ] Garmin test script passes
- [ ] No errors in terminal logs

---

## Quick Reference

### Start Development (after initial setup)

Terminal 1 - Backend:
```bash
cd backend
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
uvicorn app.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Troubleshooting

**"Module not found" errors in Python:**
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

**"Database connection failed":**
- For local dev, check that backend directory is writable (for SQLite)
- For production, verify DATABASE_URL is correctly set by Railway

**Garmin authentication fails:**
- Log into Garmin Connect website manually to check password
- Complete any security challenges on Garmin's website
- Try changing password to something without special characters

**Next.js port already in use:**
- Change port: `npm run dev -- -p 3001`

---

## Next Steps

Once everything is running:

1. ✅ Setup complete - Infrastructure is ready!
2. → Test GPX upload functionality
3. → Upload activities and view on map
4. → When ready, deploy to Railway + Vercel

Good luck! 🚀
