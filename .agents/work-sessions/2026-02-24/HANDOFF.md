# Work Session Handoff -- 2026-02-24

## Session Summary

Built the entire Video Compressor application from scratch in a single session.
The app is a local video compression tool with a web UI, leveraging FFmpeg and
Apple Silicon hardware acceleration (VideoToolbox). Also created a comprehensive
skill system and documentation framework.

---

## 1. What Was Built

### Backend (Node.js + Express + WebSocket)

**`server.js`** -- Full Express server with:
- File upload via multer (multipart, up to 20 files, 50GB limit)
- Video probing via ffprobe wrapper
- Video streaming with HTTP range request support
- Thumbnail generation (JPEG, piped from FFmpeg)
- Compression endpoint that builds FFmpeg commands and queues jobs
- Job management (list, cancel)
- Hardware acceleration detection endpoint
- WebSocket server for real-time progress broadcast
- Graceful shutdown handling (SIGINT/SIGTERM)

**`lib/ffmpeg.js`** -- FFmpeg command builder:
- 7 encoder support (h264/hevc VideoToolbox, libx264/libx265, libsvtav1, prores VT/ks)
- 4 quality presets per encoder (max, balanced, small, streaming)
- Smart bitrate capping to prevent output exceeding input size
- Video filter chain (crop + scale)
- Audio codec selection per video codec
- MP4/MOV faststart + metadata tags

**`lib/probe.js`** -- FFprobe wrapper:
- JSON output parsing
- Video/audio stream extraction
- FPS parsing from rational format (e.g., "30000/1001")
- Error handling with descriptive messages

**`lib/hwaccel.js`** -- Hardware acceleration:
- Scans `ffmpeg -encoders` for VideoToolbox support
- Caches result (immutable via Object.freeze)
- Encoder selection function with SW fallback

**`lib/jobQueue.js`** -- Job queue:
- PQueue with concurrency 4 (optimized for M2 Max)
- FFmpeg progress parsing from stderr (time, speed, fps)
- Throttled progress emission (1 event/second)
- Job lifecycle management (queued -> running -> complete/error/cancelled)
- EventEmitter for progress/complete/error events
- Process kill support for cancellation

### Frontend (Vanilla JS + Tailwind CDN + Plyr CDN)

**`public/index.html`** -- Single-page application with:
- Drag-and-drop zone with path input alternative
- File queue with card-based display
- Video preview player (Plyr)
- Compression settings panel (quality, codec, format)
- Trim controls (start/end timecode)
- Crop presets (16:9, 4:3, 1:1, 9:16)
- Resolution selector
- File size estimation display
- Theme toggle (light/system/dark)
- Notification system

**`public/js/app.js`** -- Main orchestrator:
- Central `appState` with files, selectedFileId, activeJobs, hwInfo
- File upload via FormData -> multer
- File-by-path addition (probe-only, no upload)
- File selection with preview loading
- Compress All flow dispatching
- Notification system using DOM SVG creation

**`public/js/compression.js`** -- Settings panel:
- Button group wiring for presets/codecs/formats
- Codec-format compatibility enforcement
- HW acceleration badges and indicators
- Dynamic resolution dropdown creation
- File size estimation engine (HW bitrate-based + SW ratio-based)
- Resolution-aware estimation with pixel ratio adjustment

**`public/js/filemanager.js`** -- File cards:
- Thumbnail rendering with error fallback
- Status badges (uploading, pending, queued, compressing, done, error)
- Per-file resolution dropdown
- Progress bar with percentage overlay, speed, ETA
- Size comparison display (original -> compressed, -X%)
- Error display

**`public/js/progress.js`** -- WebSocket client:
- Auto-connect on init
- Message routing (progress, complete, error, queued)
- Auto-reconnect with exponential backoff (1s -> 30s)
- State updates to appState.activeJobs

**`public/js/player.js`** -- Plyr integration
**`public/js/trim.js`** -- Timecode input, validation, formatting
**`public/js/crop.js`** -- Aspect ratio calculation, even dimensions
**`public/js/dragdrop.js`** -- Drag-and-drop, file input, path input
**`public/js/theme.js`** -- 3-way theme toggle with OS detection

**`public/css/styles.css`** -- Full theme system:
- 150+ CSS custom properties
- Complete dark theme (glassmorphism, violet accents)
- Complete light theme
- All component styles (cards, buttons, badges, progress bars, notifications)
- Plyr theme overrides
- Custom scrollbar styling
- Responsive breakpoints
- Animations (shimmer, pulse, slide-up, gradient-shift)

### Infrastructure

- `package.json` with all dependencies and npm scripts
- `start.command` for macOS double-click launching
- ESLint and Prettier configuration
- `.claude/` directory with settings

---

## 2. Bug Fixes (11 API Mismatches + ESLint)

### API Mismatch Fixes

