'use client'

import MapView from '@/components/Map/MapView'
import UploadGPX from '@/components/UploadGPX'
import DailyTrekTracker from '@/components/DailyTrekTracker'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Stats {
  total_distance_km: number
  total_elevation_m: number
  total_days: number
  avg_distance_per_day: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapKey, setMapKey] = useState(0)

  const fetchStats = async () => {
    try {
      const data = await api.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleUploadComplete = () => {
    // Refresh stats
    fetchStats()
    // Force map to reload by changing key
    setMapKey(prev => prev + 1)
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-6 shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight">Te Araroa Trail Tracker</h1>
        <p className="text-emerald-50 mt-1 font-light">Following the journey through New Zealand</p>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 relative">
          <MapView key={mapKey} />
        </div>

        <aside className="lg:w-96 bg-white p-6 shadow-lg overflow-y-auto space-y-6">
          <DailyTrekTracker />

          <div>
            <h2 className="text-xl font-semibold mb-4">Overall Progress</h2>

            {loading ? (
              <p className="text-gray-500">Loading stats...</p>
            ) : stats ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Distance</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.total_distance_km} km
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Elevation Gain</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.total_elevation_m.toLocaleString()} m
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Days on Trail</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.total_days}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Average per Day</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.avg_distance_per_day} km
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No activity data yet</p>
            )}
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-3">Upload Activity</h3>
            <UploadGPX onUploadComplete={handleUploadComplete} />
          </div>
        </aside>
      </main>
    </div>
  );
}
