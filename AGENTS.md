# Video Compressor -- Agent Instructions

This file is read by ALL agents (Claude Code teammates, Codex, and any agent following the Agent Skills open standard) on startup. It defines the complete project context, conventions, and multi-agent coordination rules.

---

## 1. Coordination Rules (MANDATORY)

### Parallel Work

For tasks with 2+ independent workstreams, prefer parallel execution over sequential. Break work into parallel tracks when:

- Multiple files or modules can be worked on independently
- Cross-layer changes span frontend, backend, and lib/ separately
- Research + implementation can happen concurrently
- Any task has parallelizable parts that would save time

For simple single-file fixes, just do it directly.

### File Ownership

**Never edit the same file from two parallel workers.** Assign clear ownership:

| Domain | Owner Role | Files |
|--------|-----------|-------|
| Backend API + FFmpeg | ffmpeg-expert | server.js, lib/*.js |
| Frontend UI + CSS | frontend-builder | public/**/* |
| Compression quality | compression-diagnostics | Analysis + recommendations |
| Documentation | scribe | CLAUDE.md, AGENTS.md, .agents/**/*.md |
| Code quality | code-reviewer | Review all changes before commit |

### Task Discipline

- Break work into 3-6 self-contained tasks with clear deliverables
- Never have two workers editing the same file simultaneously
- Finish one task fully before starting the next
- Log every task to AI-CHAT-LOG.md with agent identification (see Section 10)

### Skills (shared across all agents)

This project uses the Agent Skills open standard (agentskills.io). Skills are available at:
- .claude/skills/ (Claude Code)
- .codex/skills/ (Codex)

Available skills: compress-video, diagnose-compression, batch-process, optimize-quality, metadata-tools. Use them when the task matches their trigger description (see Section 5).

---

## 2. Project Overview

A local video compression application with a web-based UI that leverages FFmpeg and Apple Silicon hardware acceleration (VideoToolbox). Designed for macOS with M-series chips, it provides drag-and-drop batch video compression with real-time progress monitoring via WebSocket.

**URL:** http://localhost:3000 (or PORT=4000 node server.js)
**Root:** /Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR

### How to Run

```bash
npm install          # first time only
node server.js       # start on port 3000
PORT=4000 node server.js   # alternate port
# or double-click start.command in Finder
```

### Prerequisites

- Node.js >= 18 (ES modules required)
- FFmpeg >= 7.x at /opt/homebrew/bin/ffmpeg
- FFprobe at /opt/homebrew/bin/ffprobe
- macOS with Apple Silicon (M1/M2/M3) for hardware acceleration (software fallback works anywhere)

---

## 3. Architecture

### File Structure

```
VIDEO COMPRESSOR/
  server.js                  # Express server, WebSocket, all API routes
  package.json               # Dependencies, scripts, ES module config
  start.command              # macOS double-click launcher
  CLAUDE.md                  # Claude Code project docs
  AGENTS.md                  # This file -- agent instructions (read by Codex + Claude teams)
  eslint.config.js           # Flat ESLint config (ES2024, browser+node globals)
  .prettierrc                # Single quotes, trailing commas, 100 char width
  lib/
    ffmpeg.js                # FFmpeg command builder, quality presets, bitrate capping
    probe.js                 # ffprobe metadata extraction (flat format)
    hwaccel.js               # VideoToolbox detection + encoder fallback mapping
    jobQueue.js              # p-queue wrapper (concurrency:4), progress parsing, events
  public/
    index.html               # Single-page app (Tailwind CDN, Plyr CDN)
    css/styles.css           # Theme system (CSS custom properties, light/dark, glassmorphism)
    js/
      app.js                 # Main orchestrator: state, upload, compression dispatch
      compression.js         # Settings: codec/preset/format/resolution/estimation/custom
      filemanager.js         # File cards, per-video resolution, progress bars
      progress.js            # WebSocket client, auto-reconnect
      player.js              # Plyr video player (preview, playback)
      trim.js                # Trim start/end time controls
      crop.js                # Crop presets (aspect ratio, even dimensions)
      dragdrop.js            # Drag-and-drop, file input, path input
      theme.js               # Theme toggle (light/system/dark), localStorage
  .claude/
    settings.local.json      # Permissions (allow/deny/ask), hooks, env vars
    agents/                  # Agent team definitions (YAML frontmatter)
      ffmpeg-expert.md       # FFmpeg, codec selection, HW accel specialist
      frontend-builder.md    # UI/UX, vanilla JS, Tailwind, Plyr
      compression-diagnostics.md  # Diagnose poor compression, bitrate analysis
      scribe.md              # Lightweight docs agent (haiku model)
      code-reviewer.md       # Code review, ESLint, security (plan mode)
    commands/                # Slash commands
      compress.md            # /compress -- quick compression workflow
      diagnose.md            # /diagnose -- compression quality diagnostics
      status.md              # /status -- server/project status check
    hooks/                   # Hook shell scripts (PreToolUse, PostToolUse, etc.)
      block-node-modules.sh  # Block editing node_modules/
      block-package-lock.sh  # Block editing package-lock.json
      block-destructive-git.sh  # Block force push, reset --hard, etc.
      auto-prettier.sh       # Auto-format on edit (.js/.css/.html/.json)
      auto-eslint.sh         # Auto-lint on edit (.js)
      syntax-check.sh        # node --check on backend files
      backend-restart-notice.sh  # Remind to restart server
      session-log-prompt.sh  # Log user prompts to session activity
      session-log-stop.sh    # Log session end
    skills/                  # Progressive Disclosure skills (3-level, Agent Skills open standard)
      compress-video/SKILL.md
      diagnose-compression/SKILL.md
      batch-process/SKILL.md
      optimize-quality/SKILL.md
      metadata-tools/SKILL.md
    plans/                   # Plan mode output directory
  .codex/
    skills/                  # Same skills mirrored for Codex discovery
      compress-video/SKILL.md
      diagnose-compression/SKILL.md
      batch-process/SKILL.md
      optimize-quality/SKILL.md
      metadata-tools/SKILL.md
  .agents/
    work-sessions/           # Per-day session logs and handoffs
    skills/                  # Archive copy of skills
    plans/                   # Agent team plans
```

