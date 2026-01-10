'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { api } from '@/lib/api'

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

export default function MapView({ selectedActivityId, onActivitySelect }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const activitiesRef = useRef<Activity[]>([])

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
        try {
          const plannedRoutes = await api.getPlannedRoute()
          if (plannedRoutes && plannedRoutes.length > 0) {
            // Decode polylines and combine all sections
            const polyline = require('@mapbox/polyline')
            const allCoordinates: [number, number][] = []

            plannedRoutes.forEach((route: any) => {
              const decoded = polyline.decode(route.route_polyline)
              // Polyline returns [lat, lon], need to swap to [lon, lat] for GeoJSON
              const coords = decoded.map((point: [number, number]) => [point[1], point[0]])
              allCoordinates.push(...coords)
            })

            if (allCoordinates.length > 0) {
              mapInstance.addSource('planned-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {
                    name: 'Planned Route'
                  },
                  geometry: {
                    type: 'LineString',
                    coordinates: allCoordinates,
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
              console.log('Planned route loaded successfully')
            }
          }
        } catch (routeError) {
          console.log('No planned route uploaded yet')
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

          // Add source for this activity
          mapInstance.addSource(`activity-${activity.id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {
                name: activity.name,
                distance: activity.distance_km,
                elevation: activity.elevation_gain_m,
                date: activity.date,
              },
              geometry: {
                type: 'LineString',
                coordinates,
              },
            },
          })

          // Add line layer for the route
          mapInstance.addLayer({
            id: `activity-line-${activity.id}`,
            type: 'line',
            source: `activity-${activity.id}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isSelected
                ? '#f59e0b' // Orange for selected
                : index === activities.length - 1
                ? '#10b981' // Light green for latest
                : '#059669', // Dark green for others
              'line-width': isSelected ? 6 : 4,
              'line-opacity': isSelected ? 1 : 0.8,
            },
          })

          // Make the route clickable
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

            // Create a custom current position marker element
            const currentLocationEl = document.createElement('div')
            currentLocationEl.className = 'current-location-marker'
            currentLocationEl.innerHTML = `
              <div style="
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                animation: pulse 2s infinite;
              ">
                📍
              </div>
            `

            // Add pulsing animation
            const style = document.createElement('style')
            style.textContent = `
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.9; }
              }
            `
            document.head.appendChild(style)

            new mapboxgl.Marker({ element: currentLocationEl })
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

        // Fit map to show all activities
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

    mapInstance.on('load', loadActivities)

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update activity styling when selection changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return

    const mapInstance = map.current
    const activities = activitiesRef.current

    activities.forEach((activity, index) => {
      const layerId = `activity-line-${activity.id}`
      if (!mapInstance.getLayer(layerId)) return

      const isSelected = activity.id === selectedActivityId
      const isLatest = index === activities.length - 1

      mapInstance.setPaintProperty(
        layerId,
        'line-color',
        isSelected
          ? '#f59e0b' // Orange for selected
          : isLatest
          ? '#10b981' // Light green for latest
          : '#059669' // Dark green for others
      )

      mapInstance.setPaintProperty(layerId, 'line-width', isSelected ? 6 : 4)
      mapInstance.setPaintProperty(layerId, 'line-opacity', isSelected ? 1 : 0.8)
    })

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
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}
