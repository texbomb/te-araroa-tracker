#!/usr/bin/env python3
"""
Convert Te Araroa GPX trail to GeoJSON for map overlay
"""

import gpxpy
import json

# Read the GPX file
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
gpx_path = os.path.join(script_dir, 'frontend', 'public', 'TeAraroaTrail_2025-26_South_Island.gpx')

with open(gpx_path, 'r', encoding='utf-8') as gpx_file:
    gpx = gpxpy.parse(gpx_file)

# Extract track points
features = []

for track in gpx.tracks:
    for segment in track.segments:
        coordinates = []
        for point in segment.points:
            # GeoJSON uses [longitude, latitude] order
            coordinates.append([point.longitude, point.latitude])

        # Create a LineString feature
        feature = {
            "type": "Feature",
            "properties": {
                "name": track.name or "Te Araroa South Island Trail",
                "description": track.description or ""
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            }
        }
        features.append(feature)

# Create GeoJSON FeatureCollection
geojson = {
    "type": "FeatureCollection",
    "features": features
}

# Write to output file
output_path = os.path.join(script_dir, 'frontend', 'public', 'te-araroa-south-island.geojson')
with open(output_path, 'w', encoding='utf-8') as output_file:
    json.dump(geojson, output_file, indent=2)

print(f"Converted successfully!")
print(f"  Features: {len(features)}")
print(f"  Total points: {sum(len(f['geometry']['coordinates']) for f in features)}")
