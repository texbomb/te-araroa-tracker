export interface Activity {
  id: number
  garmin_activity_id: number
  date: string
  start_time?: string
  end_time?: string
  distance_km?: number
  elevation_gain_m?: number
  duration_seconds?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  calories?: number
  route_polyline?: string
  raw_gps_data?: any
  synced_at?: string
  created_at?: string
}

export interface Photo {
  id: number
  activity_id?: number
  cloudinary_id: string
  cloudinary_url: string
  thumbnail_url?: string
  latitude?: number
  longitude?: number
  caption?: string
  taken_at?: string
  uploaded_at?: string
}

export interface JournalEntry {
  id: number
  activity_id?: number
  date: string
  content: string
  created_at?: string
  updated_at?: string
}

export interface PlannedRoute {
  id: number
  section_name?: string
  section_order?: number
  route_polyline: string
  distance_km?: number
  description?: string
  created_at?: string
}

export interface Waypoint {
  id: number
  name: string
  type?: string
  latitude: number
  longitude: number
  description?: string
  created_at?: string
}

export interface StatsResponse {
  total_distance_km: number
  total_elevation_m: number
  total_days: number
  avg_distance_per_day: number
  longest_day_km: number
  highest_elevation_day_m: number
}
