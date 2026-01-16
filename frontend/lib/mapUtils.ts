/**
 * Map utility functions for route visualization
 * Handles elevation-based route segmentation and directional arrows
 */

export interface GPSPoint {
  lat: number
  lon?: number
  lng?: number
  elevation: number
  time: string
}

export interface RouteSegment {
  type: 'Feature'
  properties: {
    activityId: number
    segmentIndex: number
    elevationChange: 'ascending' | 'descending' | 'flat'
    elevationDelta: number
    distance: number
  }
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
}

/**
 * Calculate Haversine distance between two GPS points in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Segment a route into ascending, descending, and flat sections based on elevation changes
 *
 * @param gpsPoints - Array of GPS points with lat, lon, and elevation
 * @param activityId - Activity ID for the route
 * @param elevationThreshold - Minimum elevation change in meters to trigger a new segment (default: 5m)
 * @returns Array of GeoJSON features representing route segments
 */
export function segmentRouteByElevation(
  gpsPoints: GPSPoint[],
  activityId: number,
  elevationThreshold: number = 5
): RouteSegment[] {
  if (!gpsPoints || gpsPoints.length < 2) {
    return []
  }

  const segments: RouteSegment[] = []
  let currentSegmentPoints: [number, number][] = []
  let currentElevationDelta = 0
  let currentDistance = 0
  let currentElevationChange: 'ascending' | 'descending' | 'flat' = 'flat'
  let segmentIndex = 0

  // Helper to get longitude (handle both 'lon' and 'lng')
  const getLon = (point: GPSPoint): number => point.lon ?? point.lng ?? 0

  // Start first segment with first point
  currentSegmentPoints.push([getLon(gpsPoints[0]), gpsPoints[0].lat])
  let segmentStartElevation = gpsPoints[0].elevation

  for (let i = 1; i < gpsPoints.length; i++) {
    const prevPoint = gpsPoints[i - 1]
    const currentPoint = gpsPoints[i]

    // Calculate elevation change
    const elevationChange = currentPoint.elevation - prevPoint.elevation
    currentElevationDelta += elevationChange

    // Calculate distance for this segment
    const pointDistance = calculateDistance(
      prevPoint.lat,
      getLon(prevPoint),
      currentPoint.lat,
      getLon(currentPoint)
    )
    currentDistance += pointDistance

    // Determine if we should create a new segment
    const shouldSegment = Math.abs(currentElevationDelta) >= elevationThreshold

    if (shouldSegment) {
      // Determine elevation change type
      const newElevationChange: 'ascending' | 'descending' | 'flat' =
        currentElevationDelta > elevationThreshold
          ? 'ascending'
          : currentElevationDelta < -elevationThreshold
          ? 'descending'
          : 'flat'

      // Check if elevation change type has changed
      if (
        newElevationChange !== currentElevationChange &&
        currentSegmentPoints.length > 1
      ) {
        // Save current segment
        segments.push({
          type: 'Feature',
          properties: {
            activityId,
            segmentIndex,
            elevationChange: currentElevationChange,
            elevationDelta: parseFloat(currentElevationDelta.toFixed(1)),
            distance: parseFloat(currentDistance.toFixed(1)),
          },
          geometry: {
            type: 'LineString',
            coordinates: currentSegmentPoints,
          },
        })

        // Start new segment with the last point of previous segment
        currentSegmentPoints = [[getLon(prevPoint), prevPoint.lat]]
        currentElevationDelta = elevationChange
        currentDistance = pointDistance
        currentElevationChange = newElevationChange
        segmentStartElevation = prevPoint.elevation
        segmentIndex++
      }
    }

    // Add current point to segment
    currentSegmentPoints.push([getLon(currentPoint), currentPoint.lat])
  }

  // Save final segment
  if (currentSegmentPoints.length > 1) {
    segments.push({
      type: 'Feature',
      properties: {
        activityId,
        segmentIndex,
        elevationChange: currentElevationChange,
        elevationDelta: parseFloat(currentElevationDelta.toFixed(1)),
        distance: parseFloat(currentDistance.toFixed(1)),
      },
      geometry: {
        type: 'LineString',
        coordinates: currentSegmentPoints,
      },
    })
  }

  return segments
}

/**
 * Calculate pixel offset for overlapping routes to display them side-by-side
 *
 * @param activityIndex - Index of the activity in the list (0-based)
 * @param totalActivities - Total number of activities being displayed
 * @param maxOffset - Maximum offset in pixels (default: 3)
 * @returns Offset value in pixels
 */
export function calculateActivityOffset(
  activityIndex: number,
  totalActivities: number,
  maxOffset: number = 3
): number {
  if (totalActivities <= 1) {
    return 0
  }

  // Distribute offsets evenly from -maxOffset to +maxOffset
  // Example for 3 activities: -3, 0, 3
  // Example for 5 activities: -3, -1.5, 0, 1.5, 3
  const step = (maxOffset * 2) / (totalActivities - 1)
  return -maxOffset + activityIndex * step
}

/**
 * Create a GeoJSON FeatureCollection from route segments
 * Useful for adding to Mapbox as a single source
 *
 * @param segments - Array of route segments
 * @returns GeoJSON FeatureCollection
 */
export function createSegmentFeatureCollection(segments: RouteSegment[]) {
  return {
    type: 'FeatureCollection' as const,
    features: segments,
  }
}
