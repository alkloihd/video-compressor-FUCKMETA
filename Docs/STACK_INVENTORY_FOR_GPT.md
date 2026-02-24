# Video Compressor — Complete Stack Inventory
**Purpose**: Full end-to-end inventory of the existing Video Compressor app for ChatGPT Pro to generate custom integration guides for new features (metadata stripping, video stitching, drag-drop editing).
**Generated**: 2026-02-24
**Repo**: `/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR`

---

## How to Use This Document

This is a **read-only inventory** of an existing, working local video compression app. Pass this to ChatGPT Pro so it can design custom integration prompts for adding:
1. **Meta Ray-Ban metadata stripping** (HEIC photos + MOV/MP4 videos)
2. **Video stitching** with drag-drop reordering
3. **Start/end trim editing** with visual sliders per-clip
4. **Optional compression** during stitch operations

The app is **local-only** (localhost:3000, no cloud), **macOS-first** (Apple Silicon), and uses **zero frameworks** on the frontend. Any new features must follow these conventions.

---

## Stack Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (localhost:4000)                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Vanilla JS ES Modules (no framework)                      │  │
│  │  Tailwind CSS v4 CDN (no build step)                       │  │
│  │  Plyr 3.7.8 CDN (video player)                             │  │
│  │  Dark glassmorphism UI + violet accents                    │  │
│  │  WebSocket client (exponential backoff reconnect)          │  │
│  └────────────────────────┬──────────────────────────────────┘  │
│                           │ HTTP + WS                            │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │  Express 4.21 (Node.js, ES modules)                        │  │
│  │  Port 3000 (HTTP + WS on same port)                        │  │
│  │  Multer for file uploads (up to 20 files, 50GB each)       │  │
│  │  WebSocket (ws 8.18) for real-time progress                │  │
│  └───┬──────────┬────────────┬──────────────┬────────────────┘  │
│      │          │            │              │                    │
│  ┌───▼───┐ ┌───▼────┐ ┌────▼─────┐ ┌─────▼──────────┐         │
│  │FFmpeg │ │ffprobe │ │ p-queue  │ │ VideoToolbox   │         │
│  │7.1.1  │ │(probe) │ │ (4 jobs) │ │ HW Accel       │         │
│  │spawn  │ │execFile│ │ EventMgr │ │ h264/h265/     │         │
│  │       │ │        │ │          │ │ prores HW enc  │         │
│  └───────┘ └────────┘ └──────────┘ └────────────────┘         │
│                                                                 │
│  System: macOS (Apple Silicon M2 Max), Homebrew FFmpeg          │
│  Paths: /opt/homebrew/bin/ffmpeg, /opt/homebrew/bin/ffprobe     │
└─────────────────────────────────────────────────────────────────┘
```

---

## A) Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | v22.18.0 |
| Package Manager | npm | 11.6.1 |
| Module System | ES modules (`"type": "module"`) | — |
| Web Framework | Express | 4.21.0 |
| File Uploads | Multer | 1.4.5-lts.1 |
| WebSocket | ws | 8.18.0 |
| Job Queue | p-queue | 8.0.1 |
| UUID Generation | uuid | 10.0.0 |
| Browser Opener | open | 10.1.0 |
| Linting | ESLint | 10.0.1 (flat config, ES2024) |
| Formatting | Prettier | 3.8.1 |
| Frontend CSS | Tailwind CSS | CDN (no build) |
| Video Player | Plyr | 3.7.8 CDN |
| Video Engine | FFmpeg | 7.1.1 (system Homebrew) |
| TypeScript | None | Pure JavaScript |
| Build System | None | Static files served directly |

---

## B) Project Structure (every file)

```
VIDEO COMPRESSOR/
├── .gitignore                 # node_modules, .DS_Store, *.log
├── .prettierignore            # node_modules, package-lock.json
├── .prettierrc                # singleQuote, trailingComma:all, printWidth:100, tabWidth:2, semi:true
├── CLAUDE.md                  # Project instructions for AI agents
├── eslint.config.js           # Flat config, ES2024, no-var, prefer-const, eqeqeq
├── package.json               # 6 prod deps, 2 dev deps, ES module
├── package-lock.json          # lockfileVersion 3
├── server.js                  # 297 lines — Express server, all API routes, WebSocket, startup
├── start.command              # macOS double-click launcher (checks node/ffmpeg, opens browser)
│
├── lib/
│   ├── ffmpeg.js              # 169 lines — FFmpeg command builder (codecs, presets, bitrate caps)
│   ├── hwaccel.js             # 48 lines  — VideoToolbox encoder detection + codec resolver
│   ├── jobQueue.js            # 182 lines — p-queue job manager (spawn, progress, cancel)
│   └── probe.js               # 60 lines  — ffprobe wrapper (metadata extraction)
│
├── public/
│   ├── index.html             # ~440 lines — Full HTML shell, Tailwind config, theme IIFE
│   ├── css/
│   │   └── styles.css         # ~1200 lines — Complete design system (dark/light themes, 100+ CSS vars)
│   └── js/
│       ├── app.js             # ~400 lines — Orchestrator (state, file lifecycle, compress flow)
│       ├── compression.js     # ~670 lines — Quality presets, codec/format UI, estimation, tradeoffs
│       ├── crop.js            # ~100 lines — Aspect ratio crop presets (16:9, 4:3, 1:1, 9:16)
│       ├── dragdrop.js        # ~180 lines — Drag-drop, file browser, path paste input
│       ├── filemanager.js     # ~390 lines — File card rendering, job status updates
│       ├── player.js          # ~70 lines  — Plyr video player wrapper
│       ├── progress.js        # ~190 lines — WebSocket client with exponential backoff
│       ├── theme.js           # ~115 lines — Three-way theme toggle (light/system/dark)
│       └── trim.js            # ~135 lines — Trim start/end timecode inputs
│
└── Docs/
    ├── chat gpt chat.md       # ChatGPT conversation about metadata stripping plans
    └── STACK_INVENTORY_FOR_GPT.md  # THIS FILE
