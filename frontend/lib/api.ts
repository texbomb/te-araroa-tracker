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
}
