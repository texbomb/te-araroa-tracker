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