```

---

## C) Backend Architecture — Complete Detail

### server.js — Entry Point (297 lines)

**Startup Sequence:**
1. Creates upload directory at `{os.tmpdir()}/video-compressor-uploads`
2. Runs `detectHWAccel()` to probe VideoToolbox encoders (cached for process lifetime)
3. Initializes `JobQueue` (p-queue, concurrency: 4)
4. Starts HTTP server on port 4000
5. Attaches WebSocket server on same port
6. Opens browser automatically via `open` package

**Middleware:**
- `express.json({ limit: '1mb' })` — JSON body parsing
- `express.static('public')` — serves frontend

**WebSocket Management:**
- `wsClients: Set` — tracks all connected clients
- `broadcast(data)` — JSON serializes and sends to all OPEN clients
- Job queue events (`progress`, `complete`, `error`) are bridged directly to WebSocket broadcasts

### API Routes (7 endpoints)

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| POST | `/api/upload` | Upload video files | multipart/form-data, field `file`, max 20 files, 50GB/file | `{ files: [{ path, name, size }] }` |
| GET | `/api/probe?path=` | Get video metadata | query param: absolute file path | `{ duration, width, height, fps, codec, bitrate, size, format, audioCodec }` |
| GET | `/api/stream?path=` | Stream video for player | query param: absolute file path | HTTP 206 partial content, MIME-typed video stream |
| GET | `/api/thumbnail?path=&time=&width=` | Generate JPEG thumbnail | time default `00:00:02`, width default `320` | `image/jpeg` binary, cached 1hr |
| POST | `/api/compress` | Start compression job(s) | `{ files, preset, codec, format, trim?, crop?, scale? }` | `{ jobs: [{ id, status, inputPath, outputPath, fileName }] }` |
| GET | `/api/jobs` | List all jobs | — | `{ jobs: [...] }` |
| DELETE | `/api/jobs/:id` | Cancel a job | — | `{ cancelled: bool, id }` |
| GET | `/api/hwaccel` | Hardware acceleration info | — | `{ h264_videotoolbox, hevc_videotoolbox, prores_videotoolbox }` |

**Compression Request Body Shape:**
```json
{
  "files": [{ "path": "/abs/path/to/video.mp4", "name": "video.mp4" }],
  "preset": "max|balanced|small|streaming|custom",
  "codec": "h264|h265|av1|prores",
  "format": "mp4|mov|mkv",
  "scale": "original|1080p|720p|480p|360p",
  "crf": 23,
  "speed": "ultrafast|fast|medium|slow|veryslow",
  "trim": { "start": 0, "end": 120 },
  "crop": { "width": 1920, "height": 1080, "x": 0, "y": 0 }
}
```

**Output Path Convention:**
- Output goes next to source file as `{name}_COMP.{ext}`
- If exists, increments: `_COMP_2`, `_COMP_3`, etc.
- Extension determined by format selection (mp4/mov/mkv)

**Video Streaming:**
- Full HTTP 206 range request support for seeking
- MIME type map covers 10 video formats: mp4, mov, mkv, webm, avi, wmv, flv, ts, mts, m4v

**Graceful Shutdown:**
- Registered on SIGINT and SIGTERM
- Closes all WebSocket clients, closes HTTP server
- Force-kills after 5 seconds if stuck

---

### lib/ffmpeg.js — FFmpeg Command Builder (169 lines)

**Exports:** `buildCommand(options) → string[]`

**Encoder Selection (via hwaccel.js):**

| Codec | HW Encoder | SW Fallback |
|-------|-----------|-------------|
| h264 | `h264_videotoolbox` | `libx264` |
| h265 | `hevc_videotoolbox` | `libx265` |
| prores | `prores_videotoolbox` | `prores_ks` |
| av1 | — (no HW) | `libsvtav1` |

**Quality Presets (complete matrix):**

| Encoder | max | balanced | small | streaming |
|---------|-----|----------|-------|-----------|
| h264_videotoolbox | 20000k b:v, high profile | 8000k b:v, high | 4000k b:v, main | 5000k b:v, high |
| libx264 | CRF 18, slow | CRF 23, medium | CRF 28, medium | CRF 23, fast |
| hevc_videotoolbox | 12000k b:v, hvc1 tag | 6000k b:v, hvc1 | 3000k b:v, hvc1 | 4000k b:v, hvc1 |
| libx265 | CRF 22, slow, hvc1 | CRF 28, medium, hvc1 | CRF 32, medium, hvc1 | CRF 28, fast, hvc1 |
| libsvtav1 | CRF 25, preset 4 | CRF 30, preset 6 | CRF 38, preset 8 | CRF 35, preset 6 |
| prores_videotoolbox | profile 3 (HQ) | profile 2 (Standard) | profile 1 (LT) | profile 2 |
| prores_ks | profile 3 | profile 2 | profile 1 | profile 2 |

**Smart Bitrate Capping (prevents output > input):**
- `max` preset: no cap
- `balanced`: cap at 70% of input bitrate
- `streaming`: cap at 50%
- `small`: cap at 40%

**Audio Encoding:**
- h264/h265: AAC, 256k (max) or 192k (other presets)
- prores: PCM lossless (pcm_s16le)
- av1: libopus, 128k

**FFmpeg Argument Assembly Order:**
1. `-threads 0 -y` (all threads, overwrite)
2. `-i <input>`
3. `-map_metadata 0` (preserve metadata)
4. Stream mapping (MKV strips data/subtitle tracks; MP4/MOV keeps all)
5. Trim flags: `-ss` and/or `-to`
6. Video encoder + quality flags
7. Video filters: crop → scale (comma-joined `-vf`)
8. Audio flags
9. `-movflags +faststart+use_metadata_tags` (MP4/MOV only)
10. Output path

---

### lib/jobQueue.js — Job Manager (182 lines)

**Exports:** `JobQueue` class (extends EventEmitter)

**Concurrency:** 4 simultaneous FFmpeg processes via p-queue (tuned for M2 Max dual encode engines)

**Job Record Schema:**
```js
{
  id: string,            // uuidv4
  status: 'queued' | 'running' | 'complete' | 'error' | 'cancelled',
  inputPath: string,
  outputPath: string,
  preset: string,
  codec: string,
  format: string,
  startedAt: Date | null,
  completedAt: Date | null,
  originalSize: number,  // bytes
  compressedSize: number, // bytes (set on complete)
  percent: number,       // 0-100, one decimal
  fps: number,
  speed: number,         // multiplier (e.g., 2.5x)
  eta: number | null,    // seconds remaining
  duration: number,      // total duration from probe
  _process: ChildProcess // stripped before client exposure
}
```

**Job Lifecycle:**
1. `addJob()` → status: `queued`, stored in Map, enqueued in PQueue
2. PQueue dequeues → `_runJob()` → status: `running`, FFmpeg spawned
3. stderr parsed for progress (time, speed, fps) at 1s throttle
4. Process exit code 0 → status: `complete`, emit `complete`
5. Process exit non-zero → status: `error`, emit `error`
6. `cancelJob()` → sends SIGTERM to FFmpeg process, status: `cancelled`

**Events Emitted:**
| Event | Payload |
|-------|---------|
| `progress` | Full sanitized job record |
| `complete` | Full sanitized job record (with compressedSize) |
| `error` | `{ id, message }` |

**Progress Parsing:** Regex on FFmpeg stderr CR-delimited lines extracts `time=HH:MM:SS.xx`, `speed=Nx`, `fps=N`

---

### lib/probe.js — Video Metadata (60 lines)

**Exports:** `probe(filePath) → Promise<metadata>`

**FFprobe Command:** `ffprobe -v quiet -print_format json -show_streams -show_format <path>` with 30s timeout

**Return Shape:**
```js
{
  duration: number,    // seconds
  width: number,       // pixels
  height: number,      // pixels
  fps: number,         // e.g., 29.97 (from r_frame_rate rational)
  codec: string,       // e.g., 'h264', 'hevc'
  bitrate: number,     // bits/sec
  size: number,        // bytes
  format: string,      // e.g., 'mov,mp4,m4a,3gp,3g2,mj2'
  audioCodec: string | null
}
```

---

### lib/hwaccel.js — Hardware Detection (48 lines)

**Exports:**
- `detectHWAccel() → Promise<{ h264_videotoolbox, hevc_videotoolbox, prores_videotoolbox }>` (cached)
- `getEncoder(codec, useHW) → string`

**Detection:** Runs `ffmpeg -encoders` once, scans for VideoToolbox encoder strings, freezes and caches result.

---

## D) Frontend Architecture — Complete Detail

### index.html — HTML Shell (~440 lines)

**CDN Dependencies:**
| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | latest CDN | Utility-class CSS |
| Plyr CSS | 3.7.8 | Video player styles |
| Plyr JS | 3.7.8 (polyfilled) | Video player |

**Tailwind Config (inline):**
```js
tailwind.config = {
  darkMode: 'class',
  theme: { extend: { colors: {
    surface: { 950: '#0a0a0f', 900: '#111118', 800: '#1a1a24', 700: '#24242f' }
  }}}
};
```

**Theme Flash Prevention:** Inline IIFE in `<head>` reads `localStorage('theme')`, applies `data-theme` attribute and `dark` class before first paint.

**Major DOM Sections and Element IDs:**

| Section | Key IDs | Purpose |
|---------|---------|---------|
| Header | `#hw-badge`, `#hw-badge-text`, `.theme-toggle` | HW status + theme switcher |
| Drop Zone | `#drop-zone`, `#file-input`, `#path-input`, `#path-submit` | File input (drag/browse/paste) |
| File Queue | `#file-cards-container`, `#file-count`, `#clear-queue-btn`, `#file-queue-empty` | File card grid |
| Settings | `#quality-presets`, `#codec-selector`, `#format-selector`, `#speed-selector`, `#custom-quality-panel`, `#custom-crf`, `#trim-start`, `#trim-end`, `#crop-presets`, `#crop-info`, `#compression-summary`, `#compress-btn`, `#tradeoff-info` | All compression options |
| Preview | `#preview-section`, `#preview-player`, `#info-duration`, `#info-resolution`, `#info-codec`, `#info-size` | Video preview + metadata |
| Jobs | `#jobs-section`, `#jobs-container` | Running/completed jobs |
| Notifications | `#notifications` | Toast messages (fixed top-right) |

