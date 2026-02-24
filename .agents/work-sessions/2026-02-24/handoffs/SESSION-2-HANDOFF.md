# Session 2 Handoff -- Stack Inventory & Feature Planning
**Date:** 2026-02-24
**Agent:** Claude Opus 4.6 (session 2, research-only)
**Previous Session:** Same day, session 1 (built app, skills, CLAUDE.md)

---

## What This Session Did

**Research only -- zero code changes.**

1. Read the full ChatGPT conversation (`Docs/chat gpt chat.md` -- 2400+ lines) covering:
   - Meta Ray-Ban metadata research (exact EXIF/QuickTime fields from real samples)
   - MagFieldsWarRoom stack audit (Firebase Hosting + Cloud Run architecture)
   - Master build prompts for a cloud-deployed "MetaScrub + Stitch" app
   - Task manifests and multi-agent charters

2. Launched 3 parallel agent teams to inventory the entire stack:
   - Backend agent: server.js, lib/ffmpeg.js, lib/jobQueue.js, lib/probe.js, lib/hwaccel.js
   - Frontend agent: all 11 JS modules, HTML, CSS design system
   - Infrastructure agent: package.json, eslint, prettier, gitignore, start.command

3. Wrote `Docs/STACK_INVENTORY_FOR_GPT.md` -- a 700+ line comprehensive inventory covering:
   - Stack diagram, tech stack table, project structure
   - Complete backend architecture (all 8 API routes with shapes)
   - Complete frontend architecture (all 11 modules with every exported function)
   - FFmpeg preset matrix, hardware acceleration, job lifecycle
   - Data flow diagrams
   - Existing capabilities vs gaps for new features
   - Integration considerations for ChatGPT

4. Reviewed all 5 skills and the updated CLAUDE.md from session 1.

---

## Key Findings & Concerns

### 1. The metadata-tools skill has gaps for the Meta scrub feature

The current `metadata-tools` SKILL.md:
- Only covers **FFmpeg-based** metadata operations (`-map_metadata`, ffprobe)
- Lists incorrect fields for Meta glasses in the "Future" section (says `com.apple.quicktime.*` fields)
- Does **not mention ExifTool** at all

The ChatGPT research (with actual exiftool dumps from real Ray-Ban Meta samples) showed:

**HEIC photos -- stored in EXIF IFD0 and SubIFD:**
| Field | Value |
|-------|-------|
| EXIF:Make | "Meta AI" |
| EXIF:Model / CameraModelName | "Ray-Ban Meta Smart Glasses" |
| EXIF:UserComment | UUID (device identifier) |
| EXIF:SerialNumber | "2Q" |

**MOV videos -- stored in QuickTime Keys/mdta atoms (NOT com.apple.quicktime):**
| Field | Value |
|-------|-------|
| Keys:Comment | `app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=<UUID>` |
| Keys:Model | "Ray-Ban Meta Smart Glasses" |
| Keys:Copyright | "Meta AI" |
| Keys:Description | "2Q" (serial) |
| Keys:AndroidVersion | "14" |

**Why FFmpeg alone won't work:** FFmpeg can't surgically read/write EXIF Make/Model on HEIC files or QuickTime Keys/mdta atoms. ExifTool (Perl CLI or `exiftool-vendored` npm package) is required for this.

### 2. Can we build the Meta scrub locally without GPT's response?

**Yes, we have enough information.** The ChatGPT conversation contains:
- Exact metadata fields from real sample files (confirmed by exiftool dumps)
- ExifTool commands that work (`exiftool -Make= -Model= -UserComment= ...`)
- Two scrub modes defined (Attribution only vs Privacy mode)
- Value-matching regex: `/(meta|ray-?ban|meta ai|meta view)/i`
- The architectural approach: read metadata JSON, decide removals, write only those

**What we'd need to add to this stack:**
1. Install ExifTool: `brew install exiftool` (or add `exiftool-vendored` as npm dependency)
2. Detect ExifTool at startup (same pattern as `detectHWAccel()`)
3. New backend module: `lib/exiftool.js` -- read metadata JSON, compute removals, write
4. New API routes: `POST /api/scrub`, `GET /api/metadata?path=`
5. New frontend tab/mode for MetaScrub
6. New skill: `.claude/skills/meta-scrub/SKILL.md`

