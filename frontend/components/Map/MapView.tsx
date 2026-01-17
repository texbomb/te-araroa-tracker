'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { api } from '@/lib/api'
import {
  segmentRouteByElevation,
  calculateActivityOffset,
  createSegmentFeatureCollection,
} from '@/lib/mapUtils'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface Activity {
  id: number
  name: string
  source: string
  date: string
  distance_km: number
  elevation_gain_m: number
  duration_seconds: number
  raw_gps_data: Array<{ lat: number; lon: number; elevation: number; time: string }>
}

interface MapViewProps {
  selectedActivityId?: number | null
  onActivitySelect?: (activityId: number | null) => void
}

interface DebugInfo {
  plannedRouteCount: number
  plannedRoutePoints: number
  error: string | null
}

export default function MapView({ selectedActivityId, onActivitySelect }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const activitiesRef = useRef<Activity[]>([])
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ plannedRouteCount: 0, plannedRoutePoints: 0, error: null })

  useEffect(() => {
    if (map.current || !mapContainer.current) return // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12', // Outdoor style perfect for hiking
      center: [170.5, -44.5], // Center of South Island, NZ
      zoom: 5.5,
    })

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const mapInstance = map.current

    // Load activities and display them on the map
    const loadActivities = async () => {
      if (!mapInstance) return

      try {
        // Add Te Araroa Trail overlay (South Island)
        // Trail data source: https://www.teararoa.org.nz/
        // You can add the official trail GPX/GeoJSON to public folder and load it
        try {
          // Attempt to load trail data from public folder
          const trailResponse = await fetch('/te-araroa-south-island.geojson')

          if (trailResponse.ok) {
            const trailData = await trailResponse.json()

            mapInstance.addSource('te-araroa-trail', {
              type: 'geojson',
              data: trailData
            })

            mapInstance.addLayer({
              id: 'te-araroa-trail-line',
              type: 'line',
              source: 'te-araroa-trail',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#fb923c', // Orange color for the official trail
                'line-width': 3,
                'line-opacity': 0.6,
                'line-dasharray': [2, 2] // Dashed line to distinguish from actual hiking routes
              },
            })
            console.log('Te Araroa trail overlay loaded')
          }
        } catch (trailError) {
          console.log('Te Araroa trail overlay not available - add te-araroa-south-island.geojson to public folder')
        }

        // Load planned route from API
        let plannedRouteCoordinates: [number, number][] = []
        try {
          const plannedRoutes = await api.getPlannedRoute()
          console.log('Planned routes received:', plannedRoutes?.length)
          if (plannedRoutes && plannedRoutes.length > 0) {
            // Decode polylines and combine all sections
            const polyline = require('@mapbox/polyline')

            plannedRoutes.forEach((route: any) => {
              console.log('Decoding route polyline, length:', route.route_polyline?.length)
              const decoded = polyline.decode(route.route_polyline, 5)
              console.log('Decoded points:', decoded.length)
              // Polyline returns [lat, lon], need to swap to [lon, lat] for GeoJSON
              const coords = decoded.map((point: [number, number]) => [point[1], point[0]])
              plannedRouteCoordinates.push(...coords)
            })

            if (plannedRouteCoordinates.length > 0) {
              mapInstance.addSource('planned-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {
                    name: 'Planned Route'
                  },
                  geometry: {
                    type: 'LineString',
                    coordinates: plannedRouteCoordinates,
                  },
                },
              })

              // Add dashed line for planned route
              mapInstance.addLayer({
                id: 'planned-route-line',
                type: 'line',
                source: 'planned-route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': '#8b5cf6', // Purple color for planned route
                  'line-width': 3,
                  'line-opacity': 0.5,
                  'line-dasharray': [4, 2] // Dashed line pattern
                },
              })
              console.log('Planned route loaded successfully', plannedRouteCoordinates.length, 'coordinates')
              setDebugInfo({ plannedRouteCount: plannedRoutes.length, plannedRoutePoints: plannedRouteCoordinates.length, error: null })
            }
          } else {
            setDebugInfo({ plannedRouteCount: 0, plannedRoutePoints: 0, error: 'No routes returned from API' })
          }
        } catch (routeError) {
          console.error('Error loading planned route:', routeError)
          setDebugInfo({ plannedRouteCount: 0, plannedRoutePoints: 0, error: String(routeError) })
        }

        const activities: Activity[] = await api.getActivities()
        activitiesRef.current = activities

        if (activities.length === 0) {
          console.log('No activities to display')
          return
        }

        // Create bounds to fit all activities
        const bounds = new mapboxgl.LngLatBounds()

        activities.forEach((activity, index) => {
          const isSelected = activity.id === selectedActivityId
          if (!activity.raw_gps_data || activity.raw_gps_data.length === 0) {
            return
          }

          // Convert GPS data to GeoJSON
          // Handle both 'lon' and 'lng' for backwards compatibility
          const coordinates = activity.raw_gps_data.map((point: any) => [
            point.lon ?? point.lng,
            point.lat
          ])

          // Add to bounds
          coordinates.forEach(coord => bounds.extend(coord as [number, number]))

          // Calculate offset for overlapping routes
          const offsetPixels = calculateActivityOffset(index, activities.length)

          // Segment route by elevation changes
          const segments = segmentRouteByElevation(
            activity.raw_gps_data,
            activity.id,
            5 // 5-meter elevation threshold
          )

          // If no segments (route too short), create a simple flat segment
          const routeSegments = segments.length > 0 ? segments : [{
            type: 'Feature' as const,
            properties: {
              activityId: activity.id,
              segmentIndex: 0,
              elevationChange: 'flat' as const,
              elevationDelta: 0,
              distance: 0,
            },
            geometry: {
              type: 'LineString' as const,
              coordinates: coordinates as [number, number][],
            },
          }]

          // Add source for segmented route
          mapInstance.addSource(`activity-segments-${activity.id}`, {
            type: 'geojson',
            data: createSegmentFeatureCollection(routeSegments),
          })

          // Layer 1: Black outline for the route
          mapInstance.addLayer({
            id: `activity-outline-${activity.id}`,
            type: 'line',
            source: `activity-segments-${activity.id}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#000000',
              'line-width': 7,
              'line-opacity': 0.6,
              'line-offset': offsetPixels,
            },
          })

          // Layer 2: Colored line based on elevation change
          mapInstance.addLayer({
            id: `activity-line-${activity.id}`,
            type: 'line',
            source: `activity-segments-${activity.id}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': [
                'match',
                ['get', 'elevationChange'],
                'ascending',
                '#10b981', // Green for ascending
                'descending',
                '#ef4444', // Red for descending
                'flat',
                '#6b7280', // Gray for flat
                '#6b7280', // Default gray
              ],
              'line-width': 4,
              'line-opacity': 0.9,
              'line-offset': offsetPixels,
            },
          })

          // Layer 3: Directional arrows along the route
          mapInstance.addLayer({
            id: `activity-arrows-${activity.id}`,
            type: 'symbol',
            source: `activity-segments-${activity.id}`,
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 200,  // At zoom 5, 200px spacing (fewer arrows)
                10, 120, // At zoom 10, 120px spacing
                15, 80,  // At zoom 15, 80px spacing (more arrows)
              ],
              'icon-image': 'arrow-chevron',
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 0.3,  // Small at low zoom
                10, 0.5, // Medium at mid zoom
                15, 0.7, // Larger at high zoom
              ],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-opacity': 0.8,
            },
          })

          // Make the route clickable (on the line layer)
          mapInstance.on('click', `activity-line-${activity.id}`, () => {
            if (onActivitySelect) {
              onActivitySelect(activity.id)
            }
          })

          // Change cursor on hover
          mapInstance.on('mouseenter', `activity-line-${activity.id}`, () => {
            mapInstance.getCanvas().style.cursor = 'pointer'
          })

          mapInstance.on('mouseleave', `activity-line-${activity.id}`, () => {
            mapInstance.getCanvas().style.cursor = ''
          })

          // Add start marker
          const startPoint = activity.raw_gps_data[0]
          new mapboxgl.Marker({ color: '#059669' })
            .setLngLat([startPoint.lon, startPoint.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(
                `<div>
                  <h3 class="font-bold">${activity.name}</h3>
                  <p class="text-sm">Start: ${new Date(activity.date).toLocaleDateString()}</p>
                  <p class="text-sm">${activity.distance_km} km, ${activity.elevation_gain_m}m gain</p>
                </div>`
              )
            )
            .addTo(mapInstance)

          // Add end marker for latest activity (first in array since sorted by date desc)
          if (index === 0) {
            const endPoint = activity.raw_gps_data[activity.raw_gps_data.length - 1]

            // Create a custom current position marker with your custom image
            const currentLocationEl = document.createElement('div')
            currentLocationEl.className = 'current-location-marker'
            currentLocationEl.innerHTML = `
              <div style="
                width: 60px;
                height: 70px;
                background-image: url('/custom-marker.png');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                cursor: pointer;
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
                animation: bounce 2s ease-in-out infinite;
              "></div>
            `

            // Add bounce animation
            const style = document.createElement('style')
            style.textContent = `
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
              }
            `
            document.head.appendChild(style)

            new mapboxgl.Marker({ element: currentLocationEl, anchor: 'bottom' })
              .setLngLat([endPoint.lon, endPoint.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(
                  `<div style="padding: 8px;">
                    <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">📍 Current Position</h3>
                    <p style="font-size: 14px; color: #666;">${activity.name}</p>
                    <p style="font-size: 12px; color: #999; margin-top: 4px;">${new Date(activity.date).toLocaleDateString()}</p>
                  </div>`
                )
              )
              .addTo(mapInstance)
          }
        })

        // Add planned route coordinates to bounds
        if (plannedRouteCoordinates.length > 0) {
          plannedRouteCoordinates.forEach(coord => bounds.extend(coord))
          console.log('Added planned route to map bounds')
        }

        // Fit map to show all activities and planned route
        if (!bounds.isEmpty()) {
          mapInstance.fitBounds(bounds, {
            padding: 50,
            maxZoom: 13,
          })
        }

        console.log(`Displayed ${activities.length} activities on map`)
      } catch (error) {
        console.error('Failed to load activities:', error)
      }
    }

    // Load photos and display them as markers
    const loadPhotoMarkers = async () => {
      if (!mapInstance) return

      try {
        const photos = await api.getPhotosWithLocation()

        if (photos.length === 0) {
          console.log('No geotagged photos to display')
          return
        }

        photos.forEach((photo: any) => {
          // Create custom photo marker
          const photoMarkerEl = document.createElement('div')
          photoMarkerEl.className = 'photo-marker'
          photoMarkerEl.innerHTML = `
            <div style="
              width: 42px;
              height: 42px;
              border-radius: 50%;
              background: white;
              border: 3px solid #8b5cf6;
              background-image: url('${photo.thumbnail_url}');
              background-size: cover;
              background-position: center;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              transition: transform 0.2s;
            "></div>
          `

          // Add hover effect
          photoMarkerEl.addEventListener('mouseenter', () => {
            const div = photoMarkerEl.querySelector('div') as HTMLElement
            if (div) div.style.transform = 'scale(1.1)'
          })
          photoMarkerEl.addEventListener('mouseleave', () => {
            const div = photoMarkerEl.querySelector('div') as HTMLElement
            if (div) div.style.transform = 'scale(1)'
          })

          // Create popup with photo preview
          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; max-width: 220px;">
              <img
                src="${photo.thumbnail_url}"
                style="width: 100%; height: auto; margin-bottom: 8px; border-radius: 4px;"
                alt="${photo.caption || 'Photo'}"
              />
              ${photo.caption ? `<p style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${photo.caption}</p>` : ''}
              <p style="font-size: 12px; color: #666;">
                📸 ${photo.date_taken ? new Date(photo.date_taken).toLocaleDateString() : 'Unknown date'}
              </p>
            </div>
          `)

          new mapboxgl.Marker({ element: photoMarkerEl, anchor: 'center' })
            .setLngLat([photo.longitude, photo.latitude])
            .setPopup(popup)
            .addTo(mapInstance)
        })

        console.log(`Displayed ${photos.length} photo markers on map`)
      } catch (error) {
        console.error('Failed to load photo markers:', error)
      }
    }

    mapInstance.on('load', () => {
      // Load arrow icon for directional indicators
      mapInstance.loadImage('/arrow-chevron.svg', (error, image) => {
        if (error) {
          console.error('Failed to load arrow icon:', error)
          return
        }
        if (image && !mapInstance.hasImage('arrow-chevron')) {
          mapInstance.addImage('arrow-chevron', image)
        }
      })

      loadActivities()
      loadPhotoMarkers()
    })

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Zoom to selected activity when selection changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return

    const mapInstance = map.current
    const activities = activitiesRef.current

    // Zoom to selected activity if one is selected
    if (selectedActivityId) {
      const selectedActivity = activities.find(a => a.id === selectedActivityId)
      if (selectedActivity && selectedActivity.raw_gps_data.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        selectedActivity.raw_gps_data.forEach((point: any) => {
          // Handle both 'lon' and 'lng' for backwards compatibility
          bounds.extend([point.lon ?? point.lng, point.lat])
        })
        mapInstance.fitBounds(bounds, {
          padding: 50,
          maxZoom: 13,
          duration: 1000
        })
      }
    }
  }, [selectedActivityId])

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {/* Debug Panel */}
      <div className="absolute top-2 right-2 bg-white p-3 rounded shadow-lg text-xs z-10 max-w-xs">
        <div className="font-bold mb-1">Planned Route Debug</div>
        <div>Routes: {debugInfo.plannedRouteCount}</div>
        <div>Points: {debugInfo.plannedRoutePoints}</div>
        {debugInfo.error && (
          <div className="text-red-600 mt-1">Error: {debugInfo.error}</div>
        )}
        {debugInfo.plannedRoutePoints > 0 && (
          <div className="text-green-600 mt-1">✓ Route loaded!</div>
        )}
      </div>
    </div>
  )
}