**Script Loading Order:**
1. Tailwind CDN (sync, head)
2. Theme IIFE (inline sync, head)
3. Plyr JS (sync, end of body)
4. `theme.js` (module)
5. `app.js` (module — imports all other modules)

---

### CSS Design System — styles.css (~1200 lines)

**Theme Architecture:** Two `[data-theme]` scopes (`dark` and `light`) define 100+ CSS custom properties. All Tailwind hardcoded colors are overridden via semantic `.themed-*` classes.

**CSS Custom Property Categories:**
| Category | Variables (examples) |
|----------|---------------------|
| Backgrounds | `--bg-body`, `--bg-surface`, `--bg-elevated`, `--bg-elevated-2` |
| Glass Effects | `--glass-bg`, `--glass-bg-hover`, `--glass-border`, `--glass-border-hover` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted` |
| Accent (violet) | `--accent`, `--accent-hover`, `--accent-light`, `--accent-muted` |
| Drop Zone | `--dropzone-border`, `--dropzone-hover-border`, `--dropzone-active-shadow` |
| File Cards | `--card-bg`, `--card-border`, `--card-shadow-hover` |
| Progress | `--progress-track`, `--progress-speed`, `--progress-eta` |
| Status Badges | 6 states × 3 tokens (bg/text/border): `uploading`, `pending`, `queued`, `compressing`, `done`, `error` |
| Notifications | 4 types × 3 tokens: `info`, `warning`, `error`, `success` |

**Key Component Classes:**
- `.glass-card` — `backdrop-filter: blur(20px)`, border transitions
- `.drop-zone` — Dashed border, `.drag-over` scale effect, error overlay
- `.preset-btn` — 3-state button (default/hover/active), disabled at 0.35 opacity
- `.compress-btn` — Animated violet gradient, disabled state
- `.file-card` — `slide-up` animation, `.selected`/`.file-card-done`/`.file-card-error-state` variants
- `.progress-bar-fill` — Shimmer animation, green (done), red (error)
- `.status-badge` — 6 uppercase pill variants
- `.notification` — `slide-up` enter, `notification-fade` exit

**Animations:** `shimmer`, `pulse-glow`, `fade-in`, `slide-up`, `gradient-shift`

**Responsive:** `@media (max-width: 640px)` adjusts drop zone, thumbnails, glass card radius, hides path input

---

### JavaScript Modules — Complete Function Inventory

#### app.js — Orchestrator (~400 lines)

**Global State:**
```js
export const appState = {
  files: [],           // { id, name, size, path, serverPath, probeData, status, jobId, uploadProgress }
  selectedFileId: null,
  activeJobs: {},      // { jobId: { fileId, progress, speed, eta, status } }
  hwInfo: null,
  wsConnected: false,
};
```

**Exported Functions:**
| Function | Purpose |
|----------|---------|
| `addFilesToQueue(fileList)` | Upload files via `/api/upload`, probe via `/api/probe`, add to state |
| `addFileByPath(filePath)` | Probe path directly (no upload), add to state |
| `selectFile(fileId)` | Load video in Plyr, show probe info, update trim/crop/compression |
| `removeFile(fileId)` | Remove from state, cleanup player if selected |
| `clearAllFiles()` | Reset all state, hide preview |
| `compressAll()` | POST `/api/compress` with settings, create activeJobs |
| `updateCompressButton()` | Enable/disable based on pending file count |
| `showNotification(message, type, duration)` | Toast notification with SVG icon |

**DOMContentLoaded Init:**
1. Fetch `/api/hwaccel` → store in `appState.hwInfo`
2. Call all `init*()` functions: `initDragDrop`, `initPlayer`, `initTrim`, `initCrop`, `initCompression(hwInfo)`, `initProgress`, `initFileManager`
3. Wire clear and compress buttons

#### compression.js — Settings UI (~670 lines)

**Module State:** `currentPreset`, `currentCodec`, `currentFormat`, `currentScale`, `currentCrf`, `currentSpeed`, `hwInfo`

**Key Constants:**
- `CODEC_FORMAT_MAP` — Maps codecs to allowed output formats
- `HW_BITRATES` — Target kbps per HW encoder per preset (for estimation)
- `SW_RATIOS` — File size fraction per SW encoder per preset
- `CODEC_TRADEOFFS` / `PRESET_TRADEOFFS` — Human-readable tradeoff descriptions

**Exported Functions:**
| Function | Purpose |
|----------|---------|
| `initCompression(hwData)` | Wire all preset/codec/format/CRF/speed buttons, create resolution selector and estimation display |
| `getCompressionSettings()` | Returns `{ preset, codec, format, scale, crf?, speed? }` |
| `updateResolutionOptions()` | Disables options that would upscale source |
| `updateEstimation()` | Computes and displays estimated output size with color coding |

**Dynamically Created DOM Elements:**
- `#resolution-select` — Resolution dropdown (injected into settings panel)
- `#size-estimation` — Estimated output size display (injected after summary)