### Data Flow

```
[Browser] --> POST /api/upload --> [Multer] --> temp file with extension
          --> GET /api/probe   --> [ffprobe] --> JSON metadata (flat format)
          --> POST /api/compress --> [buildCommand] --> [JobQueue.addJob]
                                                         |
                                    [PQueue concurrency:4] --> [FFmpeg spawn]
                                                                    |
                                    [stderr progress parsing] --> [throttle 1s]
                                                                    |
                                    [WebSocket broadcast] --> [Browser UI update]
```

---

## 4. Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Backend Runtime | Node.js | ES modules ("type": "module"), top-level await |
| HTTP Framework | Express 4.21 | JSON body parser, static file serving |
| WebSocket | ws 8.18 | Real-time progress, auto-reconnect on client |
| File Upload | multer 1.4.5 | Multipart form data, 50GB limit, temp dir |
| Job Queue | p-queue 8.0 | Concurrency: 4 (M2 Max dual encode engines) |
| Unique IDs | uuid 10.0 | UUIDv4 for job identifiers |
| Video Engine | FFmpeg 7.1.1 | System-installed at /opt/homebrew/bin/ffmpeg |
| Frontend CSS | Tailwind CSS (CDN) | No build step, utility classes |
| Video Player | Plyr (CDN) | Custom-themed video player |
| Linting | ESLint 10.x | npm run lint |
| Formatting | Prettier 3.8 | npm run format |

### npm Scripts

```bash
npm start           # node server.js
npm run dev          # node --watch server.js (auto-restart)
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
npm run check        # lint + format:check
npm run security     # npm audit
```

---

## 5. Agent Definitions

### Agents (.claude/agents/)

Each agent has YAML frontmatter with name, description, tools, model, permissionMode.

| Agent | Model | Purpose |
|-------|-------|---------|
| ffmpeg-expert | sonnet | FFmpeg commands, codec selection, VideoToolbox HW accel, CRF tuning |
| frontend-builder | sonnet | Vanilla JS, CSS custom properties, Plyr, drag-and-drop, WebSocket |
| compression-diagnostics | sonnet | Diagnose poor results, bitrate analysis, preset validation |
| scribe | haiku | Lightweight: AI-CHAT-LOG, CHANGELOG, HANDOFF, session summaries |
| code-reviewer | sonnet | Bug review, security (XSS, path traversal), ESLint, plan mode |

### Skills (.claude/skills/ and .codex/skills/)

Progressive Disclosure framework (3 levels: YAML frontmatter, workflow steps, deep knowledge). Skills follow the Agent Skills open standard (agentskills.io) -- compatible with Claude Code, Codex, Cursor, and other tools.

