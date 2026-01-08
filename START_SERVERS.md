# Start Both Servers - Te Araroa Tracker

Follow these steps to start both the backend and frontend servers.

## Step 1: Start Backend

Open a terminal and run:

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Keep this terminal open!

## Step 2: Start Frontend

Open a **NEW** terminal and run:

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
✓ Ready in X.Xs
```

## Step 3: Open Browser

Go to: **http://localhost:3000**

You should see:
- Green header: "Te Araroa Trail Tracker"
- Interactive map of New Zealand
- Stats sidebar on the right

## Troubleshooting

**If port 3000 is in use:**
```bash
# Find and kill the process
netstat -ano | findstr :3000
taskkill //F //PID <PID_NUMBER>
```

**If styles don't load:**
1. Hard refresh: Ctrl + Shift + R
2. Clear .next cache:
```bash
cd frontend
rm -rf .next
npm run dev
```

**If map doesn't show:**
- Check browser console (F12) for errors
- Verify NEXT_PUBLIC_MAPBOX_TOKEN in frontend/.env.local