#### dragdrop.js — File Input (~180 lines)

**Three input methods:**
1. **Drag-and-drop** onto `#drop-zone` (with drag counter pattern for nested elements)
2. **File browser** — click drop zone → triggers hidden `#file-input`
3. **Path paste** — `#path-input` text field, semicolon/newline separated, processed by `addFileByPath`

**Video validation:** Checks `file.type.startsWith('video/')` or extension against 16-entry allowlist

#### filemanager.js — File Cards (~390 lines)

**Exported Functions:**
| Function | Purpose |
|----------|---------|
| `renderFiles()` | Full re-render of all file cards via innerHTML |
| `updateJobStatus(jobId, data)` | Surgical progress bar updates; full re-render on complete/error |
| `initFileManager()` | Initial render call |
| `formatBytes(bytes)` | Human-readable size (B/KB/MB/GB/TB) |
| `formatDuration(seconds)` | H:MM:SS or M:SS format |

**File Card States:** uploading (blue), pending (yellow), queued (amber), compressing (violet shimmer), done (green), error (red)

**Smart Updates:** Progress bar fill width and text are updated surgically via DOM queries (no re-render). Full `innerHTML` rebuild only on structural changes.

#### player.js — Plyr Wrapper (~70 lines)

**Exported Functions:**
| Function | Purpose |
|----------|---------|
| `initPlayer()` | Create Plyr instance with controls config |
| `loadVideo(url)` | Set Plyr source, show preview section |
| `getCurrentTime()` | Current playback position |
| `getDuration()` | Video duration |
| `seekTo(time)` | Seek to specific time |
| `destroyPlayer()` | Stop and clear player |