| Skill | Trigger | Description |
|-------|---------|-------------|
| compress-video | "compress this video" | Full compression workflow: analyze, configure, estimate, compress, verify |
| diagnose-compression | "output is bigger" | Diagnose poor compression results, identify root causes, suggest fixes |
| batch-process | "compress all files" | Multi-file workflow: scan, probe, group, configure per-file, queue, monitor |
| optimize-quality | "best quality setting" | Content analysis, preset comparison, CRF explanation, quality/size tradeoffs |
| metadata-tools | "show metadata" | Inspect/preserve/strip video metadata |

### Commands (.claude/commands/) -- Claude Code only

| Command | Description |
|---------|-------------|
| /compress | Check server, pick file/preset/resolution, run compression, report results |
| /diagnose | Probe input/output, compare bitrates, check presets, suggest fixes |
| /status | Server status, FFmpeg version, Node version, dependencies, disk, lint check |

### Safety Rules (ALL agents must follow)

Regardless of which tool you're running in, these rules apply:

- **Never edit node_modules/** -- install packages via npm instead
- **Never edit package-lock.json** directly -- use npm install/uninstall
- **Never force push** -- no git push --force, reset --hard, clean -f, branch -D
- **Never commit .env, secrets, credentials, PEM/key files**
- **Run npx prettier --write on any .js/.css/.html/.json file after editing**
- **Run npx eslint on any .js file after editing**
- **Run node --check on server.js and lib/*.js after editing** to catch syntax errors
- **Restart the server** after modifying server.js or any lib/*.js file

Claude Code enforces these via hooks in .claude/hooks/. Codex agents must follow them manually.

---

## 6. API Reference

### POST /api/upload

Upload video files. multipart/form-data with field "file" (up to 20 files).

**Response:**
```json
{ "files": [{ "path": "/tmp/.../abc123.mp4", "name": "original.mp4", "size": 52428800 }] }
```

### GET /api/probe?path=<encoded_path>

Video metadata via ffprobe. Returns flat format:

```json
{
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "fps": 29.97,
  "codec": "h264",
  "bitrate": 8500000,
  "size": 127893504,
  "format": "mov,mp4,m4a,3gp,3g2,mj2",
  "audioCodec": "aac"
}
```

### POST /api/compress

Start compression job(s).

**Required:** files, preset, codec, format
**Optional:** scale, trim, crop, crf, speed

```json
{
  "files": [{ "path": "/path/to/video.mp4", "name": "video.mp4" }],
  "preset": "balanced",
  "codec": "h265",
  "format": "mp4",
  "scale": "720p",
  "crf": 28,
  "speed": "medium"
}
```

**Response:**
```json
{
  "jobs": [
    { "id": "uuid", "status": "queued", "inputPath": "...", "outputPath": "...", "fileName": "..." }
  ]
}
```

### GET /api/stream?path=<encoded_path>

Video streaming with HTTP range request support. Returns binary stream with appropriate MIME type.

### GET /api/thumbnail?path=<path>&time=<timecode>&width=<px>

JPEG thumbnail. Defaults: time=00:00:02, width=320. Returns image/jpeg with 1-hour cache.

### GET /api/jobs

List all jobs with status, progress, sizes.

```json
{
  "jobs": [{
    "id": "uuid", "status": "running", "inputPath": "...", "outputPath": "...",
    "percent": 45.2, "fps": 120, "speed": 4.2, "eta": 30,
    "originalSize": 127893504, "compressedSize": 0
  }]
}
```

### DELETE /api/jobs/:id

Cancel a queued or running job. Returns 409 if already completed.

### GET /api/hwaccel

Hardware acceleration capabilities:
```json
{ "h264_videotoolbox": true, "hevc_videotoolbox": true, "prores_videotoolbox": true }
```

### WebSocket (same port as HTTP)

| Event | Payload |
|-------|---------|
| progress | { type, jobId, percent, speed, fps, eta } |
| complete | { type, jobId, outputPath, outputSize, compressedSize } |
| error | { type, jobId, error } |

---

## 7. FFmpeg Presets

### Quality Presets

**Hardware (VideoToolbox) -- bitrate-based:**

| Encoder | max | balanced | small | streaming |
|---------|-----|----------|-------|-----------|
| h264_videotoolbox | 20000k, high profile | 8000k, high profile | 4000k, main profile | 5000k, high profile |
| hevc_videotoolbox | 12000k, hvc1 tag | 6000k, hvc1 tag | 3000k, hvc1 tag | 4000k, hvc1 tag |
| prores_videotoolbox | Profile 3 (HQ) | Profile 2 (Standard) | Profile 1 (LT) | Profile 2 |

**Software -- CRF-based:**

| Encoder | max | balanced | small | streaming |
|---------|-----|----------|-------|-----------|
| libx264 | CRF 18, slow | CRF 23, medium | CRF 28, medium | CRF 23, fast |
| libx265 | CRF 22, slow, hvc1 | CRF 28, medium, hvc1 | CRF 32, medium, hvc1 | CRF 28, fast, hvc1 |
| libsvtav1 | CRF 25, preset 4 | CRF 30, preset 6 | CRF 38, preset 8 | CRF 35, preset 6 |
| prores_ks | Profile 3 | Profile 2 | Profile 1 | Profile 2 |

### Custom Preset

When preset=custom, CRF and speed are passed directly:
- VideoToolbox encoders: CRF mapped to bitrate (CRF 0 = ~30Mbps, CRF 51 = ~500kbps), capped at 90% of source
- libx264/libx265: CRF + speed preset passed through directly
- libsvtav1: CRF + speed mapped to SVT-AV1 preset numbers (veryslow=2, slow=4, medium=6, fast=8, ultrafast=12)
- ProRes: CRF mapped to profile (0-15=HQ, 16-28=SQ, 29-40=LT, 41+=Proxy)

### Smart Bitrate Capping

Prevents HW encoder output from exceeding input size:

| Preset | Cap | Effect |
|--------|-----|--------|
| max | None | Full target bitrate |
| balanced | 70% of source | min(target, source * 0.7) |
| streaming | 50% of source | min(target, source * 0.5) |
| small | 40% of source | min(target, source * 0.4) |

### Audio Settings

| Video Codec | Audio Codec | Bitrate |
|-------------|-------------|---------|
| H.264 / H.265 | AAC | 256k (max) / 192k (others) |
| ProRes | PCM S16LE | Uncompressed |
| AV1 | libopus | 128k |

### Codec-Format Compatibility

| Codec | MP4 | MOV | MKV |
|-------|-----|-----|-----|
| H.264 | yes | yes | yes |
| H.265 | yes | yes | yes |
| AV1 | yes | -- | yes |
| ProRes | -- | yes | -- |

### Resolution Scaling

| Target | Height | Filter |
|--------|--------|--------|
| original | unchanged | (none) |
| 1080p | 1080 | scale=-2:1080 |
| 720p | 720 | scale=-2:720 |
| 480p | 480 | scale=-2:480 |
| 360p | 360 | scale=-2:360 |

Width uses -2 for automatic even-number calculation. Upscaling is blocked in the UI.

### Metadata Preservation

All formats: -map_metadata 0 (copy global metadata)
MP4/MOV: -map 0 (all streams) + -movflags +faststart+use_metadata_tags
MKV: -map 0:v -map 0:a? (video + optional audio only)

---

## 8. Conventions (ALL agents must follow)

### Code Style

- **ES Modules everywhere** -- import/export, never require(). "type": "module" in package.json.
- **No frontend frameworks** -- Vanilla JS + DOM APIs. No React/Vue.
- **Tailwind via CDN** -- No build step.
- **FFmpeg via spawn** -- Always child_process.spawn(), never exec(). Prevents shell injection.
- **Async/await** throughout. Top-level await in server.js.

### Module Patterns

- Each frontend JS file exports an init*() function called from app.js DOMContentLoaded
- app.js owns the central appState object; other modules import from app.js
- Backend modules are pure functions (except JobQueue class extending EventEmitter)
- probe.js uses execFile (promisified, bounded output); jobQueue.js uses spawn (streaming)

### Naming

- CSS: --category-name custom properties, themed-* utility classes
- JS: camelCase for variables/functions, PascalCase for classes
- Files: lowercase with hyphens (e.g., jobQueue.js, dragdrop.js)
- API: RESTful /api/resource with JSON responses
- Output files: {original}_COMP.{ext} next to source (no subfolder)

### Theme System

- CSS custom properties on :root / [data-theme='dark'] / [data-theme='light']
- 3-way toggle (Light/System/Dark) with localStorage persistence
- All color values reference CSS variables -- no hardcoded colors in component styles
- themed-* utility classes override Tailwind inline colors for theme adaptation

### Error Handling

- Backend: Express error responses as { error: "message" } with appropriate HTTP status
- Frontend: showNotification(message, type) for user-visible errors
- WebSocket: Auto-reconnect with exponential backoff (1s to 30s max)
- FFmpeg: Exit code checked; stderr captured for error diagnosis

---

## 9. Known Issues

- **Already-compressed files**: VideoToolbox fixed-bitrate may produce same/larger files for low-bitrate sources. Smart bitrate capping mitigates but doesn't eliminate. Use software encoders (CRF mode) for already-compressed content, or use the small preset which caps at 40%.
- **Estimation accuracy**: HW encoder estimates based on target bitrate; CRF estimates use fixed ratios. Can be off by 20-40%.
- **Read-only source dirs**: Output goes next to source as _COMP suffix. Fails if source dir is read-only.
- **No upload progress**: FormData upload is fire-and-forget. Could add XHR with progress events.
- **Bitrate targeting precision**: VideoToolbox output may overshoot/undershoot target by 10-30%, especially on short clips.

---

## 10. Work Session Protocol (MANDATORY for all agents)

Session docs live at .agents/work-sessions/YYYY-MM-DD/. Create the folder for today if it doesn't exist.

### Files to maintain:

1. **AI-CHAT-LOG.md** -- Every action logged with agent identification
2. **CHANGELOG.md** -- Reverse-chronological feature/fix log with agent identification
3. **HANDOFF.md** -- Session handoff for next agent
4. **CARRYOVER-PROMPT.md** -- Full context dump for new chat sessions
5. **session-activity.log** -- Auto-generated by hooks (Claude Code only)

Use the scribe agent (haiku model) for documentation tasks to save tokens.

### Agent Identification Protocol

Every entry in AI-CHAT-LOG.md and CHANGELOG.md or even the task-manifests in the work sessions folders MUST include:

```
[YYYY-MM-DD HH:MM IST] [AGENT-TYPE/MODEL] [TAG] Description
```

**AGENT-TYPE** (required -- describes the role, not the tool):
- solo -- single agent session working alone
- lead -- lead agent coordinating parallel workers
- teammate:NAME -- worker assigned to a domain (e.g., teammate:ffmpeg-expert)
- subagent -- delegated worker that returns results to the caller
- codex -- OpenAI Codex session

**MODEL** (required):
- opus, sonnet, haiku (Claude Code)
- o3, o4-mini (Codex)

**TAG** (required here are some options/examples):
- [BUILD] -- new code/files from scratch
- [FIX] -- bug fix
- [FEATURE] -- new feature added to existing code
- [DOCS] -- documentation only
- [REFACTOR] -- restructuring without behavior change
- [PERF] -- performance optimization
- [TEST] -- testing/verification
- [INFRA] -- project config, settings, hooks, CI

### Example AI-CHAT-LOG Entry

```
[2026-02-24 14:30 IST] [lead/opus] [FEATURE] Added MetaClean tab navigation
  Actions: Created public/js/tabs.js, modified index.html
  Files: public/js/tabs.js (new), public/index.html (modified)
  Status: Complete

[2026-02-24 14:32 IST] [teammate:ffmpeg-expert/sonnet] [BUILD] Created lib/exiftool.js
  Actions: Implemented detectExifTool(), readMetadataJson(), writeCleanCopy()
  Files: lib/exiftool.js (new)
  Status: Complete

[2026-02-24 15:00 IST] [codex/o3] [FIX] Fixed bitrate capping for small preset
  Actions: Updated adjustBitrate() ratio from 0.5 to 0.4
  Files: lib/ffmpeg.js (modified)
  Status: Complete
```

### Rules

- **Never leave anonymous entries** -- always identify yourself with AGENT-TYPE/MODEL
- **Log before AND after** -- log what you plan to do, then update with result
- **Include file paths** -- list every file created or modified
- **Use IST timezone** (Indian Standard Time, UTC+5:30)

---

## 11. Future Plans

- **MetaClean tab** -- Metadata stripping for Meta Ray-Ban glasses footage (exiftool-based, spec in AUTOPILOT-BUILD-HANDOFF.md)
- **Stitch tab** -- Video concatenation with per-clip trim, drag-and-drop reorder
- **Download endpoint** -- GET /api/download?path= for phone workflows
- **Output directory config** -- User-selectable output location
- **Compression comparison** -- Sample multiple settings and compare quality/size side-by-side
- See .agents/work-sessions/2026-02-24/handoffs/AUTOPILOT-BUILD-HANDOFF.md for the full build plan
