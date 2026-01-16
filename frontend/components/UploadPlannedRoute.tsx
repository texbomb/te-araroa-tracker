'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface UploadPlannedRouteProps {
  onUploadComplete?: () => void
}

export default function UploadPlannedRoute({ onUploadComplete }: UploadPlannedRouteProps) {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sectionName, setSectionName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

      const result = await api.uploadPlannedRouteGPX(
        selectedFile,
        sectionName || undefined,
        description || undefined
      )

      setSuccess(
        `Planned route uploaded! ${result.route.distance_km.toFixed(1)} km with ${result.route.points_count} points`
      )
      setSelectedFile(null)
      setSectionName('')
      setDescription('')

      // Reset file input
      const fileInput = document.getElementById('planned-route-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload planned route')
    } finally {
      setUploading(false)
    }
  }

  const handleClearRoute = async () => {
    if (!confirm('Are you sure you want to clear the planned route? This will remove the trail line from the map.')) {
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(null)

      await api.clearPlannedRoute()
      setSuccess('Planned route cleared successfully')

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear planned route')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="planned-route-file" className="block text-sm font-medium text-gray-700 mb-2">
          Upload Planned Route (GPX file)
        </label>
        <input
          id="planned-route-file"
          type="file"
          accept=".gpx"
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-500">
          Upload a GPX file of your planned Te Araroa section (e.g., Geraldine to Bluff)
        </p>
      </div>

      <div>
        <label htmlFor="section-name" className="block text-sm font-medium text-gray-700 mb-1">
          Section Name (optional)
        </label>
        <input
          id="section-name"
          type="text"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="e.g., Geraldine to Bluff"
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Southern South Island section, approximately 700km"
          disabled={uploading}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {uploading ? 'Uploading...' : 'Upload Planned Route'}
        </button>

        <button
          onClick={handleClearRoute}
          disabled={uploading}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Clear Route
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
        <strong>Tip:</strong> Export your planned section from a tool like Gaia GPS, AllTrails, or the official Te Araroa GPX files. This will show as a reference line on the map and enable progress tracking.
      </div>
    </div>
  )
}
