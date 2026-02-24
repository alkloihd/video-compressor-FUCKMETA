# Task Manifest -- Video Compressor Build Session 3

**Created:** [TO BE FILLED BY PLANNING AGENT]
**Status:** DRAFT -- Awaiting user approval before execution

---

## Phase 0: Critical Bug Fixes

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 0a | Fix HW badge display bug -- compression.js:117 checks `hwInfo.videotoolbox` but server returns `h264_videotoolbox` etc. Also fix `updateHWIndicators()` at ~:145 | | Not Started | CONFIRMED: Display-only bug. Encoding works fine. 5-min fix. |
| 0b | Fix files-getting-bigger bug -- add bitrate comparison before compress. If source bitrate <= target, skip or reduce | | Not Started | Root cause: Balanced preset forces 6 Mbps on files already at 4-5 Mbps. See `adjustBitrate()` in lib/ffmpeg.js |
| 0c | Diagnose slow 230MB compression -- may resolve after 0a/0b. Check codec, preset, resolution | | Not Started | HW accel IS available. Likely AV1 selected or 4K without downscale |

## Phase 1: Tab Navigation

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 1.1 | Create public/js/tabs.js -- show/hide tab content sections | | Not Started | |
| 1.2 | Add tab buttons to index.html header area (Compress / Stitch / MetaClean) | | Not Started | Compress = default active tab |
| 1.3 | Wrap existing compress UI in a tab panel div | | Not Started | Must not break existing compress flow |
| 1.4 | Add empty tab panel divs for Stitch and MetaClean | | Not Started | |
| 1.5 | Add tab CSS styles to styles.css | | Not Started | Use existing CSS custom properties |

## Phase 2: ExifTool Backend

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 2.1 | Create lib/exiftool.js -- detectExifTool(), readMetadataJson(), computeRemovals(), writeCleanCopy(), generateReport() | | Not Started | Follow lib/hwaccel.js pattern. ExifTool at /opt/homebrew/bin/exiftool v13.50 |
| 2.2 | Add GET /api/exiftool route to server.js | | Not Started | Returns { installed, version } |
| 2.3 | Add GET /api/metadata?path= route to server.js | | Not Started | Returns full exiftool JSON |
| 2.4 | Add POST /api/metaclean route to server.js | | Not Started | Body: { files, mode }. Creates job in queue |
| 2.5 | Extend jobQueue.js for 'metaclean' job type if needed | | Not Started | May need ExifTool process spawning instead of FFmpeg |

## Phase 3: MetaClean UI

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 3.1 | Create public/js/metaclean.js -- mode toggle, file list, report display | | Not Started | Attribution (default) vs Privacy mode |
| 3.2 | Add MetaClean tab content to index.html | | Not Started | Reuse drop zone + file cards pattern |
| 3.3 | Wire drag-drop for MetaClean tab | | Not Started | Reuse existing dragdrop.js |
| 3.4 | Add WebSocket handling for metaclean events in progress.js | | Not Started | |
| 3.5 | Test with sample files at /Users/rishaal/CODING/MagFieldsWarRoom/assets/meta/ | | Not Started | HEIC photo + MOV video |

## Phase 4: Stitch Backend

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 4.1 | Create lib/stitch.js -- lossless concat (Path A) + re-encode fallback (Path B) | | Not Started | Path A: -f concat -safe 0 -c copy. Path B: normalize then concat |
| 4.2 | Add POST /api/stitch route to server.js | | Not Started | Body: { clips, order, compress, preset?, codec?, format? } |
| 4.3 | Auto-run MetaClean on stitch output | | Not Started | Chain: stitch complete -> metaclean |
| 4.4 | Extend jobQueue.js for 'stitch' job type if needed | | Not Started | |

## Phase 5: Stitch UI

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 5.1 | Create public/js/stitch.js -- clip list, reorder, trim, compress toggle | | Not Started | |
| 5.2 | Add SortableJS CDN to index.html | | Not Started | Drag-drop reorder |
| 5.3 | Add Stitch tab content to index.html | | Not Started | |
| 5.4 | Per-clip Preview + Set In/Out buttons | | Not Started | MVP: capture player.currentTime, no slider UI |
| 5.5 | "Compress output" toggle wired to existing preset/codec/format | | Not Started | |
| 5.6 | Wire WebSocket handling for stitch events in progress.js | | Not Started | |

## Phase 6: Download Endpoint

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 6.1 | Add GET /api/download?path= route to server.js | | Not Started | Content-Disposition: attachment |
| 6.2 | Add Download buttons to completed jobs in filemanager.js | | Not Started | Essential for phone workflows |

## Phase 7: QA

| ID | Task | Assigned Agent | Status | Agent Notes |
|----|------|----------------|--------|-------------|
| 7.1 | Verify compression tab works identically (no regressions) | | Not Started | |
| 7.2 | Verify HW badge shows correctly after fix | | Not Started | |
| 7.3 | Test MetaClean on sample meta photo.heic | | Not Started | Make/Model removed, dates preserved |
| 7.4 | Test MetaClean on sample meta.MOV | | Not Started | Keys:Comment/Model/Copyright removed |
| 7.5 | Test Privacy mode additional removals | | Not Started | UserComment UUID, SerialNumber, Description, AndroidVersion |
| 7.6 | Test Stitch 2+ clips | | Not Started | Continuous playback |
| 7.7 | Test Stitch with per-clip trims | | Not Started | In/out points respected |
| 7.8 | Verify MetaClean auto-runs on stitched output | | Not Started | |
| 7.9 | Verify Download button works | | Not Started | Correct filename |
| 7.10 | Verify dark/light theme on all new UI | | Not Started | |
| 7.11 | Run ESLint on all new/modified files | | Not Started | |
| 7.12 | Verify server starts without errors | | Not Started | |

---

## Agent Assignment Guide

| Agent | Best For |
|-------|---------|
| ffmpeg-expert (sonnet) | Tasks 0b, 0c, 4.1, 4.2, 4.3, 4.4 |
| frontend-builder (opus) | Tasks 1.1-1.5, 3.1-3.4, 5.1-5.6, 6.2 |
| compression-diagnostics (opus) | Tasks 0a, 0b, 0c |
| code-reviewer (sonnet) | Review all new modules before committing |
| scribe (haiku) | AI-CHAT-LOG entries, CHANGELOG updates, manifest annotations |
