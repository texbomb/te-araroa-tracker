'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminAuth from '@/components/AdminAuth'
import UploadGPX from '@/components/UploadGPX'
import PhotoUpload from '@/components/PhotoUpload'
import PhotoManagement from '@/components/PhotoManagement'
import { api } from '@/lib/api'

interface Activity {
  id: number
  name: string | null
  date: string
  distance_km: number | null
  elevation_gain_m: number | null
  duration_seconds: number | null
  source: string
}

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [stravaLoading, setStravaLoading] = useState(false)
  const [stravaSyncing, setStravaSyncing] = useState(false)

  // Handle OAuth callback from Strava
  useEffect(() => {
    const stravaConnectedParam = searchParams.get('strava_connected')
    const stravaError = searchParams.get('strava_error')
    const athleteName = searchParams.get('athlete_name')

    if (stravaConnectedParam === 'true') {
      setStravaConnected(true)
      alert(`Successfully connected to Strava! Welcome ${athleteName || ''}!`)
      // Refresh activities after successful connection (bust cache in case webhook already synced)
      if (isAuthenticated) {
        fetchActivities(true)
      }
      // Clean up URL
      router.replace('/admin')
    } else if (stravaError) {
      alert(`Failed to connect to Strava: ${stravaError}`)
      // Clean up URL
      router.replace('/admin')
    }
  }, [searchParams, router, isAuthenticated])

  const fetchActivities = async (bustCache = false) => {
    try {
      setLoading(true)
      const data = await api.getActivities(undefined, undefined, bustCache)

      // Validate response is an array
      if (!Array.isArray(data)) {
        console.error('Activities API returned non-array:', data)
        setActivities([])
        return
      }

      // Sort by date descending (newest first)
      const sorted = data.sort((a: Activity, b: Activity) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setActivities(sorted)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const handleAuthenticated = () => {
    setIsAuthenticated(true)
    fetchActivities()
    checkStravaStatus()
  }

  const checkStravaStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/strava/auth/status`)
      const data = await response.json()
      setStravaConnected(data.connected)
    } catch (error) {
      console.error('Failed to check Strava status:', error)
    }
  }

  const handleStravaConnect = async () => {
    try {
      setStravaLoading(true)

      // Use backend callback for better security - tokens never touch frontend
      const redirectUri = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/strava/auth/callback`
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/strava/auth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`
      )
      const data = await response.json()

      // Redirect to Strava authorization page
      // Backend will handle the callback and redirect back to /admin with status
      window.location.href = data.authorization_url
    } catch (error) {
      console.error('Failed to connect to Strava:', error)
      alert('Failed to connect to Strava')
      setStravaLoading(false)
    }
  }

  const handleStravaDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Strava?')) return

    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/strava/auth/disconnect`, {
        method: 'POST'
      })
      setStravaConnected(false)
      alert('Successfully disconnected from Strava')
    } catch (error) {
      console.error('Failed to disconnect Strava:', error)
      alert('Failed to disconnect from Strava')
    }
  }

  const handleStravaSync = async () => {
    try {
      setStravaSyncing(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/strava/sync?days=30`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        alert(`Successfully synced ${data.new_activities} new activities from Strava`)
        // Bust cache to ensure new activities are fetched immediately
        fetchActivities(true)
      }
    } catch (error) {
      console.error('Failed to sync Strava activities:', error)
      alert('Failed to sync Strava activities')
    } finally {
      setStravaSyncing(false)
    }
  }

  const handleUploadComplete = () => {
    // Bust cache to ensure new uploaded activity is fetched immediately
    fetchActivities(true)
  }

  const handleDeleteClick = (activityId: number) => {
    setDeleteConfirm(activityId)
  }

  const handleDeleteConfirm = async (activityId: number) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/activities/${activityId}`, {
        method: 'DELETE'
      })

      // Refresh list with cache busting to ensure deleted activity is removed immediately
      fetchActivities(true)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete activity:', error)
      alert('Failed to delete activity')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NZ', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-purple-100 mt-1 font-light">Manage your Te Araroa trek data</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
            >
              ← Back to Tracker
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Authentication */}
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto mt-12">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Access Required</h2>
                <p className="text-gray-600 mt-2">Enter your password to access the admin dashboard</p>
              </div>
              <AdminAuth
                isAuthenticated={isAuthenticated}
                onAuthenticated={handleAuthenticated}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upload GPX Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Activity</h2>
              <UploadGPX onUploadComplete={handleUploadComplete} />
            </div>

            {/* Upload Photos Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Photos</h2>
              <PhotoUpload onUploadComplete={handleUploadComplete} />
            </div>

            {/* Manage Photos Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Manage Photos</h2>
              <PhotoManagement onPhotoDeleted={handleUploadComplete} />
            </div>

            {/* Strava Integration */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Strava Integration</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Connect your Strava account to automatically sync activities
                  </p>
                </div>
                {stravaConnected && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {!stravaConnected ? (
                  <button
                    onClick={handleStravaConnect}
                    disabled={stravaLoading}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {stravaLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                        </svg>
                        Connect to Strava
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleStravaSync}
                      disabled={stravaSyncing}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {stravaSyncing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync Activities
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleStravaDisconnect}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>

              {stravaConnected && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Tip:</strong> Click "Sync Activities" to fetch your latest Strava activities from the past 30 days.
                  </p>
                </div>
              )}
            </div>

            {/* Activity Management */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Manage Activities</h2>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading activities...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No activities yet. Upload a GPX file to get started!</div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">
                              {activity.name || 'Unnamed Activity'}
                            </h3>
                            <span className={`
                              px-2 py-0.5 text-xs rounded-full
                              ${activity.source === 'garmin'
                                ? 'bg-blue-100 text-blue-700'
                                : activity.source === 'strava'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-purple-100 text-purple-700'
                              }
                            `}>
                              {activity.source === 'garmin'
                                ? 'Garmin'
                                : activity.source === 'strava'
                                ? 'Strava'
                                : 'GPX Upload'}
                            </span>
                          </div>

                          <div className="text-sm text-gray-600">
                            {formatDate(activity.date)}
                          </div>

                          <div className="flex gap-6 mt-2 text-sm">
                            <div>
                              <span className="text-gray-500">Distance:</span>{' '}
                              <span className="font-medium text-gray-900">
                                {activity.distance_km != null ? `${activity.distance_km.toFixed(1)} km` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Elevation:</span>{' '}
                              <span className="font-medium text-gray-900">
                                {activity.elevation_gain_m != null ? `${activity.elevation_gain_m}m` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Duration:</span>{' '}
                              <span className="font-medium text-gray-900">
                                {activity.duration_seconds != null ? formatDuration(activity.duration_seconds) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {/* Edit button - placeholder for future */}
                          <button
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Edit (coming soon)"
                            disabled
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete button */}
                          {deleteConfirm === activity.id ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteConfirm(activity.id)}
                                className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeleteClick(activity.id)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Delete activity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Wrap in Suspense boundary for Next.js 14+ static generation
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AdminPageContent />
    </Suspense>
  )
}
