# Setup Guide - Te Araroa Tracker

Quick start guide to get your trail tracker up and running.

## Prerequisites

- Python 3.10+ installed
- Node.js 18+ installed
- Garmin Connect account with activity data
- Git installed

---

## Phase 1: Account Setup (Do this first!)

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com)
2. Sign up for free account
3. Click "New Project"
   - Name: `te-araroa-tracker`
   - Database password: Choose a strong password
   - Region: Choose closest to New Zealand
4. Wait for project to provision (~2 minutes)
5. Go to **SQL Editor** in left sidebar
6. Click "New Query"
7. Copy and paste entire contents of `backend/schema.sql`
8. Click "Run" to create all tables
9. Go to **Project Settings** → **API**
10. Copy these values (you'll need them):
    - Project URL (looks like `https://xxx.supabase.co`)
    - `anon` key (for frontend)
    - `service_role` key (for backend - keep this secret!)

### 2. Mapbox (Maps)

1. Go to [mapbox.com](https://mapbox.com)
2. Sign up for free account
3. Go to **Access Tokens**
4. Copy your default public token (starts with `pk.`)
5. That's it!

### 3. Cloudinary (Photo Storage)

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for free account
3. Go to **Dashboard**
4. Copy these values:
   - Cloud Name
   - API Key
   - API Secret
5. Done!

### 4. Fly.io (Backend Hosting) - Optional for now

You can set this up later when ready to deploy. For local development, skip this.

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
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
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

### 2. Install Additional Dependencies

```bash
npm install @supabase/supabase-js mapbox-gl
npm install -D @types/mapbox-gl
```

### 3. Configure Environment Variables

```bash
# Copy example file
cp .env.local.example .env.local

# Edit the file
# On Windows: notepad .env.local
# On Mac/Linux: nano .env.local
```

Fill in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
ADMIN_PASSWORD=same-password-as-backend
```

### 4. Run Frontend Server

```bash
npm run dev
```

Open browser to `http://localhost:3000` - you should see the Next.js app!

---

## Phase 4: Verify Everything Works

### Checklist:

- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] Supabase database has all 5 tables (check SQL Editor)
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

**"Cannot connect to Supabase":**
- Check your `SUPABASE_URL` doesn't have trailing slash
- Verify you're using the correct keys (anon for frontend, service_role for backend)

**Garmin authentication fails:**
- Log into Garmin Connect website manually to check password
- Complete any security challenges on Garmin's website
- Try changing password to something without special characters

**Next.js port already in use:**
- Change port: `npm run dev -- -p 3001`

---

## Next Steps

Once everything is running:

1. ✅ Phase 1 complete - Infrastructure is ready!
2. → Move to Phase 2 - Build Garmin sync functionality
3. → Test with real activity data
4. → Add map visualization
5. → Deploy to production

Good luck with the build! 🚀