**Plyr Controls:** play-large, play, progress, current-time, duration, mute, volume, fullscreen

#### progress.js — WebSocket Client (~190 lines)

**WebSocket Messages Handled:**
| Type | Action |
|------|--------|
| `progress` | Update activeJobs, file status → `updateJobStatus()` |
| `complete` | Set done, store outputPath/outputSize, notification, re-render |
| `error` | Set error, notification, re-render |
| `queued` | Update status, re-render |

**Reconnection:** Exponential backoff starting at 1s, doubling up to 30s max. Resets on successful connection.

#### trim.js — Trim Controls (~135 lines)

**Exported Functions:**
| Function | Purpose |
|----------|---------|
| `initTrim()` | Wire input/blur events on trim start/end fields |
| `setDuration(seconds)` | Set max duration, update placeholder |
| `getTrimSettings()` | Returns `{ start, end }` in seconds or null |
| `resetTrim()` | Clear inputs, reset duration |
| `secondsToTimecode(s)` | `→ "HH:MM:SS"` |
| `timecodeToSeconds(tc)` | `→ number or null` |

**Timecode Parsing:** Supports `H:MM:SS`, `M:SS`, or `S` formats

#### crop.js — Crop Presets (~100 lines)

**Presets:** none, 16:9, 4:3, 1:1, 9:16
**Exported Functions:** `initCrop()`, `setVideoSize(w, h)`, `getCropSettings() → { width, height, x, y } | null`
**Even-dimension alignment:** `Math.floor(n / 2) * 2` for codec compatibility

