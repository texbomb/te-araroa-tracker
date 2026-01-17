'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface RouteManagerProps {
  onRouteUpdate?: () => void
}

interface FullRouteInfo {
  id: number
  section_name: string | null
  total_distance_km: number
  total_points: number
  has_active_section: boolean
  active_section: ActiveSection | null
}

interface ActiveSection {
  id: number
  section_name: string
  start_distance_km: number
  end_distance_km: number
  description: string | null
}

export default function RouteManager({ onRouteUpdate }: RouteManagerProps) {
  const [routeInfo, setRouteInfo] = useState<FullRouteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Section selection state
  const [sectionName, setSectionName] = useState('')
  const [startKm, setStartKm] = useState(0)
  const [endKm, setEndKm] = useState(0)
  const [sectionDescription, setSectionDescription] = useState('')

  useEffect(() => {
    fetchRouteInfo()
  }, [])

  const fetchRouteInfo = async () => {
    try {
      setLoading(true)
      const info = await api.getFullRouteInfo()
      setRouteInfo(info)

      // Initialize section values if there's an active section
      if (info.active_section) {
        setSectionName(info.active_section.section_name)
        setStartKm(info.active_section.start_distance_km)
        setEndKm(info.active_section.end_distance_km)
        setSectionDescription(info.active_section.description || '')
      } else if (info.total_distance_km > 0) {
        // Default to full route
        setStartKm(0)
        setEndKm(info.total_distance_km)
      }
    } catch (err) {
      // No route uploaded yet - this is fine
      setRouteInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setSuccess(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a GPX file')
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)

      const result = await api.uploadPlannedRouteGPX(selectedFile, 'Full South Island Route')
      setSuccess(`Route uploaded! ${result.route.distance_km.toFixed(1)} km with ${result.route.points_count} points`)

      // Reset file input
      const fileInput = document.getElementById('route-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      setSelectedFile(null)

      // Refresh route info
      await fetchRouteInfo()

      if (onRouteUpdate) {
        onRouteUpdate()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload route')
    } finally {
      setUploading(false)
    }
  }

  const handleSetActiveSection = async () => {
    if (!sectionName.trim()) {
      setError('Please enter a section name')
      return
    }

    if (startKm >= endKm) {
      setError('Start distance must be less than end distance')
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)

      await api.setActiveSection(
        sectionName,
        startKm,
        endKm,
        sectionDescription || undefined
      )

      setSuccess(`Active section set: ${sectionName} (${(endKm - startKm).toFixed(1)} km)`)

      // Refresh route info
      await fetchRouteInfo()

      if (onRouteUpdate) {
        // Redirect to home page to see the updated route
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active section')
    } finally {
      setUploading(false)
    }
  }

  const handleClearActiveSection = async () => {
    if (!confirm('Clear active section and show full route?')) {
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)

      await api.clearActiveSection()
      setSuccess('Active section cleared. Showing full route.')

      // Refresh route info
      await fetchRouteInfo()

      if (onRouteUpdate) {
        // Redirect to home page to see the full route
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear active section')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold mb-4">Full Route</h3>

        {routeInfo ? (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <p className="text-sm">
              <span className="font-medium">Route:</span> {routeInfo.section_name || 'Unnamed Route'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Total Distance:</span> {routeInfo.total_distance_km.toFixed(1)} km
            </p>
            <p className="text-sm">
              <span className="font-medium">Points:</span> {routeInfo.total_points.toLocaleString()}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Upload the full South Island GPX file. You can then select which section to display.
            </p>

            <div>
              <label htmlFor="route-file" className="block text-sm font-medium text-gray-700 mb-2">
                GPX File
              </label>
              <input
                id="route-file"
                type="file"
                accept=".gpx"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50"
              />
            </div>

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Full Route'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Active Section Selection */}
      {routeInfo && routeInfo.total_distance_km > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Active Section</h3>

          {routeInfo.active_section && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
              <p className="font-medium text-green-900">{routeInfo.active_section.section_name}</p>
              <p className="text-sm text-green-700 mt-1">
                {routeInfo.active_section.start_distance_km.toFixed(1)} km → {routeInfo.active_section.end_distance_km.toFixed(1)} km
                ({(routeInfo.active_section.end_distance_km - routeInfo.active_section.start_distance_km).toFixed(1)} km total)
              </p>
              {routeInfo.active_section.description && (
                <p className="text-sm text-green-600 mt-1">{routeInfo.active_section.description}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="section-name" className="block text-sm font-medium text-gray-700 mb-2">
              Section Name
            </label>
            <input
              id="section-name"
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="e.g., Geraldine to Bluff"
              disabled={uploading}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-3 py-2 border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-km" className="block text-sm font-medium text-gray-700 mb-2">
                Start (km)
              </label>
              <input
                id="start-km"
                type="number"
                min={0}
                max={routeInfo.total_distance_km}
                step={1}
                value={startKm}
                onChange={(e) => setStartKm(parseFloat(e.target.value) || 0)}
                disabled={uploading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="end-km" className="block text-sm font-medium text-gray-700 mb-2">
                End (km)
              </label>
              <input
                id="end-km"
                type="number"
                min={0}
                max={routeInfo.total_distance_km}
                step={1}
                value={endKm}
                onChange={(e) => setEndKm(parseFloat(e.target.value) || 0)}
                disabled={uploading}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-3 py-2 border"
              />
            </div>
          </div>

          <div>
            <label htmlFor="section-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <input
              id="section-description"
              type="text"
              value={sectionDescription}
              onChange={(e) => setSectionDescription(e.target.value)}
              placeholder="e.g., Final section of the trail"
              disabled={uploading}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-3 py-2 border"
            />
          </div>

          {endKm > startKm && (
            <div className="bg-gray-50 p-3 rounded text-sm">
              <span className="font-medium">Selected Distance:</span> {(endKm - startKm).toFixed(1)} km
              ({((endKm - startKm) / routeInfo.total_distance_km * 100).toFixed(1)}% of total)
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSetActiveSection}
              disabled={uploading || !sectionName || startKm >= endKm}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Setting...' : 'Set Active Section'}
            </button>

            {routeInfo.active_section && (
              <button
                onClick={handleClearActiveSection}
                disabled={uploading}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Show Full Route
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
    </div>
  )
}
