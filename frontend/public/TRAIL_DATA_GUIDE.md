# Te Araroa Trail Data Guide

## Adding the Official Trail Overlay

The map is configured to display the official Te Araroa South Island trail route as an orange dashed line overlay.

### Steps to Add Trail Data:

1. **Obtain Trail Data**
   - Download the official Te Araroa South Island trail GPX from: https://www.teararoa.org.nz/
   - Or use a community-sourced trail route from platforms like:
     - https://www.alltrails.com/
     - https://www.gaiagps.com/
     - https://www.hikingproject.com/

2. **Convert GPX to GeoJSON** (if needed)
   - Use online converter: https://mapbox.github.io/togeojson/
   - Or use command line tool:
     ```bash
     npm install -g @mapbox/togeojson
     togeojson te-araroa-south-island.gpx > te-araroa-south-island.geojson
     ```

3. **Add File to Project**
   - Place the `te-araroa-south-island.geojson` file in the `frontend/public/` folder
   - The map will automatically detect and display it

4. **Expected GeoJSON Format**
   ```json
   {
     "type": "FeatureCollection",
     "features": [
       {
         "type": "Feature",
         "geometry": {
           "type": "LineString",
           "coordinates": [
             [longitude, latitude],
             [longitude, latitude],
             ...
           ]
         },
         "properties": {
           "name": "Te Araroa South Island Trail"
         }
       }
     ]
   }
   ```

### Trail Display Style

- **Color**: Orange (#fb923c)
- **Width**: 3px
- **Opacity**: 60%
- **Style**: Dashed line (to distinguish from actual hiking routes)

### Notes

- The trail overlay will appear beneath your actual hiking routes (green lines)
- If the file is not present, the map will continue to work normally without the overlay
- You can update the trail data at any time by replacing the file
- For deployment, ensure the file is committed to the repository or uploaded to your hosting platform
