# Strava Integration Setup Guide

This guide explains how to set up Strava integration for automatic activity syncing.

## Overview

The Strava integration provides an alternative (and more reliable) method for syncing your hiking activities compared to Garmin. Key benefits:

- **Official API** - Stable, well-documented REST API
- **Real-time Updates** - Optional webhooks for instant activity notifications
- **Better Free Tier** - 2,000 requests/day (plenty for personal use)
- **Dual Support** - Works alongside Garmin, use whichever you prefer

## Prerequisites

- Strava account with activities
- If using Garmin watch: Enable Garmin → Strava auto-sync in Strava settings

## Step 1: Register Strava API Application

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Click **"Create App"** or **"My API Application"**
3. Fill in the form:
   - **Application Name**: `Te Araroa Tracker` (or your choice)
   - **Category**: `Other`
   - **Club**: Leave blank
   - **Website**: Your frontend URL (e.g., `https://te-araroa-tracker.vercel.app`)
   - **Authorization Callback Domain**: Your backend domain (e.g., `your-app.railway.app`)
     - For local testing: `localhost`
   - **Application Description**: Brief description of your app
4. Click **"Create"**
5. Save the following credentials:
   - **Client ID** (e.g., `12345`)
   - **Client Secret** (keep this private!)

## Step 2: Configure Backend Environment Variables

Add to your `/backend/.env` file:

```bash
# Strava OAuth
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_WEBHOOK_VERIFY_TOKEN=random_secret_string_123
```

**Important Notes:**
- `STRAVA_CLIENT_ID` - Your application's Client ID from Step 1
- `STRAVA_CLIENT_SECRET` - Your application's Client Secret from Step 1
- `STRAVA_WEBHOOK_VERIFY_TOKEN` - Any random string for webhook verification (optional, only needed for webhooks)

### For Railway Production:

Set these as environment variables in Railway dashboard:
1. Go to your Railway project
2. Select your backend service
3. Go to **Variables** tab
4. Add the three Strava variables above

## Step 3: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

New dependency added: `httpx>=0.25.0` for async HTTP requests

## Step 4: Database Migration

The integration adds two new columns/tables:

### Activity Model Changes:
- Added `strava_activity_id` column (BigInteger, unique, nullable)

### New Table: strava_tokens
- Stores OAuth access tokens and refresh tokens
- Automatically created on first run

**For SQLite (local development):**
- Delete `test.db` and restart backend to recreate tables
- Or run: `rm test.db && uvicorn app.main:app --reload`

**For PostgreSQL (Railway production):**
- Tables will be created automatically on first API call
- Or manually create using SQLAlchemy:
  ```python
  from app.database import engine, Base
  Base.metadata.create_all(bind=engine)
  ```

## Step 5: Connect Strava Account

### Via Admin Dashboard (Recommended):

1. Go to `/admin` page
2. Enter admin password
3. In the **Strava Integration** section:
   - Click **"Connect to Strava"**
   - A popup window will open with Strava authorization
   - Log in to Strava and click **"Authorize"**
   - The popup will close and you'll see "Connected" status
4. Click **"Sync Activities"** to fetch your activities
5. Activities will appear in the activity list with an orange "Strava" badge

### Via API (Manual):

1. **Get Authorization URL:**
   ```bash
   curl "http://localhost:8000/api/strava/auth/authorize?redirect_uri=http://localhost:8000/api/strava/callback"
   ```

2. **Open the URL** in your browser and authorize

3. **Exchange code for token** (happens automatically at callback)

4. **Trigger Sync:**
   ```bash
   curl -X POST "http://localhost:8000/api/strava/sync?days=30"
   ```

## Step 6: Test the Integration

1. Upload a test activity to Strava (or use existing activity)
2. In admin dashboard, click **"Sync Activities"**
3. Check that activities appear with:
   - Orange "Strava" badge
   - Correct distance, elevation, date
   - GPS route visible on map

## Optional: Enable Webhooks (Real-time Updates)

Webhooks allow instant activity updates without manual syncing.

