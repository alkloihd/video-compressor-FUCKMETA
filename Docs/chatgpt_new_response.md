Yes—this stack inventory is *exactly* the kind of “ground truth” that lets us design something you’ll actually enjoy using, instead of accidentally turning it into a half‑React, half‑CLI science project.

You’re not building a cloud app here. You’ve got a **local-first Mac server** with a **vanilla JS UI**, **FFmpeg/ffprobe**, a **job queue**, and **WebSockets**. So the best plan is: **add two new modes (MetaClean + Stitch) as additive workflows** while keeping the existing “Compress” workflow untouched.

Below is a refined approach that matches what you consistently prefer:

* **No build step**
* **No frameworks**
* **Dead simple UI**
* **Progressive disclosure** (simple by default, advanced controls tucked away)
* **Predictable outputs next to originals**
* **Metadata preserved unless explicitly targeted**
* **Reuse the existing job queue + WebSocket progress model**

---

## The product shape you’ll like

### Modes (tabs) in the same app

Top-level tabs (same page, no routing complexity):

1. **Compress** (existing, must remain identical)
2. **Stitch** (new)
3. **MetaClean** (new: remove “Made with Meta Ray‑Ban” signals)

That’s it. No extra screens unless absolutely necessary.

### Output naming rules (consistent with your suffix style)

Keep your current convention and extend it:

* Compress: `filename_COMP.mp4` (already done)
* MetaClean: `filename_CLEAN.ext`
* Stitch (no compress): `base_STITCH_1-2-3.mp4`
* Stitch + compress enabled: `base_STITCH_1-2-3_COMP.mp4`
* If file exists, follow your existing bump rule: `_2`, `_3`, etc.

“base” = first clip’s base name, or user can optionally set it.

### “Dead-simple trim” that avoids slider hell (MVP)

You asked for slider drag-drop trim. That’s doable, but it’s the fastest way to introduce buggy UI.

MVP trim that feels good and is accurate:

* Each clip row has: **Preview**, **Set In**, **Set Out**
* Preview loads the clip into the existing Plyr player
* Set In/Out grabs current playback time and stores it
* You still show editable timecodes next to it (for precision)

Then later: add a dual-range slider per clip as “Advanced”.

This matches your “progressive disclosure” vibe and leverages what you already built.

---

## What changes (high-level) without breaking what works

### Backend additions (Express)

You already have:

* upload → temp dir
* probe → ffprobe JSON
* compress → ffmpeg job queue
* progress via WebSocket

We add:

1. **ExifTool integration** (new `lib/exiftool.js`)
2. **MetaClean jobs** (exiftool tasks)
3. **Stitch jobs** (ffmpeg concat + fallback encode)
4. **Download endpoint** (so phone workflows are actually usable)

### Frontend additions (vanilla modules)

You already have modules for:

* dragdrop
* file cards
* compression settings
* trim (single file)
* crop
* WebSocket progress

We add:

* `tabs.js` (mode switching)
* `stitch.js` (stitch queue + reorder + per-clip in/out)
* `metaclean.js` (scrub mode + report UI)
* small additions to `filemanager.js` (checkbox selection + clip queue controls)

Everything stays ES modules. No bundler.

---

## The refined “MetaClean” strategy (surgical, not nuclear)

You’ve already got the exact fields from your samples. So the app should implement **two scrub modes**:

### Default: Attribution only

Remove only the fields that cause “Made with Meta” labeling.

* HEIC:

  * `EXIF:Make` (Meta AI)
  * `EXIF:Model` / `EXIF:CameraModelName` (Ray‑Ban Meta Smart Glasses)

* MOV/MP4 (`Keys/mdta`):

  * `Keys:Comment` (`app=Meta AI&device=...&id=UUID`)
  * `Keys:Model`
  * `Keys:Copyright`

### Optional: Privacy mode (toggle)

Also remove likely fingerprinting/tracking fields:

* HEIC: `EXIF:UserComment` (UUID-like), `EXIF:SerialNumber` (“2Q”), `SubSecTime*` (optional)
* MOV: `Keys:Description` (“2Q”), `Keys:AndroidVersion`, UUID-like comment fragments

Crucial rule (matches your stated intent):

* **Never run `-all=`**
* Don’t blanket delete XMP unless it contains Meta/Ray‑Ban strings or user chooses “privacy mode”.

### Implementation detail that matches your style

Instead of hardcoding 50 tag deletes, do it like this:

1. `exiftool -json -G1 -a -s <file>`
2. Compute removals based on:

   * tag allowlist **AND**
   * value regex match (meta|ray-ban) and/or UUID regex (privacy mode)
3. Run:

   * `exiftool -o <output> <tag1>= <tag2>= ... <input>`
4. Write a tiny report:

   * removedTags: [{tag, oldValue}]

This is maintainable, future-proof, and feels like how your FFprobe + FFmpeg builder works.

---

## Stitching strategy that won’t disappoint you

### Path A: Fast “lossless stitch”

Try this first when:

* No trims/crops
* All inputs match codec/resolution/audio params (preflight with ffprobe)

Use concat demuxer:

* build `list.txt`
* `ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4`

Pros: instant, no quality loss
Cons: fails if clips differ

### Path B: “It just works” stitch (fallback)

If Path A fails OR trims/crops are enabled:

* Use filtergraph concat (re-encode)
* Apply per-clip trim if present
* Encode using the same codec/preset logic you already have (reuse your preset matrix)

Then:

* Run MetaClean automatically on the stitched output

### Optional compression during stitch (your preference)

You’ve already got a compression engine you trust. So don’t reinvent it.

Two-step option (MVP, simplest):

