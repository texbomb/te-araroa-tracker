'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface ProgressData {
  total_planned_km: number
  completed_km: number
  progress_percent: number
  days_on_trail: number
  activities_count: number
}

export default function ProgressBar() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProgress()
    // Refresh every 5 minutes
    const interval = setInterval(fetchProgress, 300000)
    return () => clearInterval(interval)
  }, [])

  const fetchProgress = async () => {
    try {
      const data = await api.getProgress()
      setProgress(data)
    } catch (error) {
      console.error('Failed to fetch progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-6 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!progress || progress.total_planned_km === 0) {
    return null // Don't show if no planned route
  }

  const remainingKm = progress.total_planned_km - progress.completed_km

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg shadow-md p-6 border border-emerald-100">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Trail Progress</h2>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-2xl font-bold text-emerald-700">
            {progress.progress_percent.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-600">
            {progress.completed_km.toFixed(1)} / {progress.total_planned_km.toFixed(1)} km
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(progress.progress_percent, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{progress.days_on_trail}</div>
          <div className="text-xs text-gray-600">Days on Trail</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{progress.activities_count}</div>
          <div className="text-xs text-gray-600">Activities</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{remainingKm.toFixed(0)}</div>
          <div className="text-xs text-gray-600">km Remaining</div>
        </div>
      </div>

      {/* Average distance per day */}
      {progress.days_on_trail > 0 && (
        <div className="mt-4 pt-4 border-t border-emerald-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Average per day:</span>
            <span className="font-semibold text-gray-900">
              {(progress.completed_km / progress.days_on_trail).toFixed(1)} km
            </span>
          </div>
          {remainingKm > 0 && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Estimated days remaining:</span>
              <span className="font-semibold text-gray-900">
                {Math.ceil(remainingKm / (progress.completed_km / progress.days_on_trail))} days
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
