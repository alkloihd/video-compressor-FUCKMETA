# Changelog — 2026-02-24

## [1.0.0] — 2026-02-24 — Initial Release

### Added
- Full Video Compressor web app (Node.js + Express + vanilla JS)
- Dark glassmorphism UI with Tailwind CDN + Plyr video player
- Drag-and-drop file upload + path paste input
- Video preview with Plyr player and range-request streaming
- FFmpeg compression with 5 quality presets (Max, Balanced, Small, Streaming, Custom)
- 4 codecs: H.264, H.265/HEVC, AV1, ProRes
- 3 output formats: MP4, MOV, MKV
- VideoToolbox hardware acceleration (h264_videotoolbox, hevc_videotoolbox, prores_videotoolbox)
- Parallel job queue (p-queue, concurrency: 4 for M2 Max dual encode engines)
- Real-time WebSocket progress bars with percentage, speed, ETA, fps
- Trim controls (start/end time inputs in HH:MM:SS)
- Crop presets (None, 16:9, 4:3, 1:1, 9:16)
- Resolution downscaling (Original, 1080p, 720p, 480p, 360p)
- Per-video resolution dropdown in file cards
- File size estimation (updates live based on settings)
- Custom quality preset with CRF slider (0-51) and encoding speed selector
- Expandable tradeoff info panel (codec characteristics, preset implications, what's preserved/lost)
- Day/Night/System theme toggle with localStorage persistence
- Smart bitrate capping (prevents already-compressed files from getting bigger)
- Full metadata preservation (-map_metadata 0, -map 0, -movflags +use_metadata_tags)
- Output files saved next to original with _COMP suffix
- macOS double-click launcher (start.command)
- ESLint flat config + Prettier formatting
- 5 Progressive Disclosure skills (compress-video, diagnose-compression, batch-process, optimize-quality, metadata-tools)
- Comprehensive CLAUDE.md (477 lines)
- Work session handoff document
- AI Chat Log following FACTORY_V2 protocol

### Fixed
- 11 API mismatches between frontend and backend (upload field, probe method, compress body, etc.)
- VideoToolbox fixed-bitrate causing already-compressed files to increase in size
- ESLint: Node.TEXT_NODE → literal 3, removed unused imports
- Added localStorage/matchMedia to ESLint globals for theme.js

### Architecture
- Backend: server.js (Express + WebSocket), lib/ (ffmpeg.js, jobQueue.js, probe.js, hwaccel.js)
- Frontend: public/ (index.html, css/styles.css, js/8 modules)
- Skills: .claude/skills/ (5 skill directories)
- Docs: .agents/work-sessions/, CLAUDE.md
