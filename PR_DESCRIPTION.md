# Pull Request: Add Strava Integration for Activity Sync

## Summary

Implements full Strava OAuth integration as an alternative to Garmin for automatic activity syncing. This provides a more reliable, official API-based solution with better free tier support and optional real-time webhook updates.

## What's New

### Backend Changes
- ✅ **OAuth2 Authentication**: Complete OAuth flow with automatic token refresh
- ✅ **Activity Sync**: Fetch activities with full GPS streams, elevation, and heart rate data
- ✅ **Webhook Support**: Optional real-time activity updates (no polling needed)
- ✅ **Rate Limiting**: 10 syncs/hour to stay within Strava's free tier
- ✅ **Dual Support**: Works alongside Garmin - use either or both

### Frontend Changes
- ✅ **Strava Connection UI**: Clean interface in admin dashboard
- ✅ **Connection Status**: Green badge showing connection state
- ✅ **Manual Sync**: Trigger sync for last 30 days of activities
- ✅ **Activity Badges**: Orange "Strava" badge for synced activities
- ✅ **Connection Management**: Connect/disconnect buttons

## Files Created

**Backend:**
- `backend/app/models/strava_token.py` - OAuth token storage model
- `backend/app/services/strava_sync.py` - Core Strava integration service (~350 lines)
- `backend/app/routes/strava.py` - API endpoints for auth, sync, webhooks (~250 lines)

**Documentation:**
- `STRAVA_SETUP.md` - Complete setup guide with troubleshooting

## Files Modified

**Backend:**
- `backend/app/models/activity.py` - Added `strava_activity_id` column
- `backend/app/models/__init__.py` - Export StravaToken model
- `backend/app/config.py` - Added Strava environment variables
- `backend/app/main.py` - Include Strava router
- `backend/requirements.txt` - Added `httpx>=0.25.0` dependency
- `backend/.env.example` - Added Strava configuration examples

**Frontend:**
- `frontend/app/admin/page.tsx` - Added Strava integration section

## Key Features

### Advantages over Garmin
- **Official API**: Stable, documented, won't break unexpectedly
- **Real-time Updates**: Webhooks for instant activity sync (optional)
- **Better Free Tier**: 2,000 requests/day vs undefined for Garmin
- **Long-term Reliability**: Active maintenance and developer support

### Rate Limits
- 200 requests / 15 minutes
- 2,000 requests / day
- Manual sync uses ~3-5 requests
- Webhooks use 0 requests (push-based)

## API Endpoints

### Authentication
- `GET /api/strava/auth/authorize` - Get OAuth authorization URL
- `GET /api/strava/auth/callback` - OAuth callback handler
- `GET /api/strava/auth/status` - Check connection status
- `POST /api/strava/auth/disconnect` - Disconnect account

### Sync
- `POST /api/strava/sync?days=30` - Manual activity sync (rate limited)

### Webhooks (Optional)
- `GET /api/strava/webhook` - Webhook verification
- `POST /api/strava/webhook` - Webhook event handler

## Setup Required

1. **Register Strava App**: https://www.strava.com/settings/api
2. **Add Environment Variables**:
   ```bash
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   STRAVA_WEBHOOK_VERIFY_TOKEN=random_string  # Optional, for webhooks
   ```
3. **Database Migration**: New `strava_tokens` table and `strava_activity_id` column will be created automatically

## Testing

### Local Testing
1. Start backend: `uvicorn app.main:app --reload`
2. Start frontend: `npm run dev`
3. Go to `/admin`
4. Click "Connect to Strava"
5. Authorize in popup
6. Click "Sync Activities"

### Production
- Update Strava app settings with production URLs
- Set environment variables in Railway
- Deploy and test OAuth flow

## Documentation

Complete setup guide available in `STRAVA_SETUP.md` including:
- Step-by-step registration and setup
- Webhook configuration
- Troubleshooting guide
- Security best practices
- API endpoint documentation

## Breaking Changes

None - this is additive functionality that doesn't affect existing Garmin integration.

## Next Steps

- [ ] Register Strava API application
- [ ] Add environment variables
- [ ] Test OAuth flow
- [ ] Optional: Enable webhooks for real-time sync

---

**Ready to merge and test!** 🚀