#### theme.js — Theme Toggle (~115 lines)

**Three-way toggle:** light / system / dark
**Storage:** `localStorage.getItem('theme')`
**OS detection:** `window.matchMedia('(prefers-color-scheme: dark')`
**Two-phase init:** Inline IIFE (prevents flash) + module (wires buttons)

---

## E) Data Flow Architecture

### File Upload → Compression → Output

```
1. User drops/browses/pastes file(s)
   → dragdrop.js validates video type
   → app.js: addFilesToQueue()

2. Upload phase
   → POST /api/upload (FormData)
   → Multer saves to OS temp dir
   → Response: { files: [{ path, name, size }] }

3. Probe phase
   → GET /api/probe?path=<serverPath>
   → ffprobe extracts metadata
   → Response: { duration, width, height, fps, codec, bitrate, ... }
   → File status: 'pending'

4. Preview (on selection)
   → GET /api/stream?path=<serverPath>
   → HTTP 206 range requests
   → Plyr player loads video

5. Compress
   → POST /api/compress { files, preset, codec, format, trim?, crop?, scale? }
   → For each file:
     → probe() → buildCommand() → jobQueue.addJob()
   → File status: 'compressing'

6. Real-time progress
   → FFmpeg stderr → parseProgress() → throttled 1s
   → JobQueue emits 'progress' → server broadcasts WebSocket
   → progress.js receives → filemanager.js: updateJobStatus()

7. Completion
   → FFmpeg exit 0 → stat output file size
   → JobQueue emits 'complete' → broadcast WebSocket
   → File status: 'done', shows original → compressed size comparison

8. Output
   → File saved as {name}_COMP.{ext} next to original
   → No separate download needed (local filesystem)
```

