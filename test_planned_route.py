import polyline
import gpxpy

# Load and process the GPX file exactly like the backend does
with open('frontend/public/te-araroa-geraldine-bluff.gpx', 'r') as f:
    gpx = gpxpy.parse(f)

all_points = []
for track in gpx.tracks:
    for segment in track.segments:
        for point in segment.points:
            all_points.append((point.latitude, point.longitude))

print(f"Total points: {len(all_points)}")
print(f"First 5 points: {all_points[:5]}")
print(f"Last 5 points: {all_points[-5:]}")

# Encode with precision 5 (like backend)
encoded = polyline.encode(all_points, 5)
print(f"\nEncoded length: {len(encoded)} characters")
print(f"First 50 chars: {encoded[:50]}")

# Test decode
decoded = polyline.decode(encoded, 5)
print(f"\nDecoded points: {len(decoded)}")
print(f"First decoded: {decoded[0]}")
print(f"Last decoded: {decoded[-1]}")

# Check bounds
lats = [p[0] for p in all_points]
lons = [p[1] for p in all_points]
print(f"\nBounds:")
print(f"  Latitude: {min(lats):.4f} to {max(lats):.4f}")
print(f"  Longitude: {min(lons):.4f} to {max(lons):.4f}")
