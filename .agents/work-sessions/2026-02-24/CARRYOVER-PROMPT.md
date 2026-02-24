# Carryover Prompt — Video Compressor Session 2026-02-24

**Paste this into a new Claude Code chat to resume work on the Video Compressor project.**

---

## Project Location
`/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR`

## What This Is
A fully functional local video compression app with a polished web UI. Built from scratch in a single session. Uses FFmpeg with Apple Silicon M2 Max VideoToolbox hardware acceleration. Runs at localhost (default port 3000, tested on 4000).

## How to Run
```bash
cd "/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR"
npm install  # if needed
node server.js  # or PORT=4000 node server.js
# or double-click start.command
```

## Read These Files First
1. **`CLAUDE.md`** — Comprehensive project docs (477 lines): architecture, API, presets, HW accel, skills, conventions
2. **`.agents/work-sessions/2026-02-24/HANDOFF.md`** — Full session handoff with everything built, fixed, and pending
3. **`.agents/work-sessions/2026-02-24/AI-CHAT-LOG.md`** — Timestamped log of every action taken
4. **`.agents/work-sessions/2026-02-24/CHANGELOG.md`** — All features and fixes

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express (ES modules) |
| Real-time | WebSocket (ws) |
| Video Engine | FFmpeg 7.1.1 at /opt/homebrew/bin/ffmpeg |
| HW Accel | VideoToolbox (h264, hevc, prores) |
| Job Queue | p-queue (concurrency: 4) |
| Frontend | Vanilla JS + Tailwind CDN + Plyr CDN |
| Theme | Dark/Light/System glassmorphism with CSS custom properties |

## Complete File Tree (27 source files)
```
VIDEO COMPRESSOR/
├── server.js                          # Express + WebSocket server, all API routes
├── package.json                       # Dependencies + scripts (start, dev, lint, format, check)
├── start.command                      # macOS double-click launcher
├── CLAUDE.md                          # Comprehensive project documentation
├── eslint.config.js                   # Flat ESLint config (ES2024, browser+node globals)
├── .prettierrc                        # Single quotes, trailing commas, 100 char width
├── .prettierignore / .gitignore
├── lib/
│   ├── ffmpeg.js                      # FFmpeg command builder (presets, scale, crop, trim, metadata)
│   ├── jobQueue.js                    # p-queue wrapper, progress parsing, events
│   ├── probe.js                       # ffprobe metadata extraction (flat format)
│   └── hwaccel.js                     # VideoToolbox detection + encoder mapping
├── public/
│   ├── index.html                     # Single-page app
│   ├── css/styles.css                 # Glassmorphism theme (CSS vars, light/dark)
│   └── js/
│       ├── app.js                     # Main state + orchestration
│       ├── dragdrop.js                # Drag-and-drop + file input + path input
│       ├── player.js                  # Plyr video preview
│       ├── trim.js                    # Trim UI (HH:MM:SS inputs)
│       ├── crop.js                    # Crop/aspect ratio presets
│       ├── compression.js             # Settings panel + estimation + custom quality
│       ├── progress.js                # WebSocket progress bars
│       ├── filemanager.js             # File cards + per-video resolution + status
│       └── theme.js                   # Light/Dark/System theme toggle
├── .claude/skills/
│   ├── compress-video/SKILL.md        # Compression workflow skill
│   ├── diagnose-compression/SKILL.md  # Diagnose poor compression results
│   ├── batch-process/SKILL.md         # Multi-file batch processing
│   ├── optimize-quality/SKILL.md      # Quality/size tradeoff optimization
│   └── metadata-tools/SKILL.md        # Metadata inspect/preserve/strip
└── .agents/work-sessions/2026-02-24/
    ├── HANDOFF.md                     # Session handoff
    ├── AI-CHAT-LOG.md                 # Timestamped agent action log
    ├── CHANGELOG.md                   # All changes
    └── CARRYOVER-PROMPT.md            # This file
```

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/upload | Upload video files (multer, field: 'file') |
| POST | /api/compress | Start compression (body: { files, preset, codec, format, scale, trim, crop, crf, speed }) |
| GET | /api/probe?path= | Get video metadata (flat: { duration, width, height, fps, codec, bitrate, size, format, audioCodec }) |
| GET | /api/stream?path= | Range-request video streaming for preview |
| GET | /api/thumbnail?path= | Generate JPEG thumbnail |
| GET | /api/jobs | List all jobs |
| DELETE | /api/jobs/:id | Cancel a job |
| GET | /api/hwaccel | Hardware acceleration capabilities |
| WebSocket | same port | Events: progress, complete, error (all have jobId field) |