---

## F) Existing Capabilities Relevant to New Features

### What Already Exists That Can Be Extended

| Capability | Current Implementation | Extension Point |
|-----------|----------------------|-----------------|
| **Video trimming** | Start/end timecode inputs, FFmpeg `-ss`/`-to` flags | Can be enhanced with visual timeline slider per-clip |
| **Video cropping** | Aspect ratio presets (16:9, 4:3, 1:1, 9:16), FFmpeg `-vf crop` | Already functional |
| **Multi-file queue** | Up to 20 files, drag-drop + browse + path paste | Can add reordering for stitch |
| **File cards UI** | Status badges, progress bars, size comparison | Can add drag handles for reorder |
| **Video player** | Plyr with full controls, HTTP 206 streaming | Can be used for per-clip preview |
| **Metadata preservation** | `-map_metadata 0` + `-movflags +use_metadata_tags` | Need to ADD selective metadata stripping |
| **FFmpeg process management** | Spawn, progress parsing, cancel, concurrent queue | Can run exiftool similarly |
| **WebSocket real-time** | Progress, complete, error events | Can add stitch progress events |
| **Theme system** | Full dark/light with 100+ CSS variables | New tabs/modes inherit automatically |
| **Responsive layout** | Mobile-friendly breakpoints | Already handles small screens |

### What Does NOT Exist Yet

| Missing | Needed For |
|---------|-----------|
| **Tab/mode navigation** | Switching between Compress / Stitch / MetaScrub modes |
| **Drag-drop reordering** | Ordering clips for stitching |
| **FFmpeg concat** | Video stitching (`-f concat -c copy` with re-encode fallback) |
| **ExifTool integration** | Reading/writing metadata for stripping |
| **Metadata display UI** | Before/after metadata diff view |
| **Timeline slider** | Visual trim per-clip (current is text input only) |
| **Multi-file output** | Stitching produces one output from multiple inputs |

---

## G) NPM Scripts & Dev Workflow

```bash
npm start          # node server.js (production start)
npm run dev        # node --watch server.js (auto-reload on file changes)
npm run lint       # eslint . --ext .js
npm run lint:fix   # eslint . --ext .js --fix
npm run format     # prettier --write '**/*.{js,json,css,html}'
npm run format:check  # prettier --check '**/*.{js,json,css,html}'
npm run check      # lint + format check
npm run security   # npm audit
```

**No build step required.** Frontend is pure static files served by Express.

---

## H) Environment & Dependencies

**System Requirements:**
- macOS with Apple Silicon (M-series chip)
- Node.js v16+ (v22.18.0 installed)
- FFmpeg 7.1.1 via Homebrew (`/opt/homebrew/bin/ffmpeg`)
- ffprobe via Homebrew (`/opt/homebrew/bin/ffprobe`)

**No cloud services.** Everything runs locally at localhost:3000.

**No environment variables required** (PORT defaults to 3000, FFmpeg paths are hardcoded to Homebrew locations).

**No Docker/container.** Single-machine only.

