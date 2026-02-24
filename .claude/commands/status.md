Show project and server status. Check all of the following:

1. **Server Status**:
   ```bash
   lsof -i :3000 2>/dev/null || echo "Server NOT running on port 3000"
   ```

2. **FFmpeg Availability**:
   ```bash
   /opt/homebrew/bin/ffmpeg -version 2>&1 | head -1
   ```

3. **Node.js Version**:
   ```bash
   node --version
   ```

4. **Dependencies**:
   ```bash
   cd "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR" && npm ls --depth=0 2>&1
   ```

5. **Disk Usage**:
   ```bash
   du -sh "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/uploads" "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/compressed" 2>/dev/null
   ```

6. **Pending Files**: Count files in uploads/ and compressed/
   ```bash
   ls -1 "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/uploads/" 2>/dev/null | wc -l
   ls -1 "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/compressed/" 2>/dev/null | wc -l
   ```

7. **ESLint Check**:
   ```bash
   cd "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR" && npx eslint . --quiet 2>&1 | tail -5
   ```

8. **Syntax Validation** (backend):
   ```bash
   node --check "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR/server.js" 2>&1
   ```

Report everything in a clean table format.
