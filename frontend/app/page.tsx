'use client'

import MapView from '@/components/Map/MapView'
import DailyTrekTracker from '@/components/DailyTrekTracker'
import TrekHistoryList from '@/components/TrekHistoryList'
import ProgressBar from '@/components/ProgressBar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Stats {
  total_distance_km: number
  total_elevation_m: number
  total_days: number
  avg_distance_per_day: number
}

type SidebarView = 'today' | 'history'

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapKey, setMapKey] = useState(0)
  const [dailyTrackerKey, setDailyTrackerKey] = useState(0)
  const [historyKey, setHistoryKey] = useState(0)
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null)
  const [sidebarView, setSidebarView] = useState<SidebarView>('today')

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
    // Refresh stats every 5 minutes (optimized for free tier)
    const interval = setInterval(fetchStats, 300000)
    return () => clearInterval(interval)
  }, [])

  const handleActivitySelect = (activityId: number) => {
    setSelectedActivityId(activityId)
  }

  const handleMapActivitySelect = (activityId: number | null) => {
    setSelectedActivityId(activityId)
    // If an activity is selected and we're on "today" view, switch to history
    if (activityId && sidebarView === 'today') {
      setSidebarView('history')
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Te Araroa Trail Tracker</h1>
            <p className="text-emerald-50 mt-1 font-light">Following the journey through New Zealand</p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 relative">
          <MapView
            key={mapKey}
            selectedActivityId={selectedActivityId}
            onActivitySelect={handleMapActivitySelect}
          />
        </div>

        <aside className="lg:w-96 bg-white shadow-lg flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setSidebarView('today')}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${sidebarView === 'today'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-gray-600 hover:text-emerald-600 hover:bg-gray-50'
                }
              `}
            >
              Today's Trek
            </button>
            <button
              onClick={() => setSidebarView('history')}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${sidebarView === 'history'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-gray-600 hover:text-emerald-600 hover:bg-gray-50'
                }
              `}
            >
              Trek History
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {sidebarView === 'today' ? (
              <>
                <DailyTrekTracker key={dailyTrackerKey} />

                {/* Progress Bar */}
                <ProgressBar />

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
              </>
            ) : (
              <TrekHistoryList
                key={historyKey}
                selectedActivityId={selectedActivityId}
                onActivitySelect={handleActivitySelect}
                refreshKey={historyKey}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
