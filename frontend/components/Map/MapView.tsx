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

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

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
    mapInstance.on('load', async () => {
      try {
        const activities: Activity[] = await api.getActivities()

        if (activities.length === 0) {
          console.log('No activities to display')
          return
        }

        // Create bounds to fit all activities
        const bounds = new mapboxgl.LngLatBounds()

        activities.forEach((activity, index) => {
          if (!activity.raw_gps_data || activity.raw_gps_data.length === 0) {
            return
          }

          // Convert GPS data to GeoJSON
          const coordinates = activity.raw_gps_data.map(point => [point.lon, point.lat])

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
              'line-color': index === activities.length - 1 ? '#10b981' : '#059669', // Latest activity in lighter green
              'line-width': 4,
              'line-opacity': 0.8,
            },
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

          // Add end marker for latest activity
          if (index === activities.length - 1) {
            const endPoint = activity.raw_gps_data[activity.raw_gps_data.length - 1]
            new mapboxgl.Marker({ color: '#10b981' })
              .setLngLat([endPoint.lon, endPoint.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(
                  `<div>
                    <h3 class="font-bold">Current Position</h3>
                    <p class="text-sm">${activity.name}</p>
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
    })

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}
