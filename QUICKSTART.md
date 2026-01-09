# Quick Start - Get Running in 15 Minutes

Fast track guide to get the Te Araroa Tracker running locally.

## Step 1: Create Free Accounts (3 mins)

Do these in parallel in different browser tabs:

1. **Mapbox** → [mapbox.com](https://mapbox.com)
   - Sign up → Copy default access token

2. **Cloudinary** → [cloudinary.com](https://cloudinary.com)
   - Sign up → Dashboard
   - Save: Cloud Name, API Key, API Secret

## Step 2: Setup Database (2 mins)

For local development, the app will use SQLite automatically (no setup needed).

For production:
1. Sign up at [railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy the DATABASE_URL from Railway dashboard

## Step 3: Backend Setup (3 mins)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate     # Windows
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
notepad .env  # Windows
nano .env     # Mac/Linux
```

Fill in `.env`:
```bash
# Leave DATABASE_URL commented for local dev (uses SQLite)
# DATABASE_URL=postgresql://...  # Only needed for production

GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=yourpassword
CLOUDINARY_CLOUD_NAME=yourcloudname
CLOUDINARY_API_KEY=123456
CLOUDINARY_API_SECRET=abcdef
ADMIN_PASSWORD=hiking2026
```

Test Garmin:
```bash
python test_garmin.py
```

Should see ✅ Success!

Start backend:
```bash
uvicorn app.main:app --reload
```

Keep this terminal open!

## Step 4: Frontend Setup (3 mins)

Open **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
notepad .env.local  # Windows
nano .env.local     # Mac/Linux
```

Fill in `.env.local`:
```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.yourtoken
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=yourcloudname
```

Start frontend:
```bash
npm run dev
```

## Step 5: Open Browser (1 min)

Go to **http://localhost:3000**

You should see:
- Te Araroa Trail Tracker header
- Map of New Zealand's South Island
- Stats sidebar (showing zeros)

## Step 6: Verify (1 min)

- [ ] Backend: http://localhost:8000 shows `{"message": "Te Araroa Tracker API"}`
- [ ] Frontend: http://localhost:3000 shows the map
- [ ] Garmin test passed
- [ ] No errors in terminals

## Done! 🎉

Now you're ready to:
1. Build Garmin sync (Phase 2)
2. Add route visualization (Phase 3)
3. Implement stats (Phase 4)
4. Add photo uploads (Phase 5)

---

## Troubleshooting

**Garmin auth fails?**
- Log into garminconnect.com manually
- Complete any security challenges
- Try again

**Map doesn't show?**
- Check Mapbox token in `.env.local`
- Refresh browser
- Check browser console for errors

**Module not found?**
- Backend: Is venv activated? Run `pip install -r requirements.txt` again
- Frontend: Run `npm install` again

**Port already in use?**
- Backend: Change to port 8001: `uvicorn app.main:app --reload --port 8001`
- Frontend: `npm run dev -- -p 3001`

---

Need help? Check [SETUP.md](SETUP.md) for detailed instructions.
