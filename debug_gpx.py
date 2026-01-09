import gpxpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
gpx_path = os.path.join(script_dir, 'frontend', 'public', 'TeAraroaTrail_2025-26_South_Island.gpx')

with open(gpx_path, 'r', encoding='utf-8') as gpx_file:
    gpx = gpxpy.parse(gpx_file)

print(f"Tracks: {len(gpx.tracks)}")
print(f"Routes: {len(gpx.routes)}")
print(f"Waypoints: {len(gpx.waypoints)}")

if gpx.tracks:
    print(f"\nFirst track has {len(gpx.tracks[0].segments)} segments")
    if gpx.tracks[0].segments:
        print(f"First segment has {len(gpx.tracks[0].segments[0].points)} points")