During development, the frontend and backend fell out of sync multiple times.
A comprehensive HTML-JS selector alignment audit (Task #7) identified and fixed
11 mismatches between DOM element IDs in `index.html` and selectors in JS modules.

Key fixes included:
- Button group container IDs matching between HTML and `wireButtonGroup()` calls
- Data attributes (`data-preset`, `data-codec`, `data-format`, `data-crop`) aligning
- Progress bar element ID format matching between `filemanager.js` and WebSocket messages
- File card click handler wiring matching between `renderFiles()` and `selectFile()`
- Thumbnail URL encoding matching between frontend and backend expectations

### ESLint Fixes

- Converted all `require()` to `import` statements (ES modules)
- Fixed unused variable warnings
- Added proper `catch` clauses (no empty catches)
- Ensured consistent semicolons and quotes via Prettier

---

## 3. Features Added

### Theme Toggle (Light / System / Dark)
- 3-way toggle in the header
- Full CSS custom property system (150+ variables for dark and light)
- localStorage persistence
- OS preference detection via `prefers-color-scheme` media query
- `themed-*` utility classes to override Tailwind inline colors

### Resolution Scaling
- Global resolution dropdown (original, 1080p, 720p, 480p, 360p)
- Per-file resolution dropdown on each file card
- FFmpeg `-vf scale=-2:H` filter integration
- Upscale prevention (options >= source height are disabled)
- Width calculated automatically with even-number guarantee (`-2`)

### File Size Estimation
- HW encoder estimation: `(targetBitrate / 8) * duration`
- SW encoder estimation: `originalSize * compressionRatio`
- Resolution-adjusted via pixel ratio
- Color-coded display (green = savings, orange = increase, gray = neutral)
- Updates reactively when changing any setting

### Per-Video Resolution
- Each file card gets its own resolution dropdown
- Dropdown only shows for files with `pending` or `uploading` status
- Options filtered to prevent upscaling based on each file's probe data
- `file.scale` property stored on the file object

### Smart Bitrate Capping
- Prevents HW encoder targets from exceeding source bitrate
- Preset-specific ratios: balanced 70%, streaming 50%, small 40%
- max preset has no cap (intentional for quality-first use)

### Metadata Preservation
- `-map_metadata 0` flag copies all metadata from input
- `-movflags +faststart+use_metadata_tags` for MP4/MOV containers

---

## 4. Compression Quality Findings

### ProRes Source Files
- ProRes files (typically 60-300 Mbps) compress excellently to H.264/H.265
- Expected reduction: 5-20x when going ProRes -> H.265 balanced
- This is the ideal use case for the compressor

### Already-Compressed H.264 Files
- Files already at H.264 2-8 Mbps show poor compression ratios
- HW encoder with bitrate targeting may INCREASE file size
- Root cause: VideoToolbox target bitrate may exceed source bitrate
- Smart bitrate capping (implemented) mitigates but does not eliminate this
- SW encoders with CRF mode handle this better (adapt to content complexity)

### Key Insight
The compressor works best on:
1. ProRes/raw camera footage (massive reduction)
2. High-bitrate H.264 (> 15 Mbps) to H.265 (good reduction)
3. Any source with resolution downscaling (pixel reduction dominates)

It works poorly on:
1. Already-compressed H.264 at low bitrate (< 5 Mbps)
2. Short clips (< 10s) where fixed overhead dominates
3. Same-codec re-encoding (generational loss, minimal size benefit)

---

## 5. Pending Fixes

### Bitrate Targeting (Partially Fixed)
- Smart bitrate capping is implemented and working
- However, VideoToolbox bitrate targeting is inherently approximate (10-30% variance)
- For exact file size control, SW CRF encoding is recommended
- **Status:** Functional but imprecise for HW encoding

### _COMP Output Naming
- Outputs are named `{original}_COMP.{ext}` in the same directory as source
- If the source is in a read-only directory, compression will fail
- **Needed:** User-configurable output directory option
- **Status:** Works for writable directories; fails for read-only sources

### Metadata Preservation (Task #22 -- In Progress)
- Basic metadata preservation works (`-map_metadata 0`)
- Full stream mapping not yet implemented
- Subtitle streams are not preserved during compression
- Data streams and attachments are not mapped
- **Needed:** `-map 0` with `-c:s copy` for subtitle preservation
- **Status:** Basic preservation works; full stream mapping in progress

### Verify All Fixes Consistency (Task #23 -- Pending)
- Need to verify that the three recent fixes (bitrate capping, output naming,
  metadata preservation) are consistent across all code paths
- Specifically: ensure `adjustBitrate()` is called correctly, `_COMP` naming
  is used everywhere, and `-map_metadata` is in all command builds

---

## 6. Future Roadmap

### Near-Term (Next Session)

1. **Complete metadata/subtitle stream mapping** (Task #22)
   - Add `-map 0` and `-c:s copy` to command builder
   - Test with files containing subtitles

2. **Verify fix consistency** (Task #23)
   - Audit all code paths for the three recent fixes
   - Ensure no regressions

3. **Output directory configuration**
   - Add UI option to set custom output path
   - Default to source directory, allow override

### Medium-Term

4. **Meta Glasses metadata stripping mode**
   - Detect Meta Ray-Ban footage by device tags
   - Auto-strip GPS, device info, user identifiers
   - Stream copy (no re-encoding) for instant processing

5. **Custom quality slider**
   - Replace fixed 4-preset system with continuous slider
   - Map to CRF values (SW) or bitrate values (HW)
   - Show real-time estimation as slider moves

6. **Compression comparison mode**
   - Encode 10-30s sample with multiple settings
   - Side-by-side preview with file size comparison
   - Help users choose optimal settings before full encode

### Long-Term

7. **Video stitching tool**
   - Concatenate multiple clips into single output
   - Drag-and-drop ordering in UI
   - Support for transitions (crossfade, cut)
   - Handle mixed codecs via re-encode mode

8. **Advanced stream selection**
   - Choose which audio tracks to include
   - Select/deselect subtitle streams
   - Per-stream codec configuration

---

## 7. Known Issues and Root Causes

| Issue | Root Cause | Severity | Workaround |
|-------|-----------|----------|------------|
| HW encoder output can exceed input size | VideoToolbox uses fixed bitrate target, not adaptive CRF | Medium | Use SW encoder or `small` preset |
| Bitrate targeting imprecise (10-30% variance) | Apple hardware encoder design limitation | Low | Accept variance or use SW CRF |
| Estimation accuracy off by 20-40% | HW: approximate bitrate; SW: fixed ratios ignore content complexity | Low | Treat as estimate, not guarantee |
| Subtitles not preserved during compression | Missing `-map 0` and `-c:s copy` flags | Medium | Will be fixed in Task #22 |
| Output fails if source directory is read-only | Output writes to same directory as source | Medium | Move source to writable location |
| Per-file resolution dropdown not used in batch | Global scale setting overrides per-file `file.scale` | Low | Manual per-file setting respected in UI |
| Short clips have poor compression ratio | Fixed encoding overhead (keyframes, headers) as % of small file | Low | Expected behavior; skip very short clips |
| AV1 encoding is very slow | libsvtav1 is CPU-only, no HW acceleration on Apple Silicon | Low | Expected; use for archival, not real-time |
| WebSocket reconnect may miss events | Events during disconnect are not queued or replayed | Low | Refresh page and check `/api/jobs` |

---

## 8. Session Skill System Created

Created 5 production-quality skills in `.claude/skills/` using the Progressive Disclosure
framework (3-level: YAML frontmatter, numbered workflow steps, deep knowledge references).

### Skills Created

1. **compress-video** -- Full 5-step workflow: validate input, select settings, estimate output, execute compression, monitor and verify. Includes complete preset reference tables and FFmpeg flag construction reference.

2. **diagnose-compression** -- 5-step diagnostic workflow: probe input, probe output, identify root cause (decision tree for large/bad/marginal results), recommend fix, verify. Includes deep knowledge on why already-compressed files resist further compression and VideoToolbox bitrate behavior.

3. **batch-process** -- 6-step batch workflow: scan files, probe all, group by codec/resolution, configure per-file, queue and execute, monitor. Includes queue architecture diagram and concurrency guidance for M2 Max.

4. **optimize-quality** -- 5-step optimization workflow: probe and analyze, content-specific recommendations, preset comparison chart, resolution impact analysis, estimation and comparison. Includes CRF deep knowledge and encoding speed reference.

5. **metadata-tools** -- 5-step metadata workflow: probe full metadata, display summary, choose action (preserve/strip/edit), execute, verify. Includes future Meta glasses stripping mode design and ffprobe command cheatsheet.

### CLAUDE.md Rewritten

Comprehensive 10-section document covering: project overview, architecture (full file listing), tech stack, API reference (all endpoints with request/response), FFmpeg presets (all quality/codec/format combinations), hardware acceleration details, skills listing, known issues, coding conventions, and future plans.

---

## 9. Environment Notes

- **Machine:** Mac with M2 Max (or similar Apple Silicon)
- **FFmpeg:** 7.1.1 at `/opt/homebrew/bin/ffmpeg`
- **Node.js:** 18+ with ES module support
- **Port:** 3000 (configurable via PORT env var)
- **Upload directory:** `/tmp/video-compressor-uploads/` (created on startup)
- **Job concurrency:** 4 (PQueue, optimized for M2 Max dual encode engines)

---

## 10. How to Pick Up Where We Left Off

1. Read `CLAUDE.md` for full project understanding
2. Check Tasks #22 (stream mapping) and #23 (fix verification) -- both pending completion
3. Run `node server.js` and open `http://localhost:3000` to verify current state
4. Test with a ProRes file (should compress well) and an already-compressed H.264 file (should show smart bitrate capping behavior)
5. Review the skills in `.claude/skills/` for workflow guidance on any operation
6. Consult the "Future Roadmap" section above for next priorities
