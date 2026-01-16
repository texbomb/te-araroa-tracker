'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface Photo {
  id: number
  filename: string
  caption: string | null
  latitude: number | null
  longitude: number | null
  altitude_m: number | null
  date_taken: string | null
  camera_make: string | null
  camera_model: string | null
  activity_id: number | null
  created_at: string
}

interface PhotoManagementProps {
  onPhotoDeleted?: () => void
}

export default function PhotoManagement({ onPhotoDeleted }: PhotoManagementProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPhoto, setEditingPhoto] = useState<number | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchPhotos()
  }, [])

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const data = await api.getPhotos()
      // Sort by date_taken descending (newest first)
      const sorted = data.sort((a: Photo, b: Photo) => {
        const dateA = a.date_taken ? new Date(a.date_taken).getTime() : 0
        const dateB = b.date_taken ? new Date(b.date_taken).getTime() : 0
        return dateB - dateA
      })
      setPhotos(sorted)
    } catch (error) {
      console.error('Failed to fetch photos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStart = (photo: Photo) => {
    setEditingPhoto(photo.id)
    setEditCaption(photo.caption || '')
  }

  const handleEditSave = async (photoId: number) => {
    try {
      await api.updatePhoto(photoId, editCaption)
      await fetchPhotos()
      setEditingPhoto(null)
      setEditCaption('')
    } catch (error) {
      console.error('Failed to update photo:', error)
      alert('Failed to update photo caption')
    }
  }

  const handleEditCancel = () => {
    setEditingPhoto(null)
    setEditCaption('')
  }

  const handleDeleteConfirm = async (photoId: number) => {
    try {
      await api.deletePhoto(photoId)
      await fetchPhotos()
      setDeleteConfirm(null)
      if (onPhotoDeleted) onPhotoDeleted()
    } catch (error) {
      console.error('Failed to delete photo:', error)
      alert('Failed to delete photo')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date'
    return new Date(dateString).toLocaleDateString('en-NZ', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPhotoUrl = (photoId: number) => {
    return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/photos/${photoId}/file`
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading photos...
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No photos uploaded yet. Upload some photos above!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Photo Image */}
            <div className="aspect-video bg-gray-100 relative">
              <img
                src={getPhotoUrl(photo.id)}
                alt={photo.caption || photo.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* GPS Badge */}
              {photo.latitude && photo.longitude && (
                <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  GPS
                </div>
              )}
            </div>

            {/* Photo Info */}
            <div className="p-4">
              {/* Caption */}
              {editingPhoto === photo.id ? (
                <div className="mb-3">
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Add a caption..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEditSave(photo.id)}
                      className="flex-1 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px]">
                    {photo.caption || <span className="text-gray-400 italic">No caption</span>}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-1 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(photo.date_taken)}
                </div>

                {photo.camera_make && photo.camera_model && (
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {photo.camera_make} {photo.camera_model}
                  </div>
                )}

                {photo.latitude && photo.longitude && (
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}
                  </div>
                )}

                {photo.activity_id && (
                  <div className="flex items-center gap-1 text-purple-600">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Linked to activity #{photo.activity_id}
                  </div>
                )}
              </div>

              {/* Actions */}
              {deleteConfirm === photo.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteConfirm(photo.id)}
                    className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditStart(photo)}
                    className="flex-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(photo.id)}
                    className="flex-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
