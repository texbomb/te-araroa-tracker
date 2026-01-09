'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import AdminAuth from './AdminAuth'

interface UploadGPXProps {
  onUploadComplete?: () => void
}

export default function UploadGPX({ onUploadComplete }: UploadGPXProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError('Please select a GPX file')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.uploadGPX(file)

      setSuccess(
        `${response.activity.name} uploaded! ${response.activity.distance_km} km, ${response.activity.elevation_gain_m}m gain`
      )

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete()
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload GPX file')
    } finally {
      setUploading(false)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="w-full">
      {/* Admin Authentication */}
      <AdminAuth
        isAuthenticated={isAuthenticated}
        onAuthenticated={() => setIsAuthenticated(true)}
      />

      {/* Upload UI - only shown when authenticated */}
      {isAuthenticated && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <button
            onClick={handleButtonClick}
            disabled={uploading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors text-lg"
          >
            {uploading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Uploading...
              </span>
            ) : (
              '+ Upload GPX Activity'
            )}
          </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

          {success && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-medium">{success}</p>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 text-center">
            Upload GPX files from your Garmin watch or phone
          </p>
        </>
      )}
    </div>
  )
}