1. Stitch output (lossless if possible)
2. If “Compress stitched output” toggle is ON:

   * run the existing compress pipeline on the stitched output

Later optimization:

* Single-pass “encode while stitching” (no intermediate file)

---

## One key UX upgrade for your phone workflow

Right now, outputs saved “next to the original” works great for Mac-path files, but for **uploads from a phone**, the “original” lives in `/tmp/...` on the Mac.

So add:

* `GET /api/download?path=...`

  * streams file with `Content-Disposition: attachment`
  * lets you save to Files / Photos on iOS

This is the difference between “cool local tool” and “actually usable from my phone.”

---

# Task manifest (additive, minimal risk)

Here’s a plan you can hand to a swarm. It explicitly protects the existing compress workflow.

```yaml
project: video-compressor
goal: add MetaClean + Stitch + per-clip trim without breaking Compress
constraints:
  - keep frontend vanilla ES modules
  - no build step
  - keep existing compress behavior identical
  - new features additive only
phases:
  - id: P0
    name: Planning docs (no code)
    tasks:
      - write Docs/MEDIA_TOOLS_PLAN.md (user flows, modes, naming, acceptance)
      - write Docs/METACLEAN_RULES.md (tags + modes + examples)
      - write Docs/STITCH_RULES.md (lossless vs reencode, fallback logic)

  - id: P1
    name: ExifTool integration (backend)
    tasks:
      - add lib/exiftool.js (detect, readJson, writeCleanCopy)
      - update server startup to detect exiftool like hwaccel (badge in UI)
      - add endpoint GET /api/exiftool (returns installed:true/false, version)

  - id: P2
    name: MetaClean MVP
    tasks:
      - add endpoint POST /api/metaclean (paths[], mode)
      - implement job type 'metaclean' (no progress, but status updates)
      - write report json per output (removed tags)
      - add UI tab "MetaClean" + mode toggle + run button
      - add per-file output link + “Download” button

  - id: P3
    name: Stitch MVP (reorder + lossless concat + fallback)
    tasks:
      - add endpoint POST /api/stitch (ordered paths, per-clip trims optional, compress toggle)
      - implement stitch job:
          - preflight with ffprobe
          - try concat copy
          - fallback re-encode if needed
          - always run MetaClean on stitched output
      - add UI tab "Stitch"
      - implement stitch queue + reorder (SortableJS CDN or fallback up/down)
      - implement per-clip Preview / Set In / Set Out (MVP trim)

  - id: P4
    name: Download support + phone usability
    tasks:
      - add endpoint GET /api/download?path=
      - add Download buttons for outputs in Jobs UI
      - ensure outputs are retained long enough (not cleaned instantly from /tmp)

  - id: P5
    name: QA + safety
    tasks:
      - add “sample checklist” doc: HEIC scrub, MOV scrub, stitch 2 clips, stitch with trims
      - verify compress tab unchanged
      - verify metadata preserved except targeted fields (exiftool diff)
```

---

# Multi-agent charters (copy/paste into your agent runner)

### Agent A — PM/Docs

```text
Create Docs/MEDIA_TOOLS_PLAN.md, Docs/METACLEAN_RULES.md, Docs/STITCH_RULES.md.
Must reflect constraints: local-only, vanilla JS, no build, additive changes only.
Include acceptance tests and output naming rules.
No code changes.
```

### Agent B — Backend (ExifTool + endpoints)

```text
Implement exiftool integration like ffprobe/ffmpeg patterns:
- lib/exiftool.js with detect/readJson/writeCleanCopy
- GET /api/exiftool
- POST /api/metaclean (creates metaclean jobs, outputs *_CLEAN.ext, emits ws events)
- GET /api/download?path= (attachment)
Do not modify compress behavior.
```

### Agent C — Stitch engine

```text
Implement POST /api/stitch:
- takes ordered clip paths + optional per-clip trim (start/end seconds)
- preflight with ffprobe metadata
- try lossless concat (-c copy) when safe
- fallback to re-encode when needed
- output naming *_STITCH_1-2-3.mp4
- optionally compress stitched output using existing presets (two-step MVP ok)
- run MetaClean on final output
Do not change existing compress command builder logic (reuse or wrap).
```

### Agent D — Frontend (tabs + UX)

```text
Add UI tabs: Compress (unchanged), Stitch, MetaClean.
Implement:
- stitch queue with reorder (SortableJS CDN acceptable; fallback up/down)
- per-clip preview + Set In/Out buttons using existing Plyr player
- MetaClean mode toggle (Attribution vs Privacy)
- Download buttons for outputs
No framework, ES modules only, keep existing design system.
```

### Agent E — QA

```text
Write Docs/TEST_PLAN_MEDIA_TOOLS.md and run local verification steps:
- HEIC scrub removes Make/Model/UserComment/etc per mode
- MOV scrub removes Keys:Comment/Model/Copyright/AndroidVersion/etc per mode
- Stitch 2-3 clips losslessly when possible; fallback works
- Outputs playable, downloads work
- Compression tab unchanged (pixel + bitrate sanity)
```

---

## The one thing I’ll push back on (because it’ll bite you)

“Drag-drop trimming sliders per clip” as the first implementation is a reliability trap on mobile. You’ll spend days on edge cases.

The **Preview + Set In/Out** approach gives you 90% of the utility with ~20% of the risk—and still feels slick on a phone. Then you add sliders later as an “Advanced” panel.

---

If you want, I can also write the exact skeleton of the three new docs (`MEDIA_TOOLS_PLAN.md`, `METACLEAN_RULES.md`, `STITCH_RULES.md`) in the style your repo already uses—tight, implementation-aware, and easy for agents to follow.
