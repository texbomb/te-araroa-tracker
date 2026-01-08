# Deployment Guide

This guide will help you deploy the Te Araroa Trail Tracker to production.

## Backend Deployment (Railway - Recommended)

### Option 1: Railway (Easiest)

1. **Create Railway Account**
   - Go to https://railway.app/
   - Sign up with GitHub

2. **Deploy Backend**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose the `nz_walk` repository
   - Railway will auto-detect the `backend` folder

3. **Add PostgreSQL Database**
   - In your Railway project, click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL` environment variable

4. **Set Environment Variables**
   - Go to your backend service → "Variables"
   - Add these variables:
     ```
     GARMIN_EMAIL=johanmogelvang@gmail.com
     GARMIN_PASSWORD=<your-password>
     ```
   - `DATABASE_URL` is automatically set by Railway

5. **Deploy**
   - Railway will automatically deploy
   - Wait for build to complete
   - Copy the generated URL (e.g., `https://your-app.railway.app`)

6. **Initialize Database**
   - Once deployed, you need to create tables
   - Railway doesn't run `init_db.py` automatically
   - You can either:
     - Add a migration system (Alembic)
     - Or manually create tables via Railway CLI or API call

### Option 2: Render

1. **Create Render Account**
   - Go to https://render.com/
   - Sign up with GitHub

2. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Choose free tier
   - Copy the "Internal Database URL"

3. **Deploy Backend**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Root Directory**: `backend`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Set Environment Variables**
   - In service settings → "Environment"
   - Add:
     ```
     DATABASE_URL=<your-postgres-url>
     GARMIN_EMAIL=johanmogelvang@gmail.com
     GARMIN_PASSWORD=<your-password>
     ```

5. **Deploy**
   - Render will auto-deploy
   - Copy the service URL

## Frontend Deployment (Vercel)

1. **Create Vercel Account**
   - Go to https://vercel.com/
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your `nz_walk` repository
   - Vercel will detect it's a Next.js app

3. **Configure Build Settings**
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - Vercel auto-detects build settings

4. **Set Environment Variables**
   - In project settings → "Environment Variables"
   - Add:
     ```
     NEXT_PUBLIC_BACKEND_URL=<your-railway-or-render-url>
     NEXT_PUBLIC_MAPBOX_TOKEN=<your-mapbox-token>
     ```

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your site will be live at `https://your-project.vercel.app`

6. **Update Backend CORS**
   - Update `backend/app/main.py` line 12:
   - Change from `allow_origins=["*"]` to:
     ```python
     allow_origins=[
         "https://your-project.vercel.app",
         "http://localhost:3000",
         "http://localhost:3001"
     ]
     ```

## Post-Deployment

### Upload Existing Activities
Since you have 2 activities already in your local database, you'll need to re-upload them:

1. Go to your deployed site
2. Click "Upload Activity"
3. Upload both GPX files from `gpx_data/` folder

### Test on Phone
1. Open `https://your-project.vercel.app` on your phone
2. Test GPX upload with a file from Garmin Connect
3. Verify the activity appears on the map
4. Check that stats update correctly

## Database Migration (Optional but Recommended)

For production, consider adding Alembic for database migrations:

```bash
cd backend
pip install alembic
alembic init migrations
```

This will help manage schema changes without manual SQL.

## Monitoring

- **Railway**: Built-in logs and metrics
- **Vercel**: Analytics and deployment logs
- **Render**: Logs in dashboard

## Costs

- **Railway**: Free tier includes 500 hours/month
- **Render**: Free tier for web services (sleeps after 15 min inactivity)
- **Vercel**: Free tier for personal projects

## Troubleshooting

### Backend won't start
- Check Railway/Render logs
- Verify `DATABASE_URL` is set
- Ensure all dependencies in `requirements.txt`

### Frontend can't connect to backend
- Check CORS settings
- Verify `NEXT_PUBLIC_BACKEND_URL` is correct
- Test backend health endpoint: `<backend-url>/health`

### Database tables don't exist
- Run initialization manually
- Or add Alembic migrations

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Deploy frontend to Vercel
3. ✅ Test GPX upload from phone
4. 🔒 Add authentication (recommended before sharing publicly)
5. 📊 Monitor usage and costs
