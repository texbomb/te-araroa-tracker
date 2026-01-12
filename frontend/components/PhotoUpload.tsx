'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import AdminAuth from './AdminAuth'
import Image from 'next/image'

interface PhotoUploadProps {
  activityId?: number
  onUploadComplete?: () => void
}

interface PhotoPreview {
  file: File
  url: string
}

export default function PhotoUpload({ activityId, onUploadComplete }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [previews, setPreviews] = useState<PhotoPreview[]>([])
  const [caption, setCaption] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError(null)
    setSuccess(null)

    const newPreviews: PhotoPreview[] = []
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic']
    const maxSize = 10 * 1024 * 1024 // 10MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Allowed: JPEG, PNG, HEIC`)
        continue
      }

      // Validate file size
      if (file.size > maxSize) {
        setError(`File too large: ${file.name}. Maximum size: 10MB`)
        continue
      }

      // Create preview URL
      const url = URL.createObjectURL(file)
      newPreviews.push({ file, url })
    }

    setPreviews(newPreviews)
  }

  const handleUpload = async () => {
    if (previews.length === 0) {
      setError('Please select at least one photo')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      let uploadedCount = 0
      let failedCount = 0

      // Upload each photo
      for (const preview of previews) {
        try {
          const formData = new FormData()
          formData.append('file', preview.file)
          if (caption) formData.append('caption', caption)
          if (activityId) formData.append('activity_id', activityId.toString())

          await api.uploadPhoto(formData)
          uploadedCount++
        } catch (err) {
          failedCount++
          console.error(`Failed to upload ${preview.file.name}:`, err)
        }
      }

      // Clean up preview URLs
      previews.forEach(p => URL.revokeObjectURL(p.url))
      setPreviews([])
      setCaption('')

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Set success message
      if (uploadedCount > 0) {
        setSuccess(
          `Successfully uploaded ${uploadedCount} photo${uploadedCount > 1 ? 's' : ''}` +
          (failedCount > 0 ? `. ${failedCount} failed.` : '')
        )

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete()
        }

        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError('Failed to upload photos')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photos')
      // Clean up preview URLs on error
      previews.forEach(p => URL.revokeObjectURL(p.url))
    } finally {
      setUploading(false)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const removePreview = (index: number) => {
    const newPreviews = [...previews]
    URL.revokeObjectURL(newPreviews[index].url)
    newPreviews.splice(index, 1)
    setPreviews(newPreviews)
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
            accept="image/jpeg,image/png,image/heic"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {/* Photo Previews */}
          {previews.length > 0 && (
            <div className="mb-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg shadow-sm"
                    />
                    <button
                      onClick={() => removePreview(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="text-xs text-gray-600 mt-1 truncate">{preview.file.name}</p>
                  </div>
                ))}
              </div>

              {/* Caption Input */}
              <div>
                <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (optional)
                </label>
                <input
                  id="caption"
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption for all photos..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={uploading}
                />
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
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
                    Uploading {previews.length} photo{previews.length > 1 ? 's' : ''}...
                  </span>
                ) : (
                  `Upload ${previews.length} Photo${previews.length > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}

          {/* Select Photos Button */}
          {previews.length === 0 && (
            <button
              onClick={handleButtonClick}
              disabled={uploading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors text-lg"
            >
              + Select Photos
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-medium">{success}</p>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 text-center">
            Upload photos from the trail. GPS coordinates will be extracted automatically.
          </p>
        </>
      )}
    </div>
  )
}