### Setup Webhook Subscription:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_CLIENT_ID \
  -F client_secret=YOUR_CLIENT_SECRET \
  -F callback_url=https://your-app.railway.app/api/strava/webhook \
  -F verify_token=YOUR_WEBHOOK_VERIFY_TOKEN
```

### Verify Webhook Works:

1. Upload a new activity to Strava
2. Activity should appear in tracker within seconds (no manual sync needed)
3. Check backend logs for webhook event:
   ```
   POST /api/strava/webhook - Activity created: 12345
   ```

### View Webhook Status:

```bash
curl "https://www.strava.com/api/v3/push_subscriptions?client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

### Delete Webhook:

```bash
curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/SUBSCRIPTION_ID?client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

## API Endpoints

### Authentication

- `GET /api/strava/auth/authorize` - Get authorization URL
- `GET /api/strava/auth/callback` - OAuth callback (automatic)
- `GET /api/strava/auth/status` - Check connection status
- `POST /api/strava/auth/disconnect` - Disconnect Strava account

### Sync

- `POST /api/strava/sync?days=30` - Manual sync (10 requests/hour limit)
  - `days`: Number of past days to sync (1-180)

### Webhooks

- `GET /api/strava/webhook` - Webhook verification (Strava calls this)
- `POST /api/strava/webhook` - Webhook events (Strava calls this)

## Rate Limits

Strava API limits (free tier):
- **200 requests / 15 minutes**
- **2,000 requests / day**

Your usage:
- OAuth flow: 1-2 requests (one-time)
- Manual sync: 1-5 requests per sync
- Webhook events: 0 requests (Strava pushes to you)

**Recommendation:** Use webhooks to stay well within limits.

## Troubleshooting

### "Not authenticated with Strava"

**Solution:** Go to admin dashboard and click "Connect to Strava"

### "Invalid client_id or client_secret"

**Solution:** Check environment variables match Strava app credentials

### "Callback domain mismatch"

**Solution:** Update "Authorization Callback Domain" in Strava app settings to match your backend domain

### Activities not syncing

**Checks:**
1. Are activities visible on Strava website?
2. Is Strava connected? (Check status in admin dashboard)
3. Are activities within the sync date range? (default: 30 days)
4. Check backend logs for errors

### Webhook not receiving events

**Checks:**
1. Is webhook subscription active? (Use API to check)
2. Is backend publicly accessible? (Webhooks require public URL)
3. Does `STRAVA_WEBHOOK_VERIFY_TOKEN` match subscription?
4. Check Strava sends to correct `callback_url`

## Data Mapping

Strava → Database:

| Strava Field | Database Column | Notes |
|--------------|-----------------|-------|
| `id` | `strava_activity_id` | Unique identifier |
| `name` | `name` | Activity name |
| `distance` | `distance_km` | Converted from meters |
| `total_elevation_gain` | `elevation_gain_m` | Meters |
| `moving_time` | `duration_seconds` | Moving time (excludes pauses) |
| `start_date_local` | `date`, `start_time` | Local timezone |
| `average_heartrate` | `avg_heart_rate` | BPM |
| `max_heartrate` | `max_heart_rate` | BPM |
| `calories` | `calories` | Kilocalories |
| `map.polyline` | `route_polyline` | Encoded polyline |
| Streams (latlng, altitude) | `raw_gps_data` | Full GPS track |

## Security Notes

1. **Client Secret** - Never commit to Git, use environment variables
2. **Webhook Token** - Use random, unpredictable string
3. **HTTPS Required** - Strava requires HTTPS for production webhooks
4. **Token Storage** - Access tokens stored in database, refresh tokens encrypted

## Next Steps

1. Test the integration locally
2. Deploy to production (Railway + Vercel)
3. Set up Strava app with production URLs
4. Enable webhooks for real-time sync
5. Enjoy automatic activity tracking!

## Additional Resources

- [Strava API Documentation](https://developers.strava.com/docs/)
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava Authentication](https://developers.strava.com/docs/authentication/)
- [Strava Webhooks](https://developers.strava.com/docs/webhooks/)