## Current Features
- Drag-and-drop + file picker + path paste for ALL video formats
- 5 quality presets: Max, Balanced, Small, Streaming, Custom (CRF slider + speed)
- 4 codecs: H.264, H.265, AV1, ProRes (with HW acceleration indicators)
- 3 formats: MP4, MOV, MKV (with codec-based constraints)
- Resolution downscaling: Original, 1080p, 720p, 480p, 360p (global + per-video)
- Trim (start/end time) and Crop (aspect ratio presets)
- Live file size estimation with savings percentage
- Real-time WebSocket progress bars (%, speed, ETA, fps)
- Smart bitrate capping (prevents size increases on already-compressed files)
- Full metadata preservation (GPS, dates, subtitles, data tracks)
- Output: `filename_COMP.ext` next to original (no subfolder)
- Day/Night/System theme toggle with localStorage persistence
- Expandable tradeoff info panel (codec characteristics, quality implications)
- Parallel compression (4 concurrent jobs on M2 Max)

## Key Bug Fixes Applied
1. **11 API mismatches** between frontend and backend (upload field name, probe GET vs POST, compress body format, preview URL, WS event fields)
2. **Smart bitrate capping** — VideoToolbox fixed-bitrate was making already-compressed files BIGGER. Now caps at 70%/50%/40% of input bitrate for balanced/streaming/small
3. **Probe data format** — Frontend expected raw ffprobe output but probe.js returns flat normalized object. Fixed all consumers.
4. **Metadata preservation** — Added `-map_metadata 0`, `-map 0` (all streams), `-movflags +use_metadata_tags`

## Known Issues / Needs Testing
1. **Custom preset backend support** — The server/ffmpeg.js may need updates to handle `crf` and `speed` params from the custom preset. Currently the QUALITY_PRESETS in ffmpeg.js are looked up by preset name, and "custom" isn't in the table. This needs a code path that uses the raw CRF/speed values instead of preset lookup.
2. **Upload flow for large files** — No upload progress indicator (FormData upload is fire-and-forget). Could add XHR with progress events.
3. **File path input** — Works for local paths but uploaded files go to temp dir. Path-based files probe directly without upload.
4. **Concurrent compression of same file** — No lock preventing duplicate compression of the same source.
5. **ESLint warnings** — 2 intentional: `_process` destructure in jobQueue.js, unused `err` in progress.js catch.

## What the User Wants Next (Priority Order)
1. **Meta AI metadata stripping** — A separate tab/mode for stripping "Made with Meta glasses" metadata from videos. Another agent is working on the spec. Will be a new tab in the UI.
2. **Video stitching tool** — Drag-and-drop stitching of multiple videos with cropping/trimming of individual clips. Future feature.
3. **More accurate estimation** — User wants to know EXACTLY what the output will be and what would be lost.
4. **Custom preset backend** — Wire CRF/speed values through to FFmpeg when "Custom" preset is selected.

## Skills System
The project uses the Progressive Disclosure framework (3-level architecture):
- Level 1: YAML frontmatter (always loaded)
- Level 2: Numbered workflow steps with validation gates
- Level 3: Deep knowledge in references/

5 skills exist in `.claude/skills/`. Read them to understand compression workflows, diagnostics, and optimization guidance.

## Agent Protocol
Follow the FACTORY_V2 work session protocol:
- **AI-CHAT-LOG.md** — Log every action with: timestamp (IST 24hr), agent identity (solo/team/subagent + model), task category tag [BUILD/FIX/FEATURE/DOCS/etc], task description, actions taken, findings, files modified, status
- **CHANGELOG.md** — Reverse-chronological feature/fix log
- **HANDOFF.md** — Session handoff for next agent
- Use subagents/teams wherever possible for parallel work
- Update CLAUDE.md when architecture changes
- Create new work session folder per day: `.agents/work-sessions/YYYY-MM-DD/`

## Compression Quality Context
The user tested with 6 MOV files from `/Users/rishaal/Movies/School/`:
- 1 file (fantasticos) was ProRes/raw MOV → compressed 90% (3.1GB → 340MB). This is expected.
- 2 files INCREASED in size (already H.264/H.265 at low bitrate, re-encoded at higher fixed bitrate)
- 3 files barely compressed (1-16% reduction)
- **Root cause**: VideoToolbox HW encoding uses fixed bitrate targets. "Balanced" H.265 targets 6 Mbps. If input is already 4 Mbps, output is bigger.
- **Fix applied**: adjustBitrate() function caps target at 70%/50%/40% of input bitrate (balanced/streaming/small). Max preset is uncapped.
- **User needs to re-test** with the fix applied.
