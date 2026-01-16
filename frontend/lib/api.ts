const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export const api = {
  // Garmin sync
  async syncGarmin() {
    const response = await fetch(`${API_BASE_URL}/api/garmin/sync`, {
      method: 'POST',
    })
    if (!response.ok) throw new Error('Failed to sync with Garmin')
    return response.json()
  },

  async getGarminStatus() {
    const response = await fetch(`${API_BASE_URL}/api/garmin/status`)
    if (!response.ok) throw new Error('Failed to get Garmin status')
    return response.json()
  },

  // Activities
  async getActivities(startDate?: string, endDate?: string, bustCache?: boolean) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await fetch(`${API_BASE_URL}/api/activities?${params}`, {
      // Bypass cache when data has just changed, use cache for normal loads
      cache: bustCache ? 'no-store' : 'default'
    })
    if (!response.ok) throw new Error('Failed to fetch activities')
    return response.json()
  },

  async getActivity(id: number) {
    const response = await fetch(`${API_BASE_URL}/api/activities/${id}`)
    if (!response.ok) throw new Error('Failed to fetch activity')
    return response.json()
  },

  async getStats() {
    const response = await fetch(`${API_BASE_URL}/api/activities/stats`)
    if (!response.ok) throw new Error('Failed to fetch stats')
    return response.json()
  },

  // GPX Upload
  async uploadGPX(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/gpx/upload-and-save`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to upload GPX file')
    return response.json()
  },

  // Photos
  async uploadPhoto(formData: FormData) {
    const response = await fetch(`${API_BASE_URL}/api/photos/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to upload photo')
    return response.json()
  },

  async getPhotos(activityId?: number) {
    const params = activityId ? `?activity_id=${activityId}` : ''
    const response = await fetch(`${API_BASE_URL}/api/photos${params}`)
    if (!response.ok) throw new Error('Failed to fetch photos')
    return response.json()
  },

  async getPhotosWithLocation() {
    const response = await fetch(`${API_BASE_URL}/api/photos/by-location`)
    if (!response.ok) throw new Error('Failed to fetch photos with location')
    return response.json()
  },

  async getPhoto(photoId: number) {
    const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}`)
    if (!response.ok) throw new Error('Failed to fetch photo')
    return response.json()
  },

  async deletePhoto(photoId: number) {
    const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete photo')
    return response.json()
  },

  async updatePhoto(photoId: number, caption?: string, activityId?: number) {
    const formData = new FormData()
    if (caption !== undefined) formData.append('caption', caption)
    if (activityId !== undefined) formData.append('activity_id', activityId.toString())

    const response = await fetch(`${API_BASE_URL}/api/photos/${photoId}`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to update photo')
    return response.json()
  },

  // Journal
  async createOrUpdateJournal(date: string, content: string) {
    const response = await fetch(`${API_BASE_URL}/api/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, content }),
    })
    if (!response.ok) throw new Error('Failed to save journal entry')
    return response.json()
  },

  async getJournalEntries() {
    const response = await fetch(`${API_BASE_URL}/api/journal`)
    if (!response.ok) throw new Error('Failed to fetch journal entries')
    return response.json()
  },

  // Planned Route
  async getPlannedRoute() {
    const response = await fetch(`${API_BASE_URL}/api/planned-route`)
    if (!response.ok) throw new Error('Failed to fetch planned route')
    return response.json()
  },

  async uploadPlannedRouteGPX(file: File, sectionName?: string, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (sectionName) formData.append('section_name', sectionName)
    if (description) formData.append('description', description)

    const response = await fetch(`${API_BASE_URL}/api/planned-route/upload-gpx`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to upload planned route')
    return response.json()
  },

  async getProgress() {
    const response = await fetch(`${API_BASE_URL}/api/planned-route/progress`)
    if (!response.ok) throw new Error('Failed to fetch progress')
    return response.json()
  },

  async clearPlannedRoute() {
    const response = await fetch(`${API_BASE_URL}/api/planned-route/all`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to clear planned route')
    return response.json()
  },
}
