Diagnose compression quality issues. Steps:

1. Find the most recent compressed file in `compressed/` directory
2. Find its corresponding source in `uploads/`
3. Probe both files with ffprobe:
   ```bash
   /opt/homebrew/bin/ffprobe -v quiet -print_format json -show_format -show_streams "INPUT"
   /opt/homebrew/bin/ffprobe -v quiet -print_format json -show_format -show_streams "OUTPUT"
   ```
4. Compare:
   - File sizes (was there actual compression?)
   - Video bitrates (input vs output)
   - Audio bitrates
   - Resolution (was it scaled?)
   - Codec used
   - Duration (should match exactly)
5. Check `lib/presets.js` for the preset that was used
6. Check `lib/ffmpeg.js` for bitrate capping logic
7. Report findings:
   - Compression ratio achieved
   - Whether bitrate cap was applied
   - Quality assessment
   - Specific recommendations to improve results
8. If issues found, suggest code changes to `lib/ffmpeg.js` or `lib/presets.js`
