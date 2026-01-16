'use client'

import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import ElevationProfile from './ElevationProfile'

interface Activity {
  id: number
  name: string | null
  source: string
  date: string
  start_time: string | null
  distance_km: number
  elevation_gain_m: number
  elevation_loss_m: number | null
  min_elevation_m: number | null
  max_elevation_m: number | null
  duration_seconds: number
  avg_heart_rate: number | null
  max_heart_rate: number | null
  calories: number | null
  raw_gps_data: Array<{ lat: number; lon: number; elevation: number; time: string }>
}

interface Photo {
  id: number
  activity_id: number | null
  cloudinary_url: string
  thumbnail_url: string | null
  caption: string | null
  latitude: number | null
  longitude: number | null
  taken_at: string | null
}

interface TrekHistoryListProps {
  selectedActivityId: number | null
  onActivitySelect: (activityId: number) => void
  refreshKey?: number
}

export default function TrekHistoryList({
  selectedActivityId,
  onActivitySelect,
  refreshKey = 0
}: TrekHistoryListProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedActivityId, setExpandedActivityId] = useState<number | null>(null)
  const [activityPhotos, setActivityPhotos] = useState<{ [activityId: number]: Photo[] }>({})
  const [loadingPhotos, setLoadingPhotos] = useState<{ [activityId: number]: boolean }>({})
  const selectedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchActivities()
  }, [refreshKey])

  // Auto-scroll to selected activity
  useEffect(() => {
    if (selectedActivityId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedActivityId])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const data = await api.getActivities()
      // Sort by date descending (newest first)
      const sorted = data.sort((a: Activity, b: Activity) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setActivities(sorted)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-NZ', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const fetchPhotosForActivity = async (activityId: number) => {
    if (activityPhotos[activityId]) {
      // Already fetched
      return
    }

    setLoadingPhotos(prev => ({ ...prev, [activityId]: true }))
    try {
      const photos = await api.getPhotos(activityId)
      setActivityPhotos(prev => ({ ...prev, [activityId]: photos }))
    } catch (error) {
      console.error('Failed to fetch photos for activity:', error)
      setActivityPhotos(prev => ({ ...prev, [activityId]: [] }))
    } finally {
      setLoadingPhotos(prev => ({ ...prev, [activityId]: false }))
    }
  }

  const handleActivityClick = (activityId: number) => {
    onActivitySelect(activityId)
    // Toggle elevation profile expansion
    const willExpand = expandedActivityId !== activityId
    setExpandedActivityId(willExpand ? activityId : null)

    // Fetch photos when expanding
    if (willExpand) {
      fetchPhotosForActivity(activityId)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading trek history...
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No activities yet. Upload a GPX file or sync with Garmin to get started!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold mb-4">Trek History</h2>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {activities.map((activity) => {
          const isSelected = activity.id === selectedActivityId
          const isExpanded = activity.id === expandedActivityId

          return (
            <div
              key={activity.id}
              ref={isSelected ? selectedRef : null}
              onClick={() => handleActivityClick(activity.id)}
              className={`
                p-4 rounded-lg border-2 transition-all cursor-pointer
                ${isSelected
                  ? 'border-emerald-500 bg-emerald-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                }
              `}
            >
              {/* Date Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(activity.date)}
                  </span>
                  <span className={`
                    px-2 py-0.5 text-xs rounded-full
                    ${activity.source === 'garmin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                    }
                  `}>
                    {activity.source === 'garmin' ? 'Garmin' : 'GPX Upload'}
                  </span>
                </div>
                {isSelected && (
                  <span className="text-emerald-600 text-sm font-medium">
                    Selected
                  </span>
                )}
              </div>

              {/* Activity Name */}
              {activity.name && (
                <div className="text-sm text-gray-600 mb-3">
                  {activity.name}
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Distance</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {activity.distance_km.toFixed(1)} km
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="text-lg font-bold text-gray-700">
                    {formatDuration(activity.duration_seconds)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Elevation Gain</div>
                  <div className="text-lg font-bold text-orange-600">
                    {activity.elevation_gain_m ? `${activity.elevation_gain_m}m` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Avg Heart Rate</div>
                  <div className="text-lg font-bold text-red-600">
                    {activity.avg_heart_rate ? `${activity.avg_heart_rate} bpm` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Additional Stats (if available) */}
              {(activity.min_elevation_m || activity.max_elevation_m || activity.calories) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {activity.min_elevation_m && (
                      <div>
                        <div className="text-gray-500">Min Elev</div>
                        <div className="font-semibold">{activity.min_elevation_m}m</div>
                      </div>
                    )}
                    {activity.max_elevation_m && (
                      <div>
                        <div className="text-gray-500">Max Elev</div>
                        <div className="font-semibold">{activity.max_elevation_m}m</div>
                      </div>
                    )}
                    {activity.calories && (
                      <div>
                        <div className="text-gray-500">Calories</div>
                        <div className="font-semibold">{activity.calories}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Elevation Profile (Expanded) */}
              {isExpanded && activity.raw_gps_data && activity.raw_gps_data.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Elevation Profile
                  </div>
                  <ElevationProfile
                    gpsData={activity.raw_gps_data}
                    height={150}
                  />
                </div>
              )}

              {/* Photos (Expanded) */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    Photos ({activityPhotos[activity.id]?.length || 0})
                  </div>

                  {loadingPhotos[activity.id] ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Loading photos...
                    </div>
                  ) : activityPhotos[activity.id] && activityPhotos[activity.id].length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {activityPhotos[activity.id].map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.thumbnail_url || photo.cloudinary_url}
                            alt={photo.caption || 'Activity photo'}
                            className="w-full h-32 object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(photo.cloudinary_url, '_blank')
                            }}
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1.5 rounded-b-lg">
                              {photo.caption}
                            </div>
                          )}
                          {photo.latitude && photo.longitude && (
                            <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                              📍
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-4">
                      No photos for this activity
                    </div>
                  )}
                </div>
              )}

              {/* Expand/Collapse Hint */}
              {activity.raw_gps_data && activity.raw_gps_data.length > 0 && (
                <div className="mt-2 text-xs text-center text-gray-400">
                  {isExpanded ? '▲ Click to hide details' : '▼ Click to show details'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
