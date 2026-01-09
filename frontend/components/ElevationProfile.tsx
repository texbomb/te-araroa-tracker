'use client'

import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface GPSPoint {
  lat: number
  lon: number
  ele: number
  time?: string
}

interface ElevationProfileProps {
  gpsData: GPSPoint[]
}

// Helper function to convert degrees to radians
const toRad = (value: number) => (value * Math.PI) / 180

export default function ElevationProfile({ gpsData }: ElevationProfileProps) {
  // Process GPS data to create elevation profile with cumulative distance
  const chartData = useMemo(() => {
    if (!gpsData || gpsData.length === 0) return []

    let cumulativeDistance = 0
    const data = []

    for (let i = 0; i < gpsData.length; i++) {
      const point = gpsData[i]

      // Calculate distance from previous point using Haversine formula
      if (i > 0) {
        const prev = gpsData[i - 1]
        const R = 6371 // Earth's radius in km
        const dLat = toRad(point.lat - prev.lat)
        const dLon = toRad(point.lon - prev.lon)
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(prev.lat)) * Math.cos(toRad(point.lat)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c
        cumulativeDistance += distance
      }

      data.push({
        distance: parseFloat(cumulativeDistance.toFixed(2)),
        elevation: Math.round(point.ele),
      })
    }

    return data
  }, [gpsData])

  // Calculate stats for display
  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const elevations = chartData.map(d => d.elevation)
    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    const totalDistance = chartData[chartData.length - 1].distance

    return { minElevation, maxElevation, totalDistance }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        No elevation data available
      </div>
    )
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Elevation Profile</h3>

      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance"
            tick={{ fontSize: 11 }}
            label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'elevation') return [`${value}m`, 'Elevation']
              return [value, name]
            }}
            labelFormatter={(label: number) => `${label} km`}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#elevationGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {stats && (
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Min: {stats.minElevation}m</span>
          <span>Max: {stats.maxElevation}m</span>
          <span>Range: {stats.maxElevation - stats.minElevation}m</span>
        </div>
      )}
    </div>
  )
}
