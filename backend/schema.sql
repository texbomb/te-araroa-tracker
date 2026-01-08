-- Te Araroa Tracker Database Schema
-- Run this in your Supabase SQL editor

-- Activities table - stores daily hiking data from Garmin
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  garmin_activity_id BIGINT UNIQUE NOT NULL,
  date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  distance_km DECIMAL(6, 2),
  elevation_gain_m INTEGER,
  duration_seconds INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  calories INTEGER,
  route_polyline TEXT,
  raw_gps_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_garmin_id ON activities(garmin_activity_id);

-- Photos table - geotagged photos from the trail
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  cloudinary_id VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  thumbnail_url TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  caption TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_activity ON photos(activity_id);
CREATE INDEX IF NOT EXISTS idx_photos_location ON photos(latitude, longitude) WHERE latitude IS NOT NULL;

-- Journal entries - optional text updates
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date DESC);

-- Planned route - Te Araroa trail route
CREATE TABLE IF NOT EXISTS planned_route (
  id SERIAL PRIMARY KEY,
  section_name VARCHAR(255),
  section_order INTEGER,
  route_polyline TEXT NOT NULL,
  distance_km DECIMAL(6, 2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planned_route_order ON planned_route(section_order);

-- Waypoints - towns, huts, landmarks
CREATE TABLE IF NOT EXISTS waypoints (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_location ON waypoints(latitude, longitude);

-- Enable Row Level Security (RLS)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_route ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on activities" ON activities FOR SELECT USING (true);
CREATE POLICY "Allow public read access on photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Allow public read access on journal_entries" ON journal_entries FOR SELECT USING (true);
CREATE POLICY "Allow public read access on planned_route" ON planned_route FOR SELECT USING (true);
CREATE POLICY "Allow public read access on waypoints" ON waypoints FOR SELECT USING (true);

-- Note: Write access will be handled by backend using service key
