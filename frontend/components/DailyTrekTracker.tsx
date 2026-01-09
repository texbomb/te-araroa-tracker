'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import ElevationProfile from './ElevationProfile'

interface Activity {
  id: number
  name: string | null
  date: string
  start_time: string | null
  distance_km: number | null
  elevation_gain_m: number | null
  duration_seconds: number | null
  raw_gps_data: Array<{ lat: number; lon: number; ele: number; time?: string }> | null
}

export default function DailyTrekTracker() {
  const [todayActivities, setTodayActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchTodayActivities = async () => {
    try {
      // Get all activities and find the most recent one
      const allActivities = await api.getActivities()

      if (allActivities.length === 0) {
        setTodayActivities([])
        setLastUpdate(new Date())
        setLoading(false)
        return
      }

      // Sort by date descending to get most recent
      const sortedActivities = allActivities.sort((a: Activity, b: Activity) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      const mostRecentActivity = sortedActivities[0]
      // Use start_time if available (includes time), otherwise fall back to date
      const activityTimestamp = mostRecentActivity.start_time || mostRecentActivity.date
      const activityDate = new Date(activityTimestamp)
      const now = new Date()

      // Calculate hours since the activity
      const hoursSinceActivity = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60)

      console.log('Most recent activity:', mostRecentActivity.name, 'from', activityTimestamp)
      console.log('Activity date parsed:', activityDate.toISOString())
      console.log('Current time:', now.toISOString())
      console.log('Hours since activity:', hoursSinceActivity)

      // If activity was within last 36 hours, show it as "today's trek"
      // (36 hours accounts for timezone differences and late uploads)
      if (hoursSinceActivity <= 36) {
        setTodayActivities([mostRecentActivity])
      } else {
        setTodayActivities([])
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch today\'s activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodayActivities()
    // Refresh every 5 minutes
    const interval = setInterval(fetchTodayActivities, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getTotalStats = () => {
    const totalDistance = todayActivities.reduce((sum, act) => sum + (act.distance_km || 0), 0)
    const totalElevation = todayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0)
    const totalDuration = todayActivities.reduce((sum, act) => sum + (act.duration_seconds || 0), 0)
    return { totalDistance, totalElevation, totalDuration }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl shadow-lg border border-emerald-200">
        <h2 className="text-xl font-bold text-emerald-900 mb-4">Today&apos;s Trek</h2>
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  const { totalDistance, totalElevation, totalDuration } = getTotalStats()
  const hasActivities = todayActivities.length > 0

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl shadow-lg border border-emerald-200">
      <h2 className="text-xl font-bold text-emerald-900 mb-4">Today&apos;s Trek</h2>

      {!hasActivities ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏕️</div>
          <p className="text-lg font-semibold text-gray-700 mb-2">Resting Day</p>
          <p className="text-sm text-gray-500">No activities recorded today</p>
          <p className="text-xs text-gray-400 mt-4">
            Could be tramping out of service or taking a well-deserved break
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/70 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-600 mb-1">Distance</p>
              <p className="text-2xl font-bold text-emerald-700">
                {totalDistance.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">km</p>
            </div>
            <div className="bg-white/70 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-600 mb-1">Elevation</p>
              <p className="text-2xl font-bold text-emerald-700">
                {totalElevation.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">m</p>
            </div>
            <div className="bg-white/70 p-4 rounded-lg text-center">
              <p className="text-xs text-gray-600 mb-1">Time</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatDuration(totalDuration).split(' ')[0]}
              </p>
              <p className="text-xs text-gray-500">{formatDuration(totalDuration).split(' ')[1] || ''}</p>
            </div>
          </div>

          {/* Elevation Profile */}
          {todayActivities[0]?.raw_gps_data && todayActivities[0].raw_gps_data.length > 0 && (
            <div className="bg-white/70 p-4 rounded-lg">
              <ElevationProfile gpsData={todayActivities[0].raw_gps_data} />
            </div>
          )}

          {todayActivities.length > 1 && (
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Activities ({todayActivities.length})
              </p>
              <div className="space-y-2">
                {todayActivities.map((activity, idx) => (
                  <div key={activity.id} className="bg-white/50 p-2 rounded text-xs">
                    <span className="font-medium text-gray-700">
                      {idx + 1}. {activity.name || 'Unnamed Activity'}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {activity.distance_km?.toFixed(1)} km
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 text-right mt-4">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  )
}