**What we DON'T have yet:**
- A decision on whether this should be a **local feature** (added to this app) or a **separate cloud app** (the MagFieldsWarRoom Firebase stack approach from the ChatGPT conversation)
- The user mentioned wanting it in this app as "another mode/tab" -- so local seems right
- No sample HEIC/MOV files in this repo to test with (samples exist on the user's device)

### 3. Video stitching -- what exists vs what's needed

**Exists in this stack:**
- FFmpeg process management (spawn, progress parsing, job queue)
- Multi-file queue UI (drag-drop, file cards, status tracking)
- Video trimming (start/end timecodes)
- Video cropping (aspect ratio presets)
- WebSocket real-time progress

**Does NOT exist:**
- FFmpeg concat demuxer usage (`-f concat -safe 0 -i list.txt -c copy`)
- Drag-drop **reordering** (current cards are click-to-select only, no sortable)
- Per-clip trim with visual sliders (current trim is text-based for one file)
- Tab/mode navigation (current app is single-mode compress)
- Stitch-specific API route
- Re-encode fallback when stream copy concat fails

### 4. The CLAUDE.md and skills are solid but need updates

The session-1 CLAUDE.md (478 lines) is comprehensive for the **compression feature**. For new features, it needs:
- Section 10 "Future Plans" updated with concrete specs (not vague)
- New skills for meta-scrub and stitch-videos
- Update metadata-tools skill with ExifTool knowledge

---

## What GPT Is Working On (Context)

The ChatGPT conversation was about building a **separate cloud-deployed app** (Firebase Hosting + Cloud Run + Firestore) for MetaScrub + Stitch. The user then pivoted to wanting these features **integrated into this local app instead**.

GPT was asked to produce:
- A requirements doc
- An architecture doc
- A task manifest
- Multi-agent charters

GPT produced all of these (visible in the chat), but they're designed for a **Firebase cloud stack**, not this local Express app. The integration approach needs to be adapted:

| GPT's Design | This App's Reality |
|-------------|-------------------|
| Firebase Hosting + Cloud Run | Express at localhost:3000 |
| Firestore for job tracking | In-memory Map in jobQueue.js |
| Firebase Storage for blobs | Local filesystem (multer temp dir) |
| Firebase Auth (Google) | No auth needed (local single-user) |
| Cloud Tasks for async jobs | p-queue already handles this |
| ExifTool in Docker container | ExifTool via Homebrew |
| React + TypeScript + Vite | Vanilla JS + Tailwind CDN |

The `Docs/STACK_INVENTORY_FOR_GPT.md` was written to give GPT this context so it can **rewrite its integration guide for the local stack**.

---

## Recommended Next Steps (Priority Order)

### Immediate (this stack, no GPT needed)

1. **Update metadata-tools skill** with ExifTool knowledge and correct Meta Ray-Ban fields
2. **Create meta-scrub skill** with the two scrub modes (attribution / privacy)
3. **Create stitch-videos skill** with concat workflow
4. **Add tab navigation to the UI** -- this is the biggest architectural change, needed before either new feature
5. **Test the smart bitrate capping fix** -- user hasn't re-tested since session 1 applied it

### After GPT Responds

6. **Review GPT's integration guide** -- it should now produce a local-stack-aware version
7. **Implement MetaScrub backend** -- `lib/exiftool.js` + new API routes
8. **Implement Stitch backend** -- FFmpeg concat in `lib/ffmpeg.js` + new API route
9. **Implement MetaScrub UI** -- new tab with file upload, scrub mode selector, before/after diff
10. **Implement Stitch UI** -- new tab with drag-drop reordering, per-clip trim sliders

### Known Blockers

- **ExifTool must be installed** (`brew install exiftool`) before any metadata stripping dev
- **Tab navigation is a prerequisite** for both new features
- **No sample Meta files in this repo** -- need to copy sample HEIC/MOV from user's device for testing
- **Custom preset backend support** (from session 1 known issues) still needs to be wired

---

## Files Created/Modified This Session

| File | Action | Purpose |
|------|--------|---------|
| `Docs/STACK_INVENTORY_FOR_GPT.md` | Created | 700+ line inventory for ChatGPT Pro |
| This file | Created | Session handoff |

**No code was modified.** This was a research-only session.

---

## How to Resume

1. Read `CLAUDE.md` for full project context
2. Read `Docs/STACK_INVENTORY_FOR_GPT.md` for the inventory that was produced
3. Read `Docs/chat gpt chat.md` for the ChatGPT conversation with metadata research
4. Check if GPT has responded with an integration guide -- if so, adapt it for this local stack
5. The first code change should be **adding tab navigation to index.html** to support multiple modes
