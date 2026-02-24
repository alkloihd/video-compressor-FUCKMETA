# AUTOPILOT BUILD HANDOFF -- MetaClean + Stitch + Performance Fix

**Date:** 2026-02-24 (session 2 final, updated session 3)
**For:** Next Claude Code session
**Project:** `/Users/rishaal/CODING/CODED TOOLS/VIDEO COMPRESSOR`

---

## SESSION WORKFLOW: Plan First, Then Build

**Step 1: PLAN MODE** -- Start in plan mode. Read the reference docs, then produce:
- Requirements document (what needs to be built, acceptance criteria)
- Design document (architecture decisions, module interfaces, data flow)
- Task manifest (phased task list with assignments, dependencies, estimates)

**Step 2: REVIEW** -- Present the plan for user approval before writing any code.

**Step 3: BUILD** -- After plan approval, execute tasks from the manifest. Each agent working on a task MUST:
- Log their work in `AI-CHAT-LOG.md` (agent identity, timestamp IST 24hr, what they did)
- Update `CHANGELOG.md` when features/fixes are completed
- Comment in the task manifest: who did it, observations, blockers, notes for other agents

**Step 4: QA** -- Verification checklist at the end.

---

## READ FIRST (in order)

1. `CLAUDE.md` -- 478-line project docs (architecture, API, presets, conventions)
2. `Docs/chatgpt_new_response.md` -- GPT Pro's refined build plan (the blueprint)
3. `Docs/STACK_INVENTORY_FOR_GPT.md` -- Complete stack inventory (reference)
4. This file -- actionable build instructions

---

## DOCUMENTATION PROTOCOL (all agents must follow)

### AI-CHAT-LOG.md (`.agents/work-sessions/2026-02-24/AI-CHAT-LOG.md`)
Every agent entry MUST include:
- `[YYYY-MM-DD HH:MM IST]` timestamp
- Agent identity: `agentName/model` (e.g., `ffmpeg-expert/sonnet`, `frontend-builder/opus`)
- Task reference from manifest (e.g., `[TASK 0a]`, `[TASK 3.2]`)
- Actions taken, findings, files modified
- Status: Complete / In Progress / Blocked

### CHANGELOG.md (`.agents/work-sessions/2026-02-24/CHANGELOG.md`)
Append under a new `## [1.1.0]` section as features/fixes land.

### Task Manifest (`.agents/work-sessions/2026-02-24/TASK-MANIFEST.md`)
Create this during plan mode. Each task row has columns for:
- Task ID, Description, Phase, Assigned Agent, Status
- **Agent Notes** column: observations, gotchas, decisions made, blockers encountered
- Update in real-time as work progresses

---

## CRITICAL BUG #1: HW Badge Shows Wrong State (CONFIRMED)

**Bug location:** `public/js/compression.js:117` in `updateHWBadge()`