---

## I) Planned New Features (Context from ChatGPT Conversation)

### Feature 1: Meta Ray-Ban Metadata Stripping

**Problem:** Instagram labels posts as "Made with Ray-Ban Meta" based on metadata embedded in HEIC photos and MOV videos from Ray-Ban Meta Smart Glasses.

**HEIC Photo Fields to Strip:**
| Field | Location | Example Value |
|-------|----------|---------------|
| Make | EXIF IFD0 | "Meta AI" |
| Camera Model Name | EXIF IFD0 | "Ray-Ban Meta Smart Glasses" |
| User Comment | EXIF SubIFD | UUID (device identifier) |
| Serial Number | EXIF SubIFD | "2Q" |

**MOV Video Fields to Strip (QuickTime Keys/mdta):**
| Field | Location | Example Value |
|-------|----------|---------------|
| Comment | Keys/mdta | `app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=<UUID>` |
| Model | Keys/mdta | "Ray-Ban Meta Smart Glasses" |
| Copyright | Keys/mdta | "Meta AI" |
| Description | Keys/mdta | "2Q" (serial) |
| Android Version | Keys/mdta | "14" |

**Two Scrub Modes:**
1. **Attribution only** (default): Remove Make/Model/Comment and obvious Meta branding tags
2. **Privacy mode**: Also remove UUIDs, serial numbers, SubSecTime*, AndroidVersion

**Tool:** ExifTool (Perl CLI or `exiftool-vendored` Node.js wrapper)

**ExifTool Commands (reference):**
```bash
# HEIC photo
exiftool -Make= -Model= -UserComment= -SerialNumber= \
  -SubSecTime= -SubSecTimeOriginal= -SubSecTimeDigitized= "photo.heic"

# MOV video
exiftool -Copyright= -Model= -Comment= -Description= \
  -AndroidVersion= -CreationDate= "video.mov"
```

### Feature 2: Video Stitching

**Problem:** Ray-Ban Meta glasses cap video at 3 minutes per clip. Need to concatenate clips into one longer video.

**Approach:**
1. Try lossless concat first: `ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4`
2. Fallback to re-encode if concat fails (mismatched codecs/timestamps)
3. Run MetaScrub on merged output
4. UI needs drag-drop reordering of clips

### Feature 3: Per-Clip Trim with Visual Slider

**Current state:** Text-based timecode inputs (`HH:MM:SS`) for a single file's start/end.
**Desired:** Visual slider/drag handles on each clip to set in/out points before stitching.

### Feature 4: Optional Compression During Stitch

**Current compression engine is fully built.** Just needs a toggle in the stitch workflow to optionally compress the merged output using existing preset/codec/quality settings.

---

## J) Integration Considerations for ChatGPT

When designing the integration guide, consider:

1. **This is a local app** — no cloud, no Firebase, no auth. Everything runs at localhost:3000 on macOS.

2. **No build step** — any new JS must be vanilla ES modules. No React, no TypeScript, no bundler.

3. **ExifTool needs to be installed** — `brew install exiftool` on macOS. The app should detect it at startup (similar to how `detectHWAccel()` works).

4. **Tab/mode navigation is the biggest UI change** — the current app is single-mode (compress). Adding Stitch and MetaScrub modes needs a tab system in the HTML.

5. **FFmpeg concat is already partially supported** — the app already manages FFmpeg child processes, progress parsing, and job queue. Adding concat commands follows the same pattern.

6. **The file card system needs drag-drop reorder** — currently cards are click-to-select only. Adding sortable drag handles is a frontend-only change.

7. **Output naming convention** — current: `{name}_COMP.{ext}`. For stitched: `{name}_STITCH.{ext}` or `{clip1}_{clip2}_MERGED.{ext}`. For scrubbed: `{name}_CLEAN.{ext}`.

8. **Preserve the existing compression feature perfectly** — new features are additive. The compress tab should work exactly as it does now.

9. **WebSocket protocol is extensible** — just add new `type` values like `'stitch-progress'`, `'scrub-complete'`, etc.

10. **The design system handles new components automatically** — `.glass-card`, `.preset-btn`, `.status-badge`, etc. are already themed for dark/light. New UI just uses existing CSS classes.
