Quick compress workflow. Steps:

1. Check if the server is running: `lsof -i :3000`
2. If not running, start it: `cd "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR" && node server.js &`
3. Ask the user for:
   - Input file path (or use the most recent file in `uploads/`)
   - Preset: aggressive, balanced, gentle, or custom
   - Resolution: original, 1080p, 720p, 480p
4. Run compression via the API:
   ```bash
   curl -X POST http://localhost:3000/api/compress \
     -H "Content-Type: application/json" \
     -d '{"file": "FILENAME", "preset": "PRESET", "scale": "SCALE"}'
   ```
5. Monitor progress via WebSocket or poll status
6. Report results: output file path, size reduction percentage, compression ratio
7. If output is larger than input, delegate to the compression-diagnostics agent