The server returns HW capabilities as `{ h264_videotoolbox: true, hevc_videotoolbox: true, prores_videotoolbox: true }` but the frontend checks `hwInfo.videotoolbox` (a key that doesn't exist). Result: badge always shows "Software encoding only" even though HW encoding works fine.

Same bug in `updateHWIndicators()` at line ~145 -- checks `hwInfo.videotoolbox` instead of `hwInfo.h264_videotoolbox` etc. Codec buttons never show the green HW dot.

**Fix:** Change `hwInfo.videotoolbox` to `hwInfo.h264_videotoolbox || hwInfo.hevc_videotoolbox || hwInfo.prores_videotoolbox` in `updateHWBadge()`. Fix each codec check in `updateHWIndicators()` to use the specific keys.

Note: Actual encoding IS using HW correctly (lib/ffmpeg.js checks the right keys). This is a display-only bug.

---

## CRITICAL BUG #2: Compression can make files BIGGER

**Root cause (confirmed from session 1 testing):**
- Balanced preset forces 6 Mbps target bitrate via VideoToolbox
- If the source file is already H.264/H.265 at 4-5 Mbps, re-encoding at 6 Mbps makes it BIGGER
- Smart bitrate capping (lib/ffmpeg.js `adjustBitrate()`) caps at 70% of source for balanced, but if source is already low bitrate, the cap still allows a higher target
- Session 1 test results: ProRes file got -90% (great), but already-compressed files got +24% to +34% bigger

**Fix needed:** Before compression, compare target bitrate against source bitrate. If source is already at or below target, either skip re-encoding or use a lower CRF-based approach.

---

## CRITICAL BUG #3: Compression is painfully slow on 230MB file

A 230MB file takes forever. The HW acceleration IS available (confirmed: h264_videotoolbox, hevc_videotoolbox, prores_videotoolbox all detected). Investigate:

**Diagnostic steps:**
1. Run the app: `node server.js`
2. Open browser, add a test file, check what codec/preset is selected
3. Check server console -- HW should show Available
4. Probe the file: GET /api/probe?path=file -- check bitrate, resolution, codec
5. If the file is 4K, resolution downscale would help
6. If AV1 codec is selected (libsvtav1 is 0.3-0.8x realtime), switch to H.264/H.265
7. Check if slow/veryslow preset is being used

---

## PARALLEL CHAT: Another session is upgrading agents/skills/hooks/CLAUDE.md

A separate Claude Code session is working on improving the .claude/ infrastructure:
- Upgrading agent definitions in .claude/agents/
- Improving skills in .claude/skills/
- Refining hooks in .claude/hooks/
- Updating CLAUDE.md

**Do NOT modify these files** unless fixing something broken. The other chat owns them.
If you see outdated skills (e.g., metadata-tools references wrong fields), note it but don't fix it -- the other chat handles that.

---

## EXISTING SKILLS TO BE AWARE OF (in .claude/skills/)

5 skills already exist. The next builder session will auto-invoke them when relevant:
- `compress-video/SKILL.md` -- Full compression workflow (solid)
- `diagnose-compression/SKILL.md` -- Diagnostic decision tree (solid)
- `batch-process/SKILL.md` -- Multi-file batch processing (solid)
- `optimize-quality/SKILL.md` -- CRF vs bitrate optimization (solid)
- `metadata-tools/SKILL.md` -- **HAS WRONG FIELDS**: lists com.apple.quicktime.* but real Meta Ray-Ban fields are EXIF:Make, Keys:Comment etc. Also doesn't mention ExifTool. The other chat is fixing this.

---

## CLAUDE.md IS ALREADY COMPREHENSIVE (478 lines)

CLAUDE.md was massively upgraded from 46 to 478 lines in session 1. It contains:
- Full architecture, file structure, data flow diagrams
- Complete API reference with request/response shapes for all 8 endpoints
- FFmpeg preset matrices (HW bitrate targets, SW CRF values)
- Hardware acceleration details
- All agent/skill/hook/command documentation
- Known issues and conventions

**Reference it, don't rebuild it.** Only add new sections for MetaClean/Stitch routes after building them.

---

## USER PREFERENCES (from chat history)

1. **Output location**: Files go NEXT TO the source, NOT in a subfolder. Use suffixes: _COMP, _CLEAN, _STITCH
2. **Metadata preservation**: Default = preserve EVERYTHING. Only strip what's explicitly targeted (Meta glasses fields)
3. **Never run `exiftool -all=`**: Surgical removal only
4. **Tab-based UI**: Same page, show/hide sections. No routing, no separate pages
5. **Compression preview**: Show estimated output size and quality tradeoffs BEFORE job starts (already built in compression.js -- `updateEstimation()` and `updateTradeoffInfo()`)
6. **Start in plan mode**: Produce requirements + design + task manifest FIRST. Get user approval. Then build.
7. **Document everything**: Every agent logs to AI-CHAT-LOG.md and annotates the task manifest with observations

---

## WHAT TO BUILD (3 features, additive, don't break Compress)

### Feature 1: Tab Navigation (PREREQUISITE -- build first)

Add 3 tabs to the same page (no routing):
- **Compress** (existing, must remain identical)
- **Stitch** (new)
- **MetaClean** (new)

**Implementation:**
- Add public/js/tabs.js module
- Add tab buttons to index.html header area
- Each tab shows/hides its content section
- Keep existing compress UI as the default visible tab
- Use .glass-card and existing CSS classes for consistency

### Feature 2: MetaClean (metadata stripping)

**Backend: lib/exiftool.js** (new module, follows lib/hwaccel.js pattern)
- detectExifTool() -- check /opt/homebrew/bin/exiftool exists, cache result
- readMetadataJson(filePath) -- runs exiftool -json -G1 -a -s on the file
- computeRemovals(metadata, mode) -- decides which tags to strip based on mode
- writeCleanCopy(inputPath, outputPath, removals) -- applies removals via execFile
- generateReport(inputMeta, outputMeta, removals) -- before/after diff

**ExifTool is already installed:** /opt/homebrew/bin/exiftool v13.50

**Sample files for testing:** /Users/rishaal/CODING/MagFieldsWarRoom/assets/meta/
- sample meta photo.heic (618 KB)
- sample meta.MOV (42 MB)

**Exact fields to strip (confirmed from real exiftool dumps):**

HEIC photos -- Attribution mode:
- Remove EXIF:Make when value is "Meta AI"
- Remove EXIF:Model when value is "Ray-Ban Meta Smart Glasses"

HEIC photos -- Privacy mode (adds):
- Remove EXIF:UserComment (contains UUID: AA747B50-302B-44D3-91AF-91976FF9A1DB)
- Remove EXIF:SerialNumber (value: "2Q")
- Remove SubSecTime, SubSecTimeOriginal, SubSecTimeDigitized

MOV videos -- Attribution mode:
- Remove Keys:Comment (contains: app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=UUID)
- Remove Keys:Model (Ray-Ban Meta Smart Glasses)
- Remove Keys:Copyright (Meta AI)

MOV videos -- Privacy mode (adds):
- Remove Keys:Description ("2Q" serial)
- Remove Keys:AndroidVersion ("14")

**NEVER run exiftool -all=** -- surgical removal only.

Value matching regex: /(meta|ray-?ban|meta ai|meta view)/i
UUID regex (privacy mode): /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

**New API routes:**
- GET /api/exiftool -- returns { installed: bool, version: string }
- GET /api/metadata?path= -- returns full exiftool JSON for a file
- POST /api/metaclean -- body: { files: [{path, name}], mode: "attribution" or "privacy" }
- Creates job type 'metaclean' in job queue, emits WebSocket events

**Output naming:** filename_CLEAN.ext (same directory as source, same bump rule as _COMP)

**Frontend: public/js/metaclean.js** (new module)
- Mode toggle: Attribution only (default) / Privacy mode
- Reuse existing file upload + drag-drop
- Show per-file report: removed tags list
- Download button per output

### Feature 3: Stitch (video concatenation)

**Backend additions -- new lib/stitch.js:**

Path A -- Lossless concat (try first when codecs match and no trims):
- Build list.txt with ordered file paths
- ffmpeg -f concat -safe 0 -i list.txt -c copy -map_metadata 0 output.mp4

Path B -- Re-encode fallback (when codecs/resolutions differ or trims applied):
- Use existing buildCommand() preset/codec infrastructure
- Normalize all clips to same codec/resolution, then concat

After stitch: always run MetaClean on the merged output.

**New API route:**
- POST /api/stitch -- body: { clips: [{path, name, trim?: {start, end}}], order: [0,1,2], compress: bool, preset?, codec?, format? }
- Creates job type 'stitch' in job queue

**Output naming:** {firstClipName}_STITCH_1-2-3.mp4 (or _STITCH_1-2-3_COMP.mp4 if compress enabled)

**Frontend: public/js/stitch.js** (new module)
- Clip list with drag-drop reorder (SortableJS CDN)
- Per-clip: Preview button (loads into existing Plyr player) + Set In / Set Out buttons (grabs current playback time)
- Editable timecode fields next to Set In/Out (precision)
- "Compress output" toggle (uses existing preset/codec/format settings)
- MetaClean runs automatically on output

**MVP trim approach (from GPT, smart):** Don't build slider UI yet. Use Preview + Set In/Set Out buttons that capture player.currentTime. Way less buggy, still feels good.

### Bonus: Download Endpoint

- GET /api/download?path= -- streams file with Content-Disposition: attachment header
- Add Download buttons to completed jobs in the UI
- Essential for phone workflows (uploaded files are in /tmp, can't be found by the user)

---

## PHASED BUILD ORDER

```
Phase 0: Fix 3 critical bugs:
  0a. HW badge display bug (compression.js:117 + :145) -- confirmed, 5-min fix
  0b. Files-getting-bigger bug (bitrate check before compress) -- needs logic in buildCommand or compress route
  0c. Slow 230MB compression -- diagnose after 0a/0b are fixed, may resolve itself
Phase 1: Tab navigation (prerequisite for everything)
Phase 2: ExifTool backend (lib/exiftool.js + API routes)
Phase 3: MetaClean UI + full flow
Phase 4: Stitch backend (concat + fallback + auto-clean)
Phase 5: Stitch UI (reorder + per-clip trim + compress toggle)
Phase 6: Download endpoint + buttons
Phase 7: QA with real Meta Ray-Ban samples
```

---

## AGENT TEAM CHARTERS (5 agents in .claude/agents/)

| Agent | Model | Use For |
|-------|-------|---------|
| ffmpeg-expert | sonnet | Stitch engine, concat commands, re-encode fallback, performance diagnosis |
| frontend-builder | opus | Tab navigation, MetaClean UI, Stitch UI, SortableJS integration |
| compression-diagnostics | opus | Slow compression bug, bitrate analysis |
| code-reviewer | sonnet | Review new modules before committing |
| scribe | haiku | AI-CHAT-LOG entries, CHANGELOG updates, session docs |

**Team mode is enabled** in settings.local.json (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).
**Plans directory** configured at .claude/plans/

---

## EXISTING INFRASTRUCTURE TO REUSE (don't reinvent)

| What Exists | Where | Reuse For |
|------------|-------|-----------|
| Job queue + WebSocket progress | lib/jobQueue.js | MetaClean and Stitch jobs |
| FFmpeg spawn + progress parsing | lib/jobQueue.js | Stitch concat |
| File upload (multer) | server.js | Same upload flow for all modes |
| File cards + status badges | public/js/filemanager.js | Extend for new job types |
| Plyr video player | public/js/player.js | Preview clips in Stitch mode |
| Trim timecodes | public/js/trim.js | Per-clip Set In/Out |
| Drag-drop file input | public/js/dragdrop.js | All three modes |
| Theme system (150+ CSS vars) | public/css/styles.css | New UI inherits automatically |
| HW accel detection pattern | lib/hwaccel.js | Model for ExifTool detection |
| Notification toasts | app.js showNotification() | Success/error for new operations |

---

## CONSTRAINTS (non-negotiable)

1. No frameworks -- vanilla JS ES modules, no React/Vue/Svelte
2. No build step -- Tailwind CDN, Plyr CDN, SortableJS CDN
3. No cloud -- everything runs locally at localhost
4. Don't break Compress -- existing compression tab must work identically
5. ES modules only -- import/export, never require()
6. FFmpeg via spawn -- never child_process.exec (prevents shell injection)
7. ExifTool via execFile -- same safe pattern as ffprobe in probe.js
8. Preserve metadata by default -- only strip what's explicitly targeted
9. Output next to source -- _CLEAN, _STITCH, _COMP suffixes
10. Dark/light theme -- all new UI must use CSS custom properties

---

## FILES THAT WILL BE CREATED

```
lib/exiftool.js          -- ExifTool detection + read/write/report
lib/stitch.js            -- Stitch engine (concat + fallback + auto-clean)
public/js/tabs.js        -- Tab navigation module
public/js/metaclean.js   -- MetaClean UI
public/js/stitch.js      -- Stitch UI (reorder, per-clip trim, compress toggle)
```

## FILES THAT WILL BE MODIFIED

```
server.js                -- New routes: /api/exiftool, /api/metadata, /api/metaclean, /api/stitch, /api/download
public/index.html        -- Tab structure, MetaClean section, Stitch section, SortableJS CDN
public/css/styles.css    -- New component styles (tab buttons, clip cards, reorder handles)
public/js/app.js         -- Import new modules, init tabs, extend appState
public/js/filemanager.js -- Download buttons, new job type rendering
public/js/progress.js    -- Handle new WebSocket event types (metaclean, stitch)
lib/jobQueue.js          -- Support new job types if needed
CLAUDE.md                -- Update with new architecture, routes, skills
```

---

## VERIFICATION CHECKLIST (Definition of Done)

- [ ] Compression tab works exactly as before (no regressions)
- [ ] HW acceleration badge shows correctly
- [ ] A 230MB file compresses at reasonable speed (HW encoding, not SW)
- [ ] Tab switching works: Compress / Stitch / MetaClean
- [ ] MetaClean on sample meta photo.heic: Make and Model removed, dates preserved
- [ ] MetaClean on sample meta.MOV: Keys:Comment, Model, Copyright removed, timestamps preserved
- [ ] Privacy mode additionally removes UserComment UUID, SerialNumber, Description, AndroidVersion
- [ ] Stitch 2+ clips: output plays correctly, continuous playback
- [ ] Stitch with trims: per-clip in/out points respected
- [ ] MetaClean auto-runs on stitched output
- [ ] Download button works (saves file with correct name)
- [ ] All new UI respects dark/light theme
- [ ] ESLint passes on all new/modified files
- [ ] Server starts without errors
