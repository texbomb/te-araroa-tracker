#!/usr/bin/env python3
"""
Convert Te Araroa GPX trail to GeoJSON for map overlay
Using XML parsing to handle namespaced GPX
"""

import xml.etree.ElementTree as ET
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
gpx_path = os.path.join(script_dir, 'frontend', 'public', 'TeAraroaTrail_2025-26_South_Island.gpx')

# Parse the GPX file
tree = ET.parse(gpx_path)
root = tree.getroot()

# Define namespace
ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}

# Extract track points
features = []

for trk in root.findall('gpx:trk', ns):
    track_name = trk.find('gpx:name', ns)
    track_desc = trk.find('gpx:desc', ns)

    for trkseg in trk.findall('gpx:trkseg', ns):
        coordinates = []

        for trkpt in trkseg.findall('gpx:trkpt', ns):
            lat = float(trkpt.get('lat'))
            lon = float(trkpt.get('lon'))
            # GeoJSON uses [longitude, latitude] order
            coordinates.append([lon, lat])

        if coordinates:
            # Create a LineString feature
            feature = {
                "type": "Feature",
                "properties": {
                    "name": track_name.text if track_name is not None else "Te Araroa South Island Trail",
                    "description": track_desc.text if track_desc is not None else ""
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
