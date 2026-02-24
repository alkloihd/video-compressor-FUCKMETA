
You said:
So I'm pretty sick of Meta Rayban or Meta glasses putting their name on every one of my Instagram posts, and I'm assuming that that's just metadata. Can you do your research on the exact metadata that's in there and then create for me a prompt for a web-hosted mobile app that I want to create, which will be hosted on Firebase Firestore using Firebase Studio? I will code it in Cloud Code using a bunch of multi-agents, but essentially I want to build a web app for my phone that allows me to upload photos and have multiple features. The first is to strip the metadata and perhaps even compress it slightly, but not the metadata, just the actual meta Rayban metadata I want to strip. But I need you to do your research properly to see what exactly this metadata is. And then the next thing I want to do is to be able to stitch videos together because the meta Raybans only take three-minute videos. So what I want to do is be able to stitch videos together, and that would be another tool. And then another one would be, I'm not sure actually, I forget now, but I think the main one is taking out the metadata. I want to be able to upload multiple files and then download them back to my computer, back to my phone. So it would just be like a simple download, which I can save to my gallery or download the videos. I'm pretty sure this can work more or less locally with some sort of a script, unless we use the cloud compute. I'm not sure what you suggest since these are video intensive. resources, we probably shouldn't do this locally on the device, although I do have a fairly powerful device, but maybe using the Firestore and the cloud compute, but I need it to be automated completely. I will just log in with my GAuth, Google Auth credentials, my Firebase credentials, and then I'm going to have things going. My usual workflow is to get the AI to create a work sessions folder in there. There's a whole protocol and a CLAUD.md file and an agents.md file, which essentially, I just create prior to getting started. But I basically want to build this simple web app where I can upload multiple files and videos and be able to take out that meta. I want to preserve all the other metadata, but everything just but the meta Ray-Ban, because I hate that that shows and they're taking credit for every photo that I take or every post that I make. It pisses me off that I will make an Instagram post and one of the photos or videos will be with the Ray-Ban, but then meta says that all of them are taken with the Ray-Ban. And it's annoying. So, I just figured if I can have an instant stitch feature, two or three features for quick video stuff, but the one is going to be the stripping of the metadata, or at least removing of a meta's metadata, and then... Ideally, it just packages them as individual downloads, but it'll just be a simple UI, fancy but simple, with two different, a couple of different modes. One will be the stripping of the metadata, and the other one will be a stitching tool, so I can stitch videos together. Please do your research and tell me how we going to achieve this and then create the prompts for me, and then I will give you my CLAUD.md file and the agents.md file so that you can understand what I'm doing.

ChatGPT said:
Reasoned for 16m 10s
You’re basically right: Instagram isn’t “watermarking” your content; it’s almost certainly reading device/app-identifying metadata embedded in the media file (EXIF for photos, QuickTime/MP4 atoms for videos) and then choosing to show a “Made with / recorded via Ray-Ban Meta” attribution.

What “Meta Ray‑Ban” metadata is actually in the files
Photos (JPG)
Real-world metadata dumps from Ray‑Ban Meta photos show the identifying fields are extremely on-the-nose:

EXIF:Make = Meta

EXIF:Model = Ray-Ban Meta Smart Glasses

Often also:

EXIF:ImageDescription = Meta AI

EXIF:Copyright = Meta AI

EXIF:UserComment = (example seen: 2Q) 

Those first two (Make/Model) are the usual culprits for platform “camera attribution” labels. The “Meta AI” fields are additional “branding-ish” metadata that can also trigger labeling or sorting in some apps.

There’s also an iOS app marketed specifically to solve exactly what you’re describing; its own description says it removes only a small targeted set of EXIF fields added by smart glasses that platforms use for special labels/classification, while preserving normal metadata like date/GPS. 

That lines up with the minimal-field approach you want.

Videos (MP4)
This part is sneakier.

A Ray‑Ban Meta user who wanted to keep the “recorded via Meta RayBan…” Instagram tag after editing found they could restore it by adding a specific QuickTime metadata field:

QuickTime::ItemList → Comment = app=Meta View&device=Ray-Ban Meta Smart Glasses 

That is a giant clue: for videos, Instagram’s “recorded via …” label appears to be driven (at least in some cases) by a QuickTime Comment tag that explicitly encodes the app/device.

ExifTool’s QuickTime tag documentation confirms “Comment” exists in common QuickTime metadata locations (including the iTunes/ItemList-style ©cmt comment tag, and a “comment” key in the Keys list). 

So the practical takeaway:

For photos, you target EXIF Make/Model (and optionally those “Meta AI” description/copyright fields).

For videos, you target QuickTime Comment (plus possibly Make/Model/Software if present).

The core design principle for your app
You said: “Preserve all other metadata; remove only Meta/Ray‑Ban attribution metadata.”

So don’t do a blanket “strip all metadata.” Do a surgical scrub:

Extract all metadata.

Remove only:

known attribution tags (Make/Model/Comment/Software/etc) when their values match Meta/Ray‑Ban strings, or

a short allowlist of tag names known to carry attribution for these files.

Write back the modified metadata without re-encoding (lossless) when possible.

This is exactly what ExifTool is good at: reading/writing tags across JPG and MP4. 

How to build this on Firebase without hating your life
Don’t store media in Firestore
Firestore is for job state + metadata, not blobs. Use:

Firebase Storage for uploads/outputs

Firestore for job documents (status, options, links, logs)

Where the heavy processing should run
For:

metadata rewriting (ExifTool)

MP4 stitching (FFmpeg)

…you want Cloud Run (or Cloud Run Jobs), not “pure client-side”:

Client-side FFmpeg (ffmpeg.wasm) works, but it’s heavy, slow, memory-hungry, and mobile Safari can be a pain.

Cloud Run lets you ship a container with exiftool + ffmpeg, and handle large files more reliably.

High-level pipeline
User logs in (Google Auth / Firebase Auth).

User uploads files to Firebase Storage.

App creates a Firestore jobs/{jobId} document with:

type: "scrub" | "stitch"

file references

options

A backend worker (Cloud Run) watches for new jobs (via Firestore trigger → Pub/Sub/Cloud Tasks → Cloud Run).

Worker:

downloads inputs from Storage

runs ExifTool scrub and/or FFmpeg concat

uploads outputs back to Storage

updates job doc with output URLs + “removed tags report”

UI shows “Done” and offers:

download single files

“download all” (zip)

Video stitching specifics
Ray‑Ban Meta videos are capped at up to 3 minutes per clip (you can select 30s/60s/3m; default is 30s, extendable in app settings). 

So your stitch tool is basically “concat N segments.”

Best practice:

Attempt lossless concat first (-c copy) — fast and no quality loss.

If that fails (timestamp weirdness / mismatched streams), fallback to re-encode.

Exactly what your “Meta attribution scrubber” should remove
Rule set (minimal + safe)
Remove the following tags only if the value matches /meta|facebook|ray-ban|rayban|meta view|ray-ban stories/i:

For photos (JPG):

EXIF:Make (example value: Meta) 

EXIF:Model (example value: Ray-Ban Meta Smart Glasses) 

EXIF:ImageDescription when it’s Meta AI 

EXIF:Copyright when it’s Meta AI 

Optionally: EXIF:Software / XMP:CreatorTool if present and matches Meta View/Meta

For videos (MP4):

QuickTime:Comment / ItemList:Comment / Keys:Comment (because the known string lives there) 

QuickTime:Make, QuickTime:Model, QuickTime:Software if present and matches Meta/Ray‑Ban (same logic)

Why value-matching is important
It lets you preserve:

your timestamps

GPS

album-ish tags

lens/exposure data (when it’s not branding)

creator/copyright (when it’s yours)

…and only remove “brand attribution” content.

What I’d add as your “third feature” (because it’ll save you headaches)
A Metadata Inspector / Diff View:

shows “Before” and “After”

highlights exactly which tags were removed

lets you export a small JSON report

This keeps the tool honest and prevents accidental removal of something you care about.

Copy/paste: Master build prompt for your multi-agent Firebase Studio workflow
Below is a single prompt you can drop into your multi-agent coding setup. It’s written to produce a complete working app (frontend + backend + infra).

MASTER PROMPT: “MetaScrub + Stitch” Firebase PWA
You are a multi-agent dev team building a mobile-first web app (PWA) hosted on Firebase. The app lets a logged-in user upload photos/videos, process them with two tools, and download the results.

Product goal
Stop Instagram and other platforms from labeling posts as “Made with / recorded via Ray‑Ban Meta” by surgically removing only Ray‑Ban Meta attribution metadata while preserving all other metadata (timestamps, GPS, etc). Also provide a tool to stitch multiple Ray‑Ban Meta video clips into one longer video.

Non-negotiables
Preserve all metadata except the attribution metadata.

Batch upload (multiple files at once).

Batch download (download all outputs; provide zip option).

Fully automated: user selects tool + files → gets processed outputs.

Google Auth login via Firebase Auth.

Use Firestore for job tracking, Firebase Storage for file blobs.

Backend must support large video processing; use Cloud Run (container) for ffmpeg/exiftool.

Research-backed attribution metadata to target
Photos (JPG) from Ray‑Ban Meta commonly include:

EXIF:Make = “Meta”

EXIF:Model = “Ray-Ban Meta Smart Glasses”

sometimes EXIF:ImageDescription = “Meta AI”

sometimes EXIF:Copyright = “Meta AI”
Videos may include a QuickTime comment that can look like:

Comment = “app=Meta View&device=Ray-Ban Meta Smart Glasses”
Remove these only when values match Meta/Ray‑Ban strings.

Tools / processing implementation
Use ExifTool to read/write metadata for both images and videos. Use FFmpeg for video stitching:

First attempt fast concat with stream copy (-c copy).

If concat fails, fallback to re-encode (H.264/AAC) with reasonable defaults for social media compatibility.
After stitching, run the same attribution-scrub on the output file.

Operations
Tool A — “Meta Attribution Scrub”
Input: images/videos
Output: same format files, same pixels/streams when possible, but with targeted metadata removed.
Must generate a per-file report: removedTags[] with (tagName, oldValue).

Tool B — “Stitch Videos”
Input: ordered list of videos
Output: one merged MP4
Must then run attribution scrub on merged output.
Must preserve CreateDate and GPS if possible.

Architecture
Frontend:

Mobile-first UI (PWA) built with React (Next.js or Vite).

Views:

Login

Dashboard: tool selector (Scrub / Stitch)

Upload + file list + options

Job progress + results + download buttons

Metadata diff viewer per file (optional but recommended)

Backend:

Firebase Storage buckets:

uploads/{uid}/{jobId}/{fileId}/{originalName}

outputs/{uid}/{jobId}/{fileId}/{outputName}

reports/{uid}/{jobId}/report.json

Firestore collections:

jobs/{jobId}

uid

type: "scrub" | "stitch"

status: "queued" | "processing" | "done" | "error"

createdAt, updatedAt

inputFiles: [{storagePath, name, size, mime}]

stitchOrder: [index...] (for stitch)

options: { scrubMode: "metaOnly", compressImages: boolean, imageQuality?: number }

outputs: [{storagePath, name, mime, size}]

reportPath

error: {message, stack?}

Processing:

Cloud Run service “processor” (container includes exiftool + ffmpeg).

Triggering:

Firestore job creation triggers enqueue (Pub/Sub or Cloud Tasks).

Cloud Run picks up jobId, processes, updates Firestore.

Security:

Firestore/Storage rules restrict access to the authenticated user’s own uid paths.

Cleanup:

Scheduled function deletes uploads/outputs older than N days.

Metadata scrub logic (must be implemented)
Run exiftool to extract metadata as JSON.

Identify tags to remove by:

Tag name in a safe targeted list (Make, Model, Software, Comment, ImageDescription, Copyright, CreatorTool)

AND/OR values matching regex: /(meta|facebook|ray-?ban|luxottica|meta view|ray-ban stories)/i

Remove those tags using exiftool write operations.

Re-run metadata extract and confirm targeted tags are gone while timestamps/GPS remain.

Save a per-file diff report with removed tags.

Acceptance tests
Upload a Ray‑Ban Meta JPG: output should not contain Make=Meta and Model=Ray‑Ban Meta Smart Glasses, but should keep DateTimeOriginal and GPS.

Upload a Ray‑Ban Meta MP4 with QuickTime Comment: output should remove that Comment but preserve CreateDate and location if present.

Stitch 2+ Ray‑Ban Meta clips: output plays continuously; no obvious A/V desync; metadata scrub applied to output.

Batch upload: process 10+ files in one job.

Download works on mobile (save to gallery) and desktop.

Deliverables
Firebase project structure + Hosting + Auth + Firestore + Storage rules.

Cloud Run container + deployment instructions.

Frontend PWA with clean UI.

End-to-end working flow.

Implement with clean code, good logs, and minimal surprises.

Extra: Two practical “gotchas” to bake into the build
Instagram may use more than one signal.
For videos it’s very plausibly that QuickTime Comment string; for photos it’s likely Make/Model. Your scrubber should remove both categories so you’re not playing whack-a-mole. 

Concat without re-encode is fragile.
Make your backend do “try copy → fallback re-encode,” and store in the job report which path it took.

If you drop your CLAUD.md and agents.md, I can rewrite the master prompt to match your exact repo conventions, agent roles, file structure, and “work sessions folder” protocol—so your agents don’t improvise architecture you’ll hate later.


You said:
So I have another app that I've made that is already deployed to cloud-based. Can you give me a prompt describing what we're trying to do so I can get the cloud code in that repository to explain how things are set up, and then you can respond with a nice prompt of how to build it in the context of this stack? It doesn't have to be the same thing, but I want to deploy it live on cloud Fire Studio using my Google authentication and having the database stored there. That could be cool. Then this way I can go in and generate or download the photos or store them there, but I'm not sure if a local storage or offline storage, but we're downloading it. But ideally this app is mobile-friendly and just dead simple. Being able to stitch two videos together, which I'd be in, and then if I stitched them together, I will just put one and two in the file name. This way it will be easy. So please give me a prompt that I can query this stack so you can get some information of how it was deployed, and then we can work through it that way.

ChatGPT said:
Here’s a clean “bootstrap prompt” you can paste into your Cloud Code agent (inside the repo) so it explains exactly how your existing app is deployed, what services it uses, and what conventions it expects—so we can build the MetaScrub/Stitch app in the same style without guessing.

Prompt 1 — Repo/stack discovery (paste into your Cloud Code agent)
You are a senior full-stack engineer auditing THIS repository to explain how it is deployed and how to extend it.

Goal:
1) Explain the current deployment stack end-to-end (Firebase / Google Cloud / “Firebase Studio” / Cloud Run / Functions / Hosting / Auth / Firestore / Storage).
2) Identify the exact entrypoints, build commands, and CI/CD flow used to deploy live.
3) Extract the conventions we must follow so a new feature/app can be added without breaking anything.

Tasks (be specific, cite file paths):
A) Deployment & environments
- Where are the deployment configs? (firebase.json, .firebaserc, apphosting.yaml, cloudbuild.yaml, docker files, terraform, etc.)
- Which service is used for hosting (Firebase Hosting vs App Hosting vs Cloud Run)?
- How are environment variables set (dotenv, Secret Manager, firebase functions:config, runtime env)?
- What are the deploy commands and where are they documented?

B) Authentication
- Confirm Google Auth is implemented via Firebase Auth.
- Show how login works in the code (components/pages, hooks, middleware).
- Identify any custom claims/roles, auth rules, and token handling.

C) Database + file storage
- Is it Firestore or Realtime DB?
- Are there Storage buckets? What structure is used for user files?
- Show Firestore data model (collections, documents, indexes) and security rules.
- Show Storage rules.

D) Backend compute
- Do we have Cloud Functions, Cloud Run, or both?
- Where are the function handlers / endpoints? How are they invoked?
- Any background jobs, queues (Pub/Sub, Cloud Tasks), triggers?

E) Frontend
- What framework (Next.js, Vite, etc.) and routing structure?
- Where is the UI deployed from? How is PWA/mobile handled?
- Any existing upload / download patterns?

F) Summarize “How to extend”
- Write a concise “developer README” for this repo: how to run locally, how to deploy, where to put new features, and how auth/db rules are managed.

Output format:
1) Stack diagram in text (boxes/arrows).
2) Bullet summary of deployment flow.
3) Key files list with paths + what each does.
4) Any risks/quirks you notice (e.g., emulator-only code, missing rules, hardcoded envs).
That prompt forces the agent to surface the truth of the repo: hosting type, auth wiring, where rules live, how deploy works, etc.

Now here’s the second prompt you’ll use after the agent outputs the repo analysis, so it can design/build the new mobile-friendly app using the same stack conventions.

Prompt 2 — Build MetaScrub/Stitch app using this repo’s stack
Using the repo’s existing deployment stack and conventions you just documented, implement a new mobile-first feature/app called “MetaScrub + Stitch”.

User story:
- I sign in with Google (Firebase Auth).
- I choose a mode: (1) “Scrub Meta/Ray-Ban attribution metadata” (2) “Stitch videos”.
- I upload multiple photos/videos.
- The system processes them automatically.
- I download each result, or download all as a zip.
- For stitching: I pick video order; output filename should include “_1”, “_2” (or a combined naming like “clip_1-2_merged.mp4”).
- Keep everything dead simple on mobile.

Constraints:
- Store blobs in Firebase Storage; track jobs in Firestore (or whatever DB this repo uses).
- Preserve all metadata except targeted Meta/Ray-Ban attribution.
- Stitch should try lossless concat first; fallback to re-encode if needed.
- Processing must not rely on the phone doing heavy compute; use the repo’s backend compute pattern (Functions/Run/etc).
- Must follow existing auth, routing, env var patterns, and deployment pipeline.

Implementation plan:
1) Data model
- Define Firestore collections/docs (jobs, files, outputs) consistent with repo style.
- Define storage paths under /uploads/{uid}/... and /outputs/{uid}/...

2) UI
- Build two screens: tool picker + upload/process/results.
- Mobile-first, minimal taps.
- Allow ordering for stitching (drag/drop optional; simple up/down buttons OK).

3) Backend
- Implement a processor service using the repo’s backend pattern:
  - If Cloud Run exists, add a container-based processor with ffmpeg + exiftool.
  - If only Cloud Functions exist, use a Functions + Cloud Run hybrid, or justify the alternative.
- Create a queue/trigger mechanism consistent with repo (Firestore trigger, Cloud Tasks, Pub/Sub, etc.).
- Write robust progress updates to jobs.

4) Metadata scrub rules
Target removals only when values match /(meta|facebook|ray-?ban|luxottica|meta view|ray-ban stories)/i:
- Photos: EXIF Make/Model, ImageDescription, Copyright, Software/CreatorTool if present.
- Videos: QuickTime/ItemList/Keys Comment, Make/Model/Software if present.

5) Deliverables
- PR-ready code changes with clear file structure.
- Updated security rules (Firestore + Storage) to enforce per-user access.
- Deployment instructions matching the repo’s existing pipeline.
- A short usage README.

Output:
- Step-by-step implementation checklist
- Then implement code directly in the repo with clean commits/messages (or staged patches if your tool requires).
- Include exact file paths and any commands needed to deploy.
A blunt architecture call (so you don’t build a painful thing)
For stitching and metadata rewriting, Cloud Run is the correct hammer. Phones can do it, but it’s unreliable and battery-melty, and iOS Safari + large videos is a circus.

So the “simple mobile UI” should be client → Storage upload → Firestore job → Cloud Run process → Storage output → download.

Firestore is only your “job ledger,” not your file store.

One small upgrade you’ll thank yourself for
Add a “Removed tags report” per file (even if you hide it behind an “Advanced” toggle). It makes debugging Instagram behaviour way easier when Meta inevitably changes something.

If you paste Prompt 1 into your Cloud Code agent and drop the output back here, I’ll rewrite Prompt 2 to match your repo’s exact reality (App Hosting vs Hosting, Functions gen1/gen2, how env vars/secrets are done, where rules live, naming conventions, etc.), and tighten it so your agents don’t hallucinate infrastructure.


You said:
here's what it said, work you rmagic!
"""# MagFieldsWarRoom Full Stack Audit
**Purpose**: Reference for building the Meta Ray-Ban Metadata Stripper app
**Generated**: 2026-02-15
**Repo**: /Users/rishaal/CODING/MagFieldsWarRoom
**GCP Project**: magfield-487008

---

## Stack Diagram

BROWSER (Mobile-first PWA)
                    ┌──────────────────────────────────────┐
                    │  Vite + React 19 + TypeScript 5.9    │
                    │  Tailwind v4 + IBM Plex Mono font    │
                    │  Dexie v5 (IndexedDB) — offline-first│
                    │  Service Worker (Workbox / vite-pwa)  │
                    │  Firebase Auth SDK (email/password)   │
                    └──────────────┬───────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼───────────────────────┐
                    │       Firebase Hosting                │
                    │  magfield-487008.web.app              │
                    │  Serves dist/  (Vite build output)   │
                    │  Rewrites /api/** → Cloud Run        │
                    │  Cache: assets immutable, sw no-cache │
                    └──────────────┬───────────────────────┘
                                   │ /api/**
                    ┌──────────────▼───────────────────────┐
                    │       Cloud Run                      │
                    │  war-room-server (us-central1)       │
                    │  Node 22 + tsx (TypeScript direct)   │
                    │  Port 8080, min-instances=1          │
                    │  18 API endpoints (manual routing)   │
                    │  Bearer token auth (Firebase Admin)  │
                    └──┬──────────┬────────────────┬──────┘
                       │          │                │
              ┌────────▼──┐ ┌────▼────────┐ ┌─────▼──────┐
              │ Firestore  │ │ Vertex AI   │ │ Firebase   │
              │ nomads-    │ │ Gemini 3    │ │ Storage    │
              │ wr-db      │ │ Flash/Pro   │ │ 10MB limit │
              │ 13 colls   │ │ + STT       │ │ attachments│
              └────────────┘ └─────────────┘ └────────────┘


---

## A) Deployment & Environments

### Config Files

| File | Purpose |
|------|---------|
| firebase.json | Hosting config, Cloud Run rewrite, Firestore/Storage rules paths, cache headers |
| .firebaserc | Project alias: magfield-487008 |
| Dockerfile | Cloud Run container: Node 22-slim, tsx runtime, port 8080 |
| .github/workflows/ci.yml | CI: typecheck (3 tsconfigs), lint, test, build, security audit |
| vite.config.ts | Dev server (HTTPS, /api proxy), PWA plugin, Tailwind |
| .env.example | All env vars documented |
| .nvmrc | Node 22 |
| tsconfig.server.json | Server TypeScript: ES2023, NodeNext, strict |

### Hosting Architecture
- **Firebase Hosting** serves dist/ (Vite build output)
- /api/** rewrites to Cloud Run service war-room-server in us-central1
- ** falls back to /index.html (SPA routing)
- Cache: assets/** = immutable 1-year, sw.js + workbox-*.js = no-cache

### Environment Variables

**Client-side (VITE_ prefix, safe to expose):**
- VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID

**Server-side:**
- PORT (3002 dev, 8080 Cloud Run)
- GCP_PROJECT_ID = magfield-487008
- VERTEX_LOCATION = global
- GOOGLE_TEXT_MODEL_DEFAULT = gemini-3-flash-preview
- GOOGLE_TEXT_MODEL_PRO = gemini-3-pro-preview
- FIREBASE_SERVICE_ACCOUNT_JSON (Cloud Run only; local uses ADC)

### Deploy Commands

bash
# 1. Firestore rules (MUST deploy first for new roles)
npx firebase-tools deploy --only firestore:rules --project magfield-487008

# 2. Cloud Run server
gcloud run deploy war-room-server \
  --source . \
  --region us-central1 \
  --project magfield-487008 \
  --allow-unauthenticated \
  --port 8080

# 3. Frontend (Firebase Hosting)
npm run build && npx firebase-tools deploy --only hosting --project magfield-487008


### CI/CD (GitHub Actions)
Triggers on push to main and PRs to main:
1. tsc --noEmit (3 tsconfigs: app, node, server)
2. npm run lint (max-warnings=0)
3. npm test (Vitest)
4. npm run build (tsc + vite)
5. npm audit --audit-level=high

---

## B) Authentication

### Login Flow
- **Method**: Email + password only (Firebase signInWithEmailAndPassword)
- **No**: OAuth, 2FA, magic links, social login

### Key Files
| File | Purpose |
|------|---------|
| src/lib/firebase.ts | Firebase SDK init (Auth, Firestore with persistent cache, Storage) |
| src/auth/firebaseAuth.ts | loginWithEmail(), logout(), getUserClaims(), getAuthToken() |
| src/auth/GateAuthContext.tsx | React auth context: user, role, accessLevel, isFounder, isOwner, etc. |
| src/auth/LockedScreen.tsx | Login UI (email/password form) |
| server/firebaseAdmin.ts | Server-side token verification via Firebase Admin SDK |

### Custom Claims (Firebase Auth)
typescript
{ role: 'FOUNDER' | 'TRUSTED_LEAD' | 'USER', accessLevel: number }


| Role | accessLevel | Permissions |
|------|-------------|-------------|
| ADMIN | 1 | Everything + admin panel (only rishaal@nextclass.ca) |
| FOUNDER | 2 | Full app access, incidents visible |
| TRUSTED_LEAD | 3 | Full access minus incidents |
| USER | 99 | Easy Entry + Schedule + Chat only |

### Token Flow
1. Client calls getAuthToken() -> Firebase ID token
2. Sends Authorization: Bearer <token> header
3. Server calls verifyToken(idToken) via Firebase Admin SDK
4. Extracts uid, role, accessLevel from verified token (ignores client-supplied values)
5. On 401 -> client force-refreshes token and retries once

### Route Guards
- FounderOnlyRoute -> redirects non-FOUNDER to /
- FounderOrLeadRoute -> allows FOUNDER + TRUSTED_LEAD
- OwnerOnlyRoute -> allows only accessLevel=1

---

## C) Database + File Storage

### Firestore (Cloud)
- **Database**: nomads-wr-db
- **13 collections**: issues, notes, incidents, comments, attachments, scheduleItems, people, auditEvents, chat/{userId}/conversations/{convId}/messages, referenceData, outboxMutations, appState, pendingSubmissions

### Dexie/IndexedDB (Local)
- **Database**: mag-fields-war-room (Dexie v5)
- **13 tables** with compound indexes for offline queries
- Schema: src/data/db.ts (118 lines)

### Key Collections

| Collection | Access | Key Fields |
|------------|--------|------------|
| issues | Visibility-scoped (canReadDocument()) | title, severity, status, category, location, visibleTo[] |
| notes | Visibility-scoped | body, linkedIssueIds[], visibleTo[] |
| incidents | Founder-only reads/creates | summary, details, accessPolicy='FOUNDER_ONLY' |
| comments | Founder/Lead read all; Users own only | parentType, parentId, body |
| attachments | Founder/Lead read all; Users own only | parentType, parentId, type, mimeType, localBlob, remoteUrl |
| chat/{userId} | Strict UID match (private) | conversations -> messages |
| auditEvents | Append-only (no update/delete) | actorId, action, diff, clientInfo |
| scheduleItems | Authenticated read; Founder/Lead write | title, stage, startsAt, endsAt |
| referenceData | Server-managed | locations[], categories[], locationTypes[] |

### Firestore Security Rules (firestore.rules, 128 lines)
canReadDocument() = isFounderOrLead() OR (createdBy == uid OR uid in visibleTo[])

- createdBy validated on creates
- visibleTo immutable for non-Founders
- Audit events: create + read only (no update/delete)
- Chat: strict UID path matching
- Default deny on unmatched paths

### Firebase Storage (storage.rules, 27 lines)
| Path | Access | Limit |
|------|--------|-------|
| attachments/{allPaths} | Any authenticated | 10 MB |
| uploads/{userId}/{allPaths} | Authenticated + UID match | 10 MB |

### Sync Mechanism (src/data/services/firestoreSync.ts, 267 lines)
- **Pull**: Firestore -> IndexedDB (last-write-wins by updatedAt)
- **Push**: IndexedDB -> Firestore (fire-and-forget via outbox)
- **Realtime**: onSnapshot listeners for live updates
- **Role filtering**: USER syncs only issues/notes (with createdBy/visibleTo query)

---

## D) Backend Compute

### Architecture
- **Cloud Run** (NOT Cloud Functions) - single container
- Node.js HTTP server (native http module, no Express)
- TypeScript executed directly via tsx (no compilation step)
- Manual pathname routing (18 endpoints)

### Server Files
| File | Lines | Purpose |
|------|-------|---------|
| server/index.ts | 967 | HTTP server, all 18 endpoints, auth middleware |
| server/geminiAssistant.ts | 1121 | Vertex AI integration, 6 function-calling tools, SSE streaming |
| server/transcribeAudio.ts | 95 | Audio transcription via Gemini |
| server/firebaseAdmin.ts | 84 | Firebase Admin SDK init, token verification |

### API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /, /health | None | Health check |
| GET | /api/ping | None | Keep-alive (Cloud Run warm) |
| GET | /api/reference-data/{type} | Bearer | Locations, categories, locationTypes |
| GET | /api/festival/schedule-csv | Bearer | Download schedule CSV |
| POST | /api/assistant/respond | Bearer | AI response (JSON) |
| POST | /api/assistant/stream | Bearer | AI response (SSE streaming) |
| POST | /api/transcribe | Bearer | Audio transcription |
| GET | /api/users | Bearer | List all users |
| GET | /api/users/display | Bearer | Resolve display names |
| GET | /api/admin/users | Owner | List users with claims |
| POST | /api/admin/users | Owner | Create user |
| POST | /api/admin/users/import-csv | Owner | Bulk CSV import |
| PATCH | /api/admin/users/{uid}/claims | Owner | Update claims |
| GET | /api/admin/chats | Owner | List conversations |
| GET | /api/admin/chats/{userId}/{convId}/messages | Owner | Read messages |
| GET/PUT | /api/admin/reference-data/{type} | Owner | Manage reference data |

### AI Integration (Vertex AI)
- Models: gemini-3-flash-preview (default), gemini-3-pro-preview (briefs)
- Auth: Application Default Credentials (ADC)
- 6 function-calling tools: search_issues, search_schedule, search_notes, lookup_people, get_locations, get_incidents
- Max 5 function-call rounds per request
- Temperature: 0.2, thinking budget: 2000 tokens
- SSE streaming with progress/chunk/done/error events

---

## E) Frontend

### Framework
- **Vite 7** + **React 19** + **TypeScript 5.9**
- **Tailwind CSS v4** (custom theme: cream, charcoal, olive, gold, brown)
- **PWA**: vite-plugin-pwa with Workbox (autoUpdate, navigateFallback)
- **Font**: IBM Plex Mono

### Route Structure
/ (AppLayout)
  / -> NowDashboardPage (USER: Easy Entry, FOUNDER: brief + entry)
  /issues -> FounderOrLeadRoute -> IssuesPage
  /schedule -> SchedulePage (all roles)
  /assistant -> AssistantPage (all roles)
  /incidents -> FounderOnlyRoute -> IncidentsPage
/admin -> OwnerOnlyRoute -> AdminPage


### Key Directories
src/
  auth/          Firebase auth, context, login UI
  components/    AppLayout, BottomNav, route guards
  data/          Dexie DB, sync manager, CRUD services
  domain/        TypeScript types + Zod schemas
  features/
    admin/       Admin panel (owner-only)
    assistant/   AI chat (SSE streaming, chat persistence)
    issues/      Issues board, audio recorder
    incidents/   Incident log (founder-only)
    schedule/    Festival schedule, CSV import
    now/         Easy Entry, auto-triage, confidence scoring
    shared/      Reference data, image capture, online status
  lib/           Firebase SDK init
  routes/        Route wrappers


### Mobile-First Patterns
- max-w-md (448px) container, auto-centered
- env(safe-area-inset-*) for notch/home indicator
- Touch targets: 44px minimum
- Image compression: max 1280px, JPEG 70%
- Audio: tap-to-start/tap-to-stop (MediaRecorder API)

### State Management
- No Redux/Zustand - uses React Context + local hooks
- GateAuthContext - auth state, role flags
- ReferenceDataContext - locations, categories from Firestore
- FirestoreSyncManager - headless sync orchestrator

---

## F) Meta Ray-Ban Metadata Analysis

### Sample Files
| File | Type | Size |
|------|------|------|
| sample meta photo.heic | HEIC (HEVC still image) | 618 KB |
| sample meta.MOV | QuickTime MOV (HEVC video) | 44 MB |

### HEIC Photo Metadata (exiftool output)

**Identifying fields (MUST STRIP):**
| Field | Location | Value |
|-------|----------|-------|
| Make | EXIF IFD0 | Meta AI |
| Camera Model Name | EXIF IFD0 | Ray-Ban Meta Smart Glasses |
| User Comment | EXIF SubIFD | AA747B50-302B-44D3-91AF-91976FF9A1DB (device UUID) |
| Serial Number | EXIF SubIFD | 2Q |

**Timestamp fields (review/strip):**
| Field | Location | Value |
|-------|----------|-------|
| Modify Date | EXIF IFD0 | 2026:02:14 18:19:47 |
| Date/Time Original | EXIF SubIFD | 2026:02:14 18:19:47 |
| Create Date | EXIF SubIFD | 2026:02:14 18:19:47 |
| Sub Sec Time | EXIF SubIFD | 811 |
| Sub Sec Time Original | EXIF SubIFD | 811 |
| Sub Sec Time Digitized | EXIF SubIFD | 811 |

**XMP block (MUST STRIP):**
xml
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 6.0.0">
  <rdf:RDF>
    <rdf:Description>
      <xmp:CreateDate>2026-02-14T18:19:47</xmp:CreateDate>
      <xmp:ModifyDate>2026-02-14T18:19:47</xmp:ModifyDate>
      <photoshop:DateCreated>2026-02-14T18:19:47</photoshop:DateCreated>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>


**Camera settings (safe to keep or strip):**
| Field | Value |
|-------|-------|
| Exposure Time | 1/120 |
| F Number | 2.2 |
| ISO | 255 |
| Focal Length | 2.2 mm |
| Focal Length 35mm | 13 mm |
| Flash | Off, Did not fire |
| Image Size | 3024 x 4032 (EXIF), 2701 x 3602 (Meta) |
| Light Source | D65 |

**GPS: NOT PRESENT** (no GPS IFD in this sample)

**HEIC container metadata:**
- Major Brand: heic (High Efficiency Image Format)
- Compatible Brands: heic, mif1
- HEVC Configuration: Main Still Picture profile
- Color: nclx, BT.601, Full Range, 8-bit

### MOV Video Metadata (exiftool output)

**Identifying fields (MUST STRIP) - stored in QuickTime [Keys] atoms:**
| Field | Location | Value |
|-------|----------|-------|
| Copyright | Keys/mdta | Meta AI |
| Model | Keys/mdta | Ray-Ban Meta Smart Glasses |
| Comment | Keys/mdta (binary) | app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=5540A1B7-8488-4E95-983D-7D03A782CD2E |
| Description | Keys/mdta | 2Q (serial number) |
| Android Version | Keys/mdta | 14 |

**Timestamp fields (review/strip):**
| Field | Location | Value |
|-------|----------|-------|
| Create Date | QuickTime mvhd | 2026:02:15 11:42:55 |
| Modify Date | QuickTime mvhd | 2026:02:15 11:42:56 |
| Track Create Date | Track1/Track2 | 2026:02:15 11:42:55 |
| Track Modify Date | Track1/Track2 | 2026:02:15 11:42:56 |
| Media Create Date | Track2 | 2026:02:15 11:42:55 |
| Media Modify Date | Track2 | 2026:02:15 11:42:56 |
| Creation Date | Keys/mdta | 2026:02:15 01:33:42Z |

**Video/Audio specs (safe to keep):**
| Field | Value |
|-------|-------|
| Resolution | 1376 x 1840 |
| Duration | 24.36 s |
| Video Codec | hvc1 (HEVC) |
| Frame Rate | 30.005 fps |
| Bitrate | 14.5 Mbps |
| Audio Codec | mp4a (AAC) |
| Audio Channels | 2 (stereo) |
| Audio Sample Rate | 48000 Hz |
| Audio Bits | 16 |

**GPS: NOT PRESENT** (no GPS atoms in this sample)

### Comment Field Structure (URL-encoded params)
The MOV Comment field uses a URL query-string format:
app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=5540A1B7-8488-4E95-983D-7D03A782CD2E

- app = Application name
- device = Device model
- id = Unique device/session UUID

### Stripping Strategy Summary

**HEIC Photos - fields to remove/overwrite:**
1. EXIF Make -> remove or set to empty
2. EXIF Model -> remove or set to empty
3. EXIF UserComment -> remove (contains device UUID)
4. EXIF SerialNumber -> remove
5. XMP block -> remove entirely (contains dates)
6. EXIF DateTime, DateTimeOriginal, DateTimeDigitized -> optionally strip or keep
7. EXIF SubSecTime* -> remove (high-precision timestamps)

**MOV Videos - fields to remove/overwrite:**
1. Keys/Copyright -> remove (Meta AI)
2. Keys/Model -> remove (Ray-Ban Meta Smart Glasses)
3. Keys/Comment -> remove (contains app, device, UUID)
4. Keys/Description -> remove (2Q serial)
5. Keys/AndroidVersion -> remove (14)
6. Keys/CreationDate -> optionally strip
7. QuickTime CreateDate/ModifyDate -> optionally strip or keep
8. Track timestamps -> optionally strip or keep

**Tools for stripping:**
bash
# HEIC: Strip all Meta-identifying fields
exiftool -Make= -Model= -UserComment= -SerialNumber= \
  -XMP:all= -SubSecTime= -SubSecTimeOriginal= -SubSecTimeDigitized= \
  "photo.heic"

# MOV: Strip Meta-identifying QuickTime atoms
exiftool -Copyright= -Model= -Comment= -Description= \
  -AndroidVersion= -CreationDate= \
  "video.mov"

# Nuclear option: strip ALL metadata
exiftool -all= "file.heic"
exiftool -all= "file.mov"


---

## G) How to Extend (Developer Quick Reference)

### Local Development Setup
bash
# Prerequisites
nvm use 22
npm install

# Auth setup (GCP)
gcloud auth application-default login
gcloud config set project magfield-487008

# Copy environment
cp .env.example .env
# Fill in any missing values

# Run dev server (Vite + Node server concurrently)
npm run dev
# Frontend: https://localhost:5173
# Server: http://localhost:3002


### Adding a New Feature
1. Create src/features/[feature]/[Feature]Page.tsx
2. Create src/routes/[Feature]Route.tsx (lazy wrapper)
3. Add route to src/app/router.tsx with role guard if needed
4. Add nav item to src/components/BottomNav.tsx with minRole
5. Add data service in src/data/services/[feature]Service.ts
6. If new data: bump Dexie version in src/data/db.ts, add table
7. If synced: add collection to firestoreSync.ts pull/push/realtime
8. If secured: add rules to firestore.rules

### For the Metadata Stripper App
You'll need a **new Firebase project** (separate from magfield-487008):
1. Create project in Firebase Console
2. Enable Auth (email/password or Google)
3. Enable Storage (for uploaded files)
4. No Firestore needed initially (unless tracking processing history)
5. Deploy frontend to Firebase Hosting
6. If server-side processing: Cloud Run with exiftool in container
7. Or: client-side only with browser-based EXIF/XMP stripping libraries

### Key Libraries for Metadata Stripping
- **Server-side**: exiftool CLI (Perl-based, comprehensive, handles HEIC + MOV)
- **Client-side JS**: piexifjs (JPEG only), exif-js (read-only), or custom binary parsing
- **HEIC challenge**: Browser-native HEIC support is limited; may need server-side processing
- **MOV challenge**: QuickTime atom parsing requires binary-level manipulation; ffmpeg or exiftool recommended

---

## Risks & Quirks

1. **No CORS middleware** on Cloud Run - relies on Firebase Hosting proxy
2. **No rate limiting** - valid token can spam AI endpoints (Gemini billing exposure)
3. **No Express/framework** - manual HTTP routing in server/index.ts
4. **tsx at runtime** - TypeScript compiled on-the-fly in production (no build step for server)
5. **Outbox mutations local-only** - if user clears browser data before sync, mutations are lost
6. **No explicit Firestore indexes** - relies on auto-indexing (may be slow for compound queries)
7. **Audit events readable by all** - authenticated users can read all audit events regardless of role
8. **Firebase config in .env.example** - API key is committed (safe per Firebase design, but notable)
9. **Cloud Run timeout 900s** - long Gemini calls could timeout on non-streaming endpoint
10. **HEIC GPS** - not present in sample, but Ray-Ban Meta glasses CAN embed GPS (check other samples)"""

also said this before and after , hope its helpful!:
"""this is read-only research only, no code changes. I just wrote the audit document to
  assets/meta/STACK_AUDIT.md compiling all findings from the 6 agents.
                                                                                                        
  Here's what it covers:
                                                                                                        
  - Stack diagram (text boxes/arrows showing the full architecture)
  - A) Deployment - firebase.json, Dockerfile, CI/CD, deploy commands
  - B) Auth - Firebase email/password, custom claims, role hierarchy, token flow
  - C) Database + Storage - Firestore model (13 collections), Dexie offline, Storage rules, sync
  mechanism
  - D) Backend - Cloud Run (Node.js + tsx), 18 API endpoints, Vertex AI integration
  - E) Frontend - Vite + React 19 + TypeScript, PWA, route structure, mobile-first patterns
  - F) Meta Ray-Ban Metadata Analysis - detailed breakdown of HEIC EXIF/XMP and MOV QuickTime atoms,
  with exact fields to strip and exiftool commands
  - G) How to Extend - dev setup, adding features, recommendations for new Firebase project

  Key metadata findings for your stripper app:
  - HEIC: Make=Meta AI, Model=Ray-Ban Meta Smart Glasses, UserComment=device UUID, XMP dates, serial
  number
  - MOV: Copyright=Meta AI, Model=Ray-Ban Meta Smart Glasses, Comment=app=Meta AI&device=...&id=UUID,
  AndroidVersion=14, serial in Description
  - No GPS in these samples (but the glasses can embed it)
  - Both use HEVC codec (hvc1)

  The metadata agent (a898d16) is still running deep analysis with Python EXIF parsing, but the exiftool
   output I ran covers everything needed. Want me to stop it, or let it finish for extra detail?

✻ Cooked for 4m 25s                                                           

⏺ Agent "Analyze Meta RayBan metadata" completed                                                        
  
⏺ The metadata agent just finished too. It confirmed everything I already captured, plus added some     
  useful extras:                                           
                                                                                                        
  Cross-file findings:                                     
  - UUIDs are per-capture (different in photo vs video), not per-device - but still trackable           
  - The 2Q code appears in both files (likely hardware revision, not full serial)                       
  - The glasses run Android 14 internally                                                               
  - The Comment field in MOV uses URL-encoded format designed for server-side analytics parsing

  Notable absences (not in these samples):
  - No Facebook/Instagram account IDs
  - No Wi-Fi/Bluetooth MAC addresses
  - No gyroscope/sensor data
  - No firmware version
  - No GPS (though other captures may have it)

  Top library recommendation for your new app: exiftool-vendored (Node.js wrapper) - handles HEIC + MOV
  comprehensively. Browser-side JS libraries mostly only support JPEG.

  Everything is in assets/meta/STACK_AUDIT.md - one document covering the full War Room stack audit +
  the Ray-Ban metadata breakdown. No code was changed, just that one research document written.

❯ so i'm good to send it to? i don't need the ai features of course but hope this is enough info        
  for chat gpt to gather and process a prompt and design?                                              
                                                                                                        
⏺ Yeah, assets/meta/STACK_AUDIT.md is self-contained and should give ChatGPT everything it needs to     
  design the metadata stripper app:                                                                     
                                                                                                        
  - Full deployment stack pattern to replicate (Firebase Hosting + Cloud Run)                           
  - Auth setup to copy (Firebase Auth, though you can simplify - skip custom claims/roles if it's       
  single-user)                                                                                          
  - Exact metadata fields to strip from HEIC and MOV (with exiftool tags, privacy risk levels, and      
  commands)
  - The Comment field's URL-encoded structure (app=...&device=...&id=...)
  - Library recommendations (exiftool-vendored for Node.js)
  - New Firebase project setup steps

  The AI/Gemini/Dexie/offline-sync stuff is War Room-specific and won't apply - but ChatGPT will know to
   ignore it based on context.

  One thing to flag: if you want browser-only stripping (no server), HEIC support in JS is very limited.
   You'd likely need a Cloud Run backend with exiftool installed in the Docker image, similar to how the
   War Room server is set up. That's worth mentioning in your prompt to ChatGPT so it designs the right
  architecture.
"""

ChatGPT said:

Thought for 14m 30s

ChatGPT said:
You handed me exactly what I needed: the stack is Firebase Hosting → /api/** rewrite → Cloud Run (Node 22 + tsx + manual router) → Firestore + Storage, with a mobile-first Vite/React/PWA frontend. And your metadata targets are now specific, not hand-wavy. Below is a single “build prompt” tuned to this repo’s reality (file paths, routing style, auth style, rules style). Paste it into your Cloud Code multi-agent workflow.
MASTER BUILD PROMPT (tailored to MagFieldsWarRoom stack)
You are a multi-agent dev team implementing a new mobile-first feature inside THIS repo:
Repo: /Users/rishaal/CODING/MagFieldsWarRoom
Project: magfield-487008
Existing hosting pattern: Firebase Hosting serves Vite dist/ and rewrites /api/** to Cloud Run service war-room-server.
Existing server pattern: server/index.ts manual HTTP routing, Firebase Admin token verification, Node 22 + tsx runtime.
Existing storage rules have a 10MB limit; this MUST be updated for video use-cases.

Build a dead-simple PWA feature called “Media Tools” with two tools:
1) MetaScrub — remove Ray-Ban Meta attribution + tracking metadata from HEIC/JPG and MOV/MP4 WITHOUT destroying other metadata.
2) Stitch — stitch multiple Ray-Ban clips into one longer video; name output predictably; then run MetaScrub on the merged output.

NON-GOALS:
- Do not touch the Vertex AI / Gemini assistant features.
- Do not introduce Dexie offline sync for this feature (keep it simple). If you use IndexedDB, use it only for temporary UI state (optional).

--------------------------------------------
A) PRODUCT REQUIREMENTS (very specific)
--------------------------------------------

User flow (mobile-first):
- User signs in (prefer Google Auth; keep existing email/password login working).
- User opens a new route: /media-tools
- Mode selector tabs: “Scrub metadata” | “Stitch videos”
- User selects multiple files.
- App uploads originals to Firebase Storage under uploads/{uid}/mediaTools/{jobId}/...
- App starts processing (backend compute, not client heavy).
- App shows job progress + per-file status.
- App provides downloads:
  - download each output file
  - “Download all” (zip) optional
- For Stitch:
  - user selects 2+ videos and can reorder
  - output filename includes indices “_1” “_2” etc OR “_1-2-3_merged”
  - after stitching, run MetaScrub on the merged file
- Keep other metadata (timestamps, GPS if present) UNLESS it is clearly Meta/Ray-Ban attribution/tracking.

Core metadata targets to remove (based on exiftool analysis in assets/meta/STACK_AUDIT.md):
HEIC / photo:
- EXIF:Make (value like “Meta AI”)
- EXIF:Model / Camera Model Name (value “Ray-Ban Meta Smart Glasses”)
- EXIF:UserComment (contains UUID-like value)
- EXIF:SerialNumber (value “2Q” in sample)
- Any XMP fields that contain Meta/Ray-Ban strings (DO NOT blanket delete XMP in minimal mode)

MOV / video (QuickTime Keys/mdta atoms):
- Keys:Copyright = “Meta AI”
- Keys:Model = “Ray-Ban Meta Smart Glasses”
- Keys:Comment = “app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=<UUID>”
- Keys:Description = “2Q”
- Keys:AndroidVersion = “14”
- Any other tags whose VALUE matches /(meta|ray-?ban|meta view|meta ai)/i

IMPORTANT: Do NOT implement “strip all metadata”. Implement surgical removal:
- First read metadata (exiftool JSON).
- Decide which tags to remove based on tag name + value matching.
- Then write only those removals to the output file.

Add two scrub modes:
- “Attribution only” (default): removes Make/Model/Comment and obvious Meta attribution tags.
- “Attribution + privacy”: also removes UUID-like identifiers (UserComment/id fields, serial-ish fields), and high-precision SubSecTime* ONLY if you can justify it as fingerprinting. Keep DateTimeOriginal/CreateDate unless user toggles “privacy mode”.

--------------------------------------------
B) ARCHITECTURE (must match this repo’s conventions)
--------------------------------------------

Frontend:
- Vite + React 19 + TS + Tailwind v4 + PWA plugin already present.
- Add new feature folder: src/features/mediaTools/
- Add page route: src/features/mediaTools/MediaToolsPage.tsx
- Add route wiring in src/app/router.tsx (or wherever router is defined).
- Add BottomNav item only for authenticated users (optionally Owner-only).
- Reuse GateAuthContext for auth state, but the Tools page should not depend on custom claims to function.

Auth:
- Add Google login support via Firebase Auth GoogleAuthProvider.
- For mobile PWA, prefer signInWithRedirect (popups are flaky). Provide fallback signInWithPopup for desktop.
- Keep email/password working (do not break LockedScreen).

Backend compute (Cloud Run):
- Extend the existing Cloud Run service (war-room-server) with new API endpoints under /api/media/** OR create a new Cloud Run service and new rewrite path. Default to extending the existing service for speed, but call out trade-offs.
- Keep manual routing style in server/index.ts (no Express).
- All new endpoints must verify Firebase ID token via existing verifyToken flow (Authorization: Bearer <idToken>).
- Use Firebase Admin SDK to read/write Firestore + Storage from Cloud Run.

Storage + Firestore:
- Use Firebase Storage for all blobs.
- Use Firestore ONLY to track job state/history:
  Collection: mediaJobs
  Fields:
    - createdBy (uid)
    - type: "scrub" | "stitch"
    - status: "queued" | "processing" | "done" | "error"
    - createdAt, updatedAt (server timestamps)
    - inputs: [{name, storagePath, mime, size}]
    - stitchOrder?: [index...]
    - outputs: [{name, storagePath, mime, size}]
    - reportPath (storage path to JSON report)
    - error?: {message, details?}
    - progress?: {current, total, phase}

Security:
- Update firestore.rules with a simple rule:
  allow read/write on mediaJobs only if request.auth.uid == resource.data.createdBy (and enforce createdBy on create).
- Update storage.rules:
  - allow uploads/reads under uploads/{uid}/mediaTools/** only if request.auth.uid == uid.
  - raise max file size for this path (videos are way bigger than 10MB). Pick a sane limit like 1GB or 2GB.
  - outputs stored under outputs/{uid}/mediaTools/** same UID restriction.

--------------------------------------------
C) API ENDPOINTS (keep it minimal, but robust)
--------------------------------------------

Add to server/index.ts (or extracted module) endpoints like:

1) POST /api/media/jobs
Auth: Bearer token required
Body:
  {
    type: "scrub" | "stitch",
    inputs: [{storagePath, name, mime, size}],
    options: { scrubMode: "attribution"|"privacy", compressImages?: boolean, imageMaxPx?: number, imageQuality?: number },
    stitchOrder?: number[]
  }
Server:
- Validate inputs strongly.
- Create Firestore job doc in mediaJobs (status=queued).
- Return { jobId }.

2) POST /api/media/jobs/{jobId}/process
Auth: Bearer token required
Server:
- Load job doc, verify createdBy matches uid.
- status -> processing
- Download inputs from Storage to /tmp/{jobId}/
- If scrub:
  - for each file:
    - metadata = exiftool -json -G1 -a -s
    - decide tags to remove
    - copy original to output file
    - exiftool write removals to output (overwrite_original on the copy)
    - optional image compression (only if enabled)
    - upload output to outputs/{uid}/mediaTools/{jobId}/...
    - record removed tags into a report object
- If stitch:
  - download videos to /tmp
  - create concat list file
  - ffmpeg try: concat demuxer + -c copy
  - fallback: re-encode to H.264/AAC if concat fails
  - run exiftool scrub on merged output
  - upload merged output
- Upload report JSON to reports/{uid}/mediaTools/{jobId}/report.json
- status -> done, set outputs + reportPath

3) GET /api/media/jobs/{jobId}
Auth required
Server returns sanitized job doc (or just rely on Firestore client reads; choose one approach and be consistent).

Prefer Firestore reads client-side for live progress, but keep a server read endpoint if that matches repo conventions.

--------------------------------------------
D) IMPLEMENTATION DETAILS (do not screw these up)
--------------------------------------------

1) Install tooling inside Cloud Run container
- Update Dockerfile to install ffmpeg + exiftool.
  Example for Debian slim:
    apt-get update && apt-get install -y ffmpeg libimage-exiftool-perl && rm -rf /var/lib/apt/lists/*
- Confirm exiftool can read/write HEIC and MOV in container.

2) ExifTool approach (safe and surgical)
- Never run exiftool -all=.
- Always:
  - Read JSON first.
  - Decide tags to remove only if tag values match Meta/Ray-Ban patterns OR are known Meta fields listed above.
- Write removals only to a COPY of the file, not the original upload.

3) Value matching patterns
Use a robust matcher:
- /(meta|ray-?ban|meta view|meta ai)/i
Also detect UUID-like values:
- /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

4) HEIC notes
Browser-side HEIC editing is unreliable; do it server-side.

5) File sizes and timeouts
- Videos can be huge. Update Cloud Run settings (memory, CPU, timeout) accordingly.
- Keep processing sequential per job (simpler + avoids RAM spikes).

6) Downloads on mobile
- Provide direct download links from Storage (signed URL optional; public URLs not recommended).
- For PWA/iOS, implement a “Share” button using Web Share API when available.

--------------------------------------------
E) FILES YOU MUST TOUCH (path-specific)
--------------------------------------------

Frontend:
- src/features/mediaTools/MediaToolsPage.tsx (new)
- src/routes/... add route wrapper if needed
- src/app/router.tsx (add /media-tools route)
- src/components/BottomNav.tsx (add Tools tab)
- src/auth/LockedScreen.tsx (add “Sign in with Google” button)
- src/auth/firebaseAuth.ts (add google login helper)
- src/lib/firebase.ts (ensure Auth provider import patterns are correct)

Backend:
- server/index.ts (add routing + handlers)
- server/firebaseAdmin.ts (reuse existing admin init)
- server/mediaTools.ts (new module: exiftool + ffmpeg helpers)

Infra:
- Dockerfile (install ffmpeg + exiftool)
- firebase.json (if you add a new rewrite path; otherwise leave)
- firestore.rules (add mediaJobs rules)
- storage.rules (increase file size limits & add outputs path)

Docs:
- assets/meta/MEDIA_TOOLS_README.md (new): how to use + deploy notes + limits

--------------------------------------------
F) DEFINITION OF DONE
--------------------------------------------

- I can sign in with Google on mobile and reach /media-tools.
- Upload 1 HEIC from Ray-Ban Meta → output file has NO Meta Make/Model/UserComment/Serial fields, but preserves DateTimeOriginal and other camera exposure metadata.
- Upload 1 MOV from Ray-Ban Meta → output has NO Keys:Comment/Model/Copyright/Description/AndroidVersion.
- Stitch 2 videos → output plays continuously; then scrub applied; output filename includes “_1-2”.
- Firestore rules prevent access to other users’ jobs.
- Storage rules allow larger video files under uploads/{uid}/mediaTools/** and outputs/{uid}/mediaTools/**.
- Cloud Run container builds successfully with ffmpeg + exiftool installed.

Deliver code as PR-ready changes with clear commit messages and minimal blast radius.
Two tactical notes (so your agents don’t build a fragile thing)
Don’t delete XMP “just because.”
Your audit sample’s XMP block is dates-only. That’s not Meta attribution. If you want to preserve “all other metadata,” only remove XMP tags whose values match Meta/Ray‑Ban patterns, unless the user picks “privacy mode.”
Your existing Storage 10MB cap will hard-fail videos.
Agents must update storage.rules specifically for the uploads/{uid}/mediaTools/** path (and outputs) with a bigger size limit. Otherwise the app is a nice UI that can’t upload real Ray‑Ban clips.
If you drop your CLAUD.md + agents.md, I can rewrite the master prompt to match your exact agent roles, your “work sessions” folder ritual, and how you like tasks chunked (frontend vs server vs rules vs deploy).

You said:
ok here's the infromation it returned, is this helpful?
# MagFieldsWarRoom Full Stack Audit
**Purpose**: Reference for building the Meta Ray-Ban Metadata Stripper app
**Generated**: 2026-02-15
**Repo**: /Users/rishaal/CODING/MagFieldsWarRoom
**GCP Project**: magfield-487008

---

## Stack Diagram

BROWSER (Mobile-first PWA)
                    ┌──────────────────────────────────────┐
                    │  Vite + React 19 + TypeScript 5.9    │
                    │  Tailwind v4 + IBM Plex Mono font    │
                    │  Dexie v5 (IndexedDB) — offline-first│
                    │  Service Worker (Workbox / vite-pwa)  │
                    │  Firebase Auth SDK (email/password)   │
                    └──────────────┬───────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼───────────────────────┐
                    │       Firebase Hosting                │
                    │  magfield-487008.web.app              │
                    │  Serves dist/  (Vite build output)   │
                    │  Rewrites /api/** → Cloud Run        │
                    │  Cache: assets immutable, sw no-cache │
                    └──────────────┬───────────────────────┘
                                   │ /api/**
                    ┌──────────────▼───────────────────────┐
                    │       Cloud Run                      │
                    │  war-room-server (us-central1)       │
                    │  Node 22 + tsx (TypeScript direct)   │
                    │  Port 8080, min-instances=1          │
                    │  18 API endpoints (manual routing)   │
                    │  Bearer token auth (Firebase Admin)  │
                    └──┬──────────┬────────────────┬──────┘
                       │          │                │
              ┌────────▼──┐ ┌────▼────────┐ ┌─────▼──────┐
              │ Firestore  │ │ Vertex AI   │ │ Firebase   │
              │ nomads-    │ │ Gemini 3    │ │ Storage    │
              │ wr-db      │ │ Flash/Pro   │ │ 10MB limit │
              │ 13 colls   │ │ + STT       │ │ attachments│
              └────────────┘ └─────────────┘ └────────────┘


---

## A) Deployment & Environments

### Config Files

| File | Purpose |
|------|---------|
| firebase.json | Hosting config, Cloud Run rewrite, Firestore/Storage rules paths, cache headers |
| .firebaserc | Project alias: magfield-487008 |
| Dockerfile | Cloud Run container: Node 22-slim, tsx runtime, port 8080 |
| .github/workflows/ci.yml | CI: typecheck (3 tsconfigs), lint, test, build, security audit |
| vite.config.ts | Dev server (HTTPS, /api proxy), PWA plugin, Tailwind |
| .env.example | All env vars documented |
| .nvmrc | Node 22 |
| tsconfig.server.json | Server TypeScript: ES2023, NodeNext, strict |

### Hosting Architecture
- **Firebase Hosting** serves dist/ (Vite build output)
- /api/** rewrites to Cloud Run service war-room-server in us-central1
- ** falls back to /index.html (SPA routing)
- Cache: assets/** = immutable 1-year, sw.js + workbox-*.js = no-cache

### Environment Variables

**Client-side (VITE_ prefix, safe to expose):**
- VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID

**Server-side:**
- PORT (3002 dev, 8080 Cloud Run)
- GCP_PROJECT_ID = magfield-487008
- VERTEX_LOCATION = global
- GOOGLE_TEXT_MODEL_DEFAULT = gemini-3-flash-preview
- GOOGLE_TEXT_MODEL_PRO = gemini-3-pro-preview
- FIREBASE_SERVICE_ACCOUNT_JSON (Cloud Run only; local uses ADC)

### Deploy Commands

bash
# 1. Firestore rules (MUST deploy first for new roles)
npx firebase-tools deploy --only firestore:rules --project magfield-487008

# 2. Cloud Run server
gcloud run deploy war-room-server \
  --source . \
  --region us-central1 \
  --project magfield-487008 \
  --allow-unauthenticated \
  --port 8080

# 3. Frontend (Firebase Hosting)
npm run build && npx firebase-tools deploy --only hosting --project magfield-487008


### CI/CD (GitHub Actions)
Triggers on push to main and PRs to main:
1. tsc --noEmit (3 tsconfigs: app, node, server)
2. npm run lint (max-warnings=0)
3. npm test (Vitest)
4. npm run build (tsc + vite)
5. npm audit --audit-level=high

---

## B) Authentication

### Login Flow
- **Method**: Email + password only (Firebase signInWithEmailAndPassword)
- **No**: OAuth, 2FA, magic links, social login

### Key Files
| File | Purpose |
|------|---------|
| src/lib/firebase.ts | Firebase SDK init (Auth, Firestore with persistent cache, Storage) |
| src/auth/firebaseAuth.ts | loginWithEmail(), logout(), getUserClaims(), getAuthToken() |
| src/auth/GateAuthContext.tsx | React auth context: user, role, accessLevel, isFounder, isOwner, etc. |
| src/auth/LockedScreen.tsx | Login UI (email/password form) |
| server/firebaseAdmin.ts | Server-side token verification via Firebase Admin SDK |

### Custom Claims (Firebase Auth)
typescript
{ role: 'FOUNDER' | 'TRUSTED_LEAD' | 'USER', accessLevel: number }


| Role | accessLevel | Permissions |
|------|-------------|-------------|
| ADMIN | 1 | Everything + admin panel (only rishaal@nextclass.ca) |
| FOUNDER | 2 | Full app access, incidents visible |
| TRUSTED_LEAD | 3 | Full access minus incidents |
| USER | 99 | Easy Entry + Schedule + Chat only |

### Token Flow
1. Client calls getAuthToken() -> Firebase ID token
2. Sends Authorization: Bearer <token> header
3. Server calls verifyToken(idToken) via Firebase Admin SDK
4. Extracts uid, role, accessLevel from verified token (ignores client-supplied values)
5. On 401 -> client force-refreshes token and retries once

### Route Guards
- FounderOnlyRoute -> redirects non-FOUNDER to /
- FounderOrLeadRoute -> allows FOUNDER + TRUSTED_LEAD
- OwnerOnlyRoute -> allows only accessLevel=1

---

## C) Database + File Storage

### Firestore (Cloud)
- **Database**: nomads-wr-db
- **13 collections**: issues, notes, incidents, comments, attachments, scheduleItems, people, auditEvents, chat/{userId}/conversations/{convId}/messages, referenceData, outboxMutations, appState, pendingSubmissions

### Dexie/IndexedDB (Local)
- **Database**: mag-fields-war-room (Dexie v5)
- **13 tables** with compound indexes for offline queries
- Schema: src/data/db.ts (118 lines)

### Key Collections

| Collection | Access | Key Fields |
|------------|--------|------------|
| issues | Visibility-scoped (canReadDocument()) | title, severity, status, category, location, visibleTo[] |
| notes | Visibility-scoped | body, linkedIssueIds[], visibleTo[] |
| incidents | Founder-only reads/creates | summary, details, accessPolicy='FOUNDER_ONLY' |
| comments | Founder/Lead read all; Users own only | parentType, parentId, body |
| attachments | Founder/Lead read all; Users own only | parentType, parentId, type, mimeType, localBlob, remoteUrl |
| chat/{userId} | Strict UID match (private) | conversations -> messages |
| auditEvents | Append-only (no update/delete) | actorId, action, diff, clientInfo |
| scheduleItems | Authenticated read; Founder/Lead write | title, stage, startsAt, endsAt |
| referenceData | Server-managed | locations[], categories[], locationTypes[] |

### Firestore Security Rules (firestore.rules, 128 lines)
canReadDocument() = isFounderOrLead() OR (createdBy == uid OR uid in visibleTo[])

- createdBy validated on creates
- visibleTo immutable for non-Founders
- Audit events: create + read only (no update/delete)
- Chat: strict UID path matching
- Default deny on unmatched paths

### Firebase Storage (storage.rules, 27 lines)
| Path | Access | Limit |
|------|--------|-------|
| attachments/{allPaths} | Any authenticated | 10 MB |
| uploads/{userId}/{allPaths} | Authenticated + UID match | 10 MB |

### Sync Mechanism (src/data/services/firestoreSync.ts, 267 lines)
- **Pull**: Firestore -> IndexedDB (last-write-wins by updatedAt)
- **Push**: IndexedDB -> Firestore (fire-and-forget via outbox)
- **Realtime**: onSnapshot listeners for live updates
- **Role filtering**: USER syncs only issues/notes (with createdBy/visibleTo query)

---

## D) Backend Compute

### Architecture
- **Cloud Run** (NOT Cloud Functions) - single container
- Node.js HTTP server (native http module, no Express)
- TypeScript executed directly via tsx (no compilation step)
- Manual pathname routing (18 endpoints)

### Server Files
| File | Lines | Purpose |
|------|-------|---------|
| server/index.ts | 967 | HTTP server, all 18 endpoints, auth middleware |
| server/geminiAssistant.ts | 1121 | Vertex AI integration, 6 function-calling tools, SSE streaming |
| server/transcribeAudio.ts | 95 | Audio transcription via Gemini |
| server/firebaseAdmin.ts | 84 | Firebase Admin SDK init, token verification |

### API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /, /health | None | Health check |
| GET | /api/ping | None | Keep-alive (Cloud Run warm) |
| GET | /api/reference-data/{type} | Bearer | Locations, categories, locationTypes |
| GET | /api/festival/schedule-csv | Bearer | Download schedule CSV |
| POST | /api/assistant/respond | Bearer | AI response (JSON) |
| POST | /api/assistant/stream | Bearer | AI response (SSE streaming) |
| POST | /api/transcribe | Bearer | Audio transcription |
| GET | /api/users | Bearer | List all users |
| GET | /api/users/display | Bearer | Resolve display names |
| GET | /api/admin/users | Owner | List users with claims |
| POST | /api/admin/users | Owner | Create user |
| POST | /api/admin/users/import-csv | Owner | Bulk CSV import |
| PATCH | /api/admin/users/{uid}/claims | Owner | Update claims |
| GET | /api/admin/chats | Owner | List conversations |
| GET | /api/admin/chats/{userId}/{convId}/messages | Owner | Read messages |
| GET/PUT | /api/admin/reference-data/{type} | Owner | Manage reference data |

### AI Integration (Vertex AI)
- Models: gemini-3-flash-preview (default), gemini-3-pro-preview (briefs)
- Auth: Application Default Credentials (ADC)
- 6 function-calling tools: search_issues, search_schedule, search_notes, lookup_people, get_locations, get_incidents
- Max 5 function-call rounds per request
- Temperature: 0.2, thinking budget: 2000 tokens
- SSE streaming with progress/chunk/done/error events

---

## E) Frontend

### Framework
- **Vite 7** + **React 19** + **TypeScript 5.9**
- **Tailwind CSS v4** (custom theme: cream, charcoal, olive, gold, brown)
- **PWA**: vite-plugin-pwa with Workbox (autoUpdate, navigateFallback)
- **Font**: IBM Plex Mono

### Route Structure
/ (AppLayout)
  / -> NowDashboardPage (USER: Easy Entry, FOUNDER: brief + entry)
  /issues -> FounderOrLeadRoute -> IssuesPage
  /schedule -> SchedulePage (all roles)
  /assistant -> AssistantPage (all roles)
  /incidents -> FounderOnlyRoute -> IncidentsPage
/admin -> OwnerOnlyRoute -> AdminPage


### Key Directories
src/
  auth/          Firebase auth, context, login UI
  components/    AppLayout, BottomNav, route guards
  data/          Dexie DB, sync manager, CRUD services
  domain/        TypeScript types + Zod schemas
  features/
    admin/       Admin panel (owner-only)
    assistant/   AI chat (SSE streaming, chat persistence)
    issues/      Issues board, audio recorder
    incidents/   Incident log (founder-only)
    schedule/    Festival schedule, CSV import
    now/         Easy Entry, auto-triage, confidence scoring
    shared/      Reference data, image capture, online status
  lib/           Firebase SDK init
  routes/        Route wrappers


### Mobile-First Patterns
- max-w-md (448px) container, auto-centered
- env(safe-area-inset-*) for notch/home indicator
- Touch targets: 44px minimum
- Image compression: max 1280px, JPEG 70%
- Audio: tap-to-start/tap-to-stop (MediaRecorder API)

### State Management
- No Redux/Zustand - uses React Context + local hooks
- GateAuthContext - auth state, role flags
- ReferenceDataContext - locations, categories from Firestore
- FirestoreSyncManager - headless sync orchestrator

---

## F) Meta Ray-Ban Metadata Analysis

### Sample Files
| File | Type | Size |
|------|------|------|
| sample meta photo.heic | HEIC (HEVC still image) | 618 KB |
| sample meta.MOV | QuickTime MOV (HEVC video) | 44 MB |

### HEIC Photo Metadata (exiftool output)

**Identifying fields (MUST STRIP):**
| Field | Location | Value |
|-------|----------|-------|
| Make | EXIF IFD0 | Meta AI |
| Camera Model Name | EXIF IFD0 | Ray-Ban Meta Smart Glasses |
| User Comment | EXIF SubIFD | AA747B50-302B-44D3-91AF-91976FF9A1DB (device UUID) |
| Serial Number | EXIF SubIFD | 2Q |

**Timestamp fields (review/strip):**
| Field | Location | Value |
|-------|----------|-------|
| Modify Date | EXIF IFD0 | 2026:02:14 18:19:47 |
| Date/Time Original | EXIF SubIFD | 2026:02:14 18:19:47 |
| Create Date | EXIF SubIFD | 2026:02:14 18:19:47 |
| Sub Sec Time | EXIF SubIFD | 811 |
| Sub Sec Time Original | EXIF SubIFD | 811 |
| Sub Sec Time Digitized | EXIF SubIFD | 811 |

**XMP block (MUST STRIP):**
xml
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 6.0.0">
  <rdf:RDF>
    <rdf:Description>
      <xmp:CreateDate>2026-02-14T18:19:47</xmp:CreateDate>
      <xmp:ModifyDate>2026-02-14T18:19:47</xmp:ModifyDate>
      <photoshop:DateCreated>2026-02-14T18:19:47</photoshop:DateCreated>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>


**Camera settings (safe to keep or strip):**
| Field | Value |
|-------|-------|
| Exposure Time | 1/120 |
| F Number | 2.2 |
| ISO | 255 |
| Focal Length | 2.2 mm |
| Focal Length 35mm | 13 mm |
| Flash | Off, Did not fire |
| Image Size | 3024 x 4032 (EXIF), 2701 x 3602 (Meta) |
| Light Source | D65 |

**GPS: NOT PRESENT** (no GPS IFD in this sample)

**HEIC container metadata:**
- Major Brand: heic (High Efficiency Image Format)
- Compatible Brands: heic, mif1
- HEVC Configuration: Main Still Picture profile
- Color: nclx, BT.601, Full Range, 8-bit

### MOV Video Metadata (exiftool output)

**Identifying fields (MUST STRIP) - stored in QuickTime [Keys] atoms:**
| Field | Location | Value |
|-------|----------|-------|
| Copyright | Keys/mdta | Meta AI |
| Model | Keys/mdta | Ray-Ban Meta Smart Glasses |
| Comment | Keys/mdta (binary) | app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=5540A1B7-8488-4E95-983D-7D03A782CD2E |
| Description | Keys/mdta | 2Q (serial number) |
| Android Version | Keys/mdta | 14 |

**Timestamp fields (review/strip):**
| Field | Location | Value |
|-------|----------|-------|
| Create Date | QuickTime mvhd | 2026:02:15 11:42:55 |
| Modify Date | QuickTime mvhd | 2026:02:15 11:42:56 |
| Track Create Date | Track1/Track2 | 2026:02:15 11:42:55 |
| Track Modify Date | Track1/Track2 | 2026:02:15 11:42:56 |
| Media Create Date | Track2 | 2026:02:15 11:42:55 |
| Media Modify Date | Track2 | 2026:02:15 11:42:56 |
| Creation Date | Keys/mdta | 2026:02:15 01:33:42Z |

**Video/Audio specs (safe to keep):**
| Field | Value |
|-------|-------|
| Resolution | 1376 x 1840 |
| Duration | 24.36 s |
| Video Codec | hvc1 (HEVC) |
| Frame Rate | 30.005 fps |
| Bitrate | 14.5 Mbps |
| Audio Codec | mp4a (AAC) |
| Audio Channels | 2 (stereo) |
| Audio Sample Rate | 48000 Hz |
| Audio Bits | 16 |

**GPS: NOT PRESENT** (no GPS atoms in this sample)

### Comment Field Structure (URL-encoded params)
The MOV Comment field uses a URL query-string format:
app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=5540A1B7-8488-4E95-983D-7D03A782CD2E

- app = Application name
- device = Device model
- id = Unique device/session UUID

### Stripping Strategy Summary

**HEIC Photos - fields to remove/overwrite:**
1. EXIF Make -> remove or set to empty
2. EXIF Model -> remove or set to empty
3. EXIF UserComment -> remove (contains device UUID)
4. EXIF SerialNumber -> remove
5. XMP block -> remove entirely (contains dates)
6. EXIF DateTime, DateTimeOriginal, DateTimeDigitized -> optionally strip or keep
7. EXIF SubSecTime* -> remove (high-precision timestamps)

**MOV Videos - fields to remove/overwrite:**
1. Keys/Copyright -> remove (Meta AI)
2. Keys/Model -> remove (Ray-Ban Meta Smart Glasses)
3. Keys/Comment -> remove (contains app, device, UUID)
4. Keys/Description -> remove (2Q serial)
5. Keys/AndroidVersion -> remove (14)
6. Keys/CreationDate -> optionally strip
7. QuickTime CreateDate/ModifyDate -> optionally strip or keep
8. Track timestamps -> optionally strip or keep

**Tools for stripping:**
bash
# HEIC: Strip all Meta-identifying fields
exiftool -Make= -Model= -UserComment= -SerialNumber= \
  -XMP:all= -SubSecTime= -SubSecTimeOriginal= -SubSecTimeDigitized= \
  "photo.heic"

# MOV: Strip Meta-identifying QuickTime atoms
exiftool -Copyright= -Model= -Comment= -Description= \
  -AndroidVersion= -CreationDate= \
  "video.mov"

# Nuclear option: strip ALL metadata
exiftool -all= "file.heic"
exiftool -all= "file.mov"


---

## G) How to Extend (Developer Quick Reference)

### Local Development Setup
bash
# Prerequisites
nvm use 22
npm install

# Auth setup (GCP)
gcloud auth application-default login
gcloud config set project magfield-487008

# Copy environment
cp .env.example .env
# Fill in any missing values

# Run dev server (Vite + Node server concurrently)
npm run dev
# Frontend: https://localhost:5173
# Server: http://localhost:3002


### Adding a New Feature
1. Create src/features/[feature]/[Feature]Page.tsx
2. Create src/routes/[Feature]Route.tsx (lazy wrapper)
3. Add route to src/app/router.tsx with role guard if needed
4. Add nav item to src/components/BottomNav.tsx with minRole
5. Add data service in src/data/services/[feature]Service.ts
6. If new data: bump Dexie version in src/data/db.ts, add table
7. If synced: add collection to firestoreSync.ts pull/push/realtime
8. If secured: add rules to firestore.rules

### For the Metadata Stripper App
You'll need a **new Firebase project** (separate from magfield-487008):
1. Create project in Firebase Console
2. Enable Auth (email/password or Google)
3. Enable Storage (for uploaded files)
4. No Firestore needed initially (unless tracking processing history)
5. Deploy frontend to Firebase Hosting
6. If server-side processing: Cloud Run with exiftool in container
7. Or: client-side only with browser-based EXIF/XMP stripping libraries

### Key Libraries for Metadata Stripping
- **Server-side**: exiftool CLI (Perl-based, comprehensive, handles HEIC + MOV)
- **Client-side JS**: piexifjs (JPEG only), exif-js (read-only), or custom binary parsing
- **HEIC challenge**: Browser-native HEIC support is limited; may need server-side processing
- **MOV challenge**: QuickTime atom parsing requires binary-level manipulation; ffmpeg or exiftool recommended

---

## Risks & Quirks

1. **No CORS middleware** on Cloud Run - relies on Firebase Hosting proxy
2. **No rate limiting** - valid token can spam AI endpoints (Gemini billing exposure)
3. **No Express/framework** - manual HTTP routing in server/index.ts
4. **tsx at runtime** - TypeScript compiled on-the-fly in production (no build step for server)
5. **Outbox mutations local-only** - if user clears browser data before sync, mutations are lost
6. **No explicit Firestore indexes** - relies on auto-indexing (may be slow for compound queries)
7. **Audit events readable by all** - authenticated users can read all audit events regardless of role
8. **Firebase config in .env.example** - API key is committed (safe per Firebase design, but notable)
9. **Cloud Run timeout 900s** - long Gemini calls could timeout on non-streaming endpoint
10. **HEIC GPS** - not present in sample, but Ray-Ban Meta glasses CAN embed GPS (check other samples)

ChatGPT said:

Thought for 9m 8s

ChatGPT said:
Yes — this audit is massively helpful. It does two things you usually have to painfully reverse‑engineer:
It nails down the exact deployment shape of your existing stack (Firebase Hosting → /api/** rewrite → Cloud Run Node 22 + tsx + manual router + Firebase Admin bearer auth).
It identifies specific, reproducible metadata fields in your sample HEIC + MOV files that are almost certainly what Instagram is using for the “Meta/Ray‑Ban” attribution.
What this gives us (concretely)
Stack certainty
You already have the ideal pattern for this: upload blobs to Firebase Storage, track jobs in Firestore, run heavy work in Cloud Run.
You don’t need Cloud Functions at all.
You don’t need any of the Dexie offline-sync stuff for this tool.
Metadata certainty (this is the gold)
From your own samples: HEIC (photo) — remove:
EXIF:Make = "Meta AI"
EXIF:Camera Model Name / Model = "Ray-Ban Meta Smart Glasses"
EXIF:UserComment = <UUID-like> (tracking)
EXIF:SerialNumber = "2Q" (identifier-ish)
MOV (video) — remove from QuickTime [Keys]/mdta:
Keys:Comment = "app=Meta AI&device=Ray-Ban Meta Smart Glasses&id=<UUID>"
Keys:Model = "Ray-Ban Meta Smart Glasses"
Keys:Copyright = "Meta AI"
Keys:Description = "2Q"
Keys:AndroidVersion = "14"
That Comment string is basically a confession: it’s a machine-readable analytics payload.
Two important corrections / gotchas to avoid building the wrong thing
1) “XMP block MUST STRIP” conflicts with your goal.
Your stated goal is “preserve all other metadata, remove only Meta/Ray‑Ban attribution.”
But the audit’s suggested command nukes all XMP: -XMP:all=. In your sample, the XMP shown is just dates (Create/Modify/DateCreated). That’s not Ray‑Ban branding. So:
Default mode (“Attribution only”): do not wipe all XMP. Only remove XMP tags whose values match meta|ray-ban|meta ai|meta view (and other “branding/tracking” signals).
Optional “Privacy mode”: allow nuking XMP + SubSecTime* + UUID-like fields if you want anti-fingerprinting.
2) Your current Storage rules cap at 10MB — that will kill video immediately.
This is the biggest practical blocker. Ray‑Ban clips can be 40–200MB+ depending on length/bitrate.
So the app must update storage.rules for the new upload/output paths with a much higher cap (e.g., 1GB or 2GB), while still enforcing UID isolation.
The prompt you should use now (repo-aware, stack-aware, minimal guessing)
Paste this into your multi-agent “build in this repo” workflow:
Use this repository’s existing stack and conventions to implement a new feature: “Media Tools (MetaScrub + Stitch)”.

Reference document:
- assets/meta/STACK_AUDIT.md (treat as truth)

Repo facts (do not deviate):
- Frontend: Vite + React 19 + TS + Tailwind v4 + PWA
- Hosting: Firebase Hosting serves dist/ and rewrites /api/** to Cloud Run
- Backend: Cloud Run service war-room-server (Node 22 + tsx, manual routing in server/index.ts)
- Auth: Firebase Auth with bearer token verification on server via Firebase Admin
- Storage currently limited to 10MB in storage.rules (must be updated for videos)

Feature requirements:
A) Add a new route: /media-tools
- Mobile-first UI, dead simple.
- Two modes:
  1) “Scrub metadata” (batch photos/videos)
  2) “Stitch videos” (pick order, merge, then scrub output)
- Upload multiple files, show progress, allow download results.

B) Storage + Firestore
- Store originals in Firebase Storage:
  uploads/{uid}/mediaTools/{jobId}/{filename}
- Store outputs in:
  outputs/{uid}/mediaTools/{jobId}/{filename}
- Track job state in Firestore collection: mediaJobs
  Fields: createdBy, type, status, createdAt/updatedAt, inputs[], outputs[], options, progress, error, reportPath

C) Security changes (mandatory)
- Update firestore.rules so mediaJobs can only be read/written by createdBy (request.auth.uid).
- Update storage.rules:
  - Allow uploads/reads only when UID matches path.
  - Increase file-size limit for uploads/{uid}/mediaTools/** and outputs/** to support large videos (>= 1GB).
  - Keep existing attachments path unchanged.

D) Backend processing endpoints (add to server/index.ts with manual routing style)
Implement:
1) POST /api/media/jobs
- Auth required (Bearer token)
- Creates a mediaJobs doc (queued) and returns {jobId}

2) POST /api/media/jobs/{jobId}/process
- Auth required
- Downloads inputs from Storage to /tmp
- If type=scrub:
   - For each file: run exiftool read JSON, decide tag removals, write removals to a copy, upload output
- If type=stitch:
   - Use ffmpeg concat. Try stream copy first; fallback to re-encode if concat fails
   - Then run scrub on merged output
- Upload JSON report listing removed tags per file
- Update job doc status to done/error

E) Metadata scrub rules (must follow these exactly)
Do NOT implement “strip all metadata”.
Implement surgical removal based on assets/meta/STACK_AUDIT.md samples:

HEIC remove:
- EXIF:Make when value contains “Meta”
- EXIF:Model / CameraModelName when value contains “Ray-Ban Meta”
- EXIF:UserComment when UUID-like
- EXIF:SerialNumber when present (e.g. “2Q”)
- SubSecTime* only in “Privacy mode”

MOV remove (QuickTime Keys/mdta):
- Keys:Comment (contains app=Meta AI&device=...&id=UUID)
- Keys:Model
- Keys:Copyright
- Keys:Description
- Keys:AndroidVersion
- Any tag whose VALUE matches /(meta|ray-?ban|meta ai|meta view)/i
- UUID-like values should be removed in “Privacy mode”.

Important: Do NOT blanket wipe XMP in default mode. Only remove XMP tags if their VALUES match Meta/Ray-Ban strings, unless “Privacy mode” is enabled.

F) Dockerfile update (mandatory)
The Cloud Run container must include:
- exiftool (libimage-exiftool-perl)
- ffmpeg
Ensure the server still runs with tsx + Node 22.

G) Frontend auth
Add Google sign-in (Firebase Auth GoogleAuthProvider).
Prefer signInWithRedirect for mobile PWA. Keep email/password login working.

H) Done criteria / tests
- HEIC output no longer contains Make=Meta AI, Model=Ray-Ban Meta Smart Glasses, UserComment UUID, SerialNumber=2Q.
- MOV output no longer contains Keys:Comment with app/device/id, Keys:Model, Keys:AndroidVersion, Keys:Description=2Q.
- Stitch 2+ clips -> output plays correctly and is scrubbed.
- Upload >10MB videos works (rules updated).
- Users can only access their own jobs/files.

Deliver:
- PR-ready code changes with file paths listed
- Deployment steps matching repo conventions
- Minimal UI: upload, progress, download
Why you’re “good to send it to”
Because it contains the three things a builder needs:
exact infra pattern (Hosting rewrite → Cloud Run)
exact auth/token pattern (Bearer token verified server-side)
exact metadata fields to remove (not guesses)
The only thing I’d tone down from the audit is the “XMP MUST STRIP” part — unless you explicitly want “privacy mode” to be the default. If you want this to stay dead-simple forever, the right mental model is:
Firestore = job ledger
Storage = blobs
Cloud Run = ffmpeg + exiftool factory
…and the phone is just the remote control.

You said:
Okay, I don't think you understand, but I actually want to create a whole new repository in a new folder and just refer to that stack in terms of the Firebase hosting and the database as well as the data stores. It's a completely different app altogether, so can you please create a requirements design and potentially a task manifest or get it to do that using a team of agents? I just wanted to sketch out what the app is gonna be, and so it doesn't necessarily need to be in all those things, but it sounds like later I'll do the PWA, otherwise it seems like it's pretty good, but I need to update the storage, obviously, for videos. So please just re-answer again, but this time note that I'm creating a whole new repository for this. It's not gonna be within this stack. It's just using that stack to model it, then creating the requirements, design files, and then getting multiple teams of agents to get on the job, creating the front-end, hosting it, authenticating Google, and then deploying it ultimately.

ChatGPT said:
Reasoned for 10m 9s
Got it: new repo, new app, and we’re just borrowing the architectural pattern (Firebase Hosting + Auth + Firestore + Storage + Cloud Run) as the proven template.

Below is a ready-to-drop “spec + design + task manifest + agent prompt pack” for your new repository. It’s written so you can hand it to a multi-agent runner (Firebase Studio agents or your own agent rig) and get deterministic outputs instead of vibes.

A key design constraint we’ll bake in: Firebase Hosting has a 60‑second request timeout, so video stitching/scrubbing cannot be done as a single long /api request. We’ll make it async: create job → enqueue work → poll/listen for completion. 

Also: Firebase Studio is a real thing (preview) — an agentic, cloud-based dev environment (Project IDX + Gemini agents) that can generate apps and wire Auth/Firestore/Storage from prompts. 

New repo name + scope
Repo name (suggestion): meta-media-tools
App name (UI): “Media Tools”
Core tools:

MetaScrub: remove only Ray‑Ban Meta attribution/tracking metadata (HEIC/JPG + MOV/MP4) while preserving other metadata

Stitch: concatenate multiple clips into one file, then run MetaScrub on the merged output

Design pack (copy into files in the new repo)
/docs/REQUIREMENTS.md
# Media Tools — Requirements

## 1) Problem
Instagram and other platforms label certain photos/videos as “Ray‑Ban Meta / Meta AI” based on metadata embedded in media files. The goal is to remove *only* those identifying fields (and optional tracking/fingerprinting fields), without destroying all metadata like timestamps, exposure settings, or GPS.

## 2) Goals
- Batch upload multiple photos/videos from a phone.
- Run two tools:
  A) MetaScrub (metadata scrub)
  B) Stitch (video concat + scrub)
- Return processed files for download to phone or desktop.
- Preserve all non-target metadata by default.
- Make it “dead simple”: upload → process → download.

## 3) Non-goals
- No editing filters, captions, or social posting integrations.
- No full offline processing (server-side compute is primary).
- No “strip all metadata” default mode.

## 4) Users
- Primary user: a single signed-in user (you), but architecture should support multiple users safely.

## 5) Functional requirements
### Auth
- Sign-in with Google (Firebase Auth).
- Optional: keep email/password as fallback.

### Upload
- Select multiple files at once.
- Accept: HEIC/JPG/PNG (photos), MOV/MP4 (videos).
- Direct-to-Storage uploads (resumable).

### MetaScrub mode
- User selects files → starts job.
- Job produces outputs in same format when possible.
- Default scrub mode: “Attribution only”.
- Optional scrub mode: “Privacy mode”.

### Stitch mode
- User selects 2+ videos.
- User can reorder.
- Output filename includes clip order: 
  - e.g. `myclip_1-2-3_merged.mp4` (recommended).
- After stitching, scrub metadata on merged output.

### Download
- Download each output.
- Optional: “Download all outputs” (zip) as a separate job (not required for MVP).

### Job history
- Show recent jobs with status and outputs.
- Auto-expire old jobs/files (retention policy).

## 6) Non-functional requirements
- Mobile-first UI; usable on iPhone/Android.
- Async processing: backend jobs must finish even if user closes the tab.
- Security: user can only access their own jobs/files.
- Cost control: delete old blobs and limit max file size per upload.
- Observability: per-job logs + error reasons.

## 7) Constraints / platform realities
- Firebase Hosting has a ~60s request timeout, so long media processing must be async. 
- Cloud Run requires billing (Blaze plan if starting from Spark). 
(Those last two constraints are straight from Firebase docs about Cloud Run + Hosting and request timeouts / billing. 
)

/docs/METADATA_SPEC.md
# Metadata Spec — Ray‑Ban Meta scrub rules

## Philosophy
Default mode removes only Ray‑Ban Meta attribution/tracking fields while preserving other metadata (timestamps, camera settings, GPS if present).
Never run a “strip all metadata” command by default.

## Target patterns
- Brand strings: /(meta|meta ai|meta view|ray-?ban)/i
- UUID-like: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

## Inputs & known fields (from your exiftool findings)
### HEIC (photo)
Remove (Attribution only):
- EXIF:Make when value matches brand strings (example: "Meta AI")
- EXIF:Model / CameraModelName when value matches brand strings (example: "Ray‑Ban Meta Smart Glasses")

Remove (Privacy mode adds):
- EXIF:UserComment when UUID-like
- EXIF:SerialNumber (example: "2Q")
- EXIF:SubSecTime, SubSecTimeOriginal, SubSecTimeDigitized (optional fingerprinting)
- Any XMP fields ONLY if values match brand strings (do NOT blanket delete XMP in default mode)

### MOV/MP4 (video)
Remove (Attribution only):
- QuickTime Keys/mdta: Comment (example format: "app=Meta AI&device=Ray‑Ban Meta Smart Glasses&id=<UUID>")
- QuickTime Keys/mdta: Model (Ray‑Ban Meta Smart Glasses)
- QuickTime Keys/mdta: Copyright ("Meta AI")

Remove (Privacy mode adds):
- Comment/id UUID-like values
- Keys/mdta: Description (example: "2Q")
- Keys/mdta: AndroidVersion (example: "14")

## Output guarantees
- The processed file must not contain the above fields when they match the patterns.
- Preserve DateTimeOriginal/CreateDate by default.
- Preserve GPS if present (unless the user explicitly chooses privacy mode + "remove location").
/docs/ARCHITECTURE.md
# Architecture — Media Tools (new repo)

## High-level
Mobile web app hosted on Firebase Hosting.
Auth via Firebase Auth (Google provider).
Uploads + outputs stored in Firebase Storage.
Job state stored in Firestore.
Heavy processing runs in Cloud Run (container with ffmpeg + exiftool).
Processing is async because Hosting requests time out around 60 seconds.

## Components
1) Web client (Vite + React):
- Auth UI, upload UI, job status UI, download UI

2) Firebase Hosting:
- Serves static web app
- Rewrites /api/** to Cloud Run service

3) Firestore:
- mediaJobs collection for job tracking and history

4) Firebase Storage:
- uploads/{uid}/{jobId}/...
- outputs/{uid}/{jobId}/...
- reports/{uid}/{jobId}/report.json

5) Cloud Run:
- HTTP API:
  - create job
  - enqueue processing
  - optional: generate signed download URLs
- Worker endpoint (protected):
  - pulls job, downloads inputs, processes, uploads outputs, updates Firestore

6) Cloud Tasks (recommended):
- When job is created, enqueue a task to call the Cloud Run worker endpoint.
- This avoids long-running client connections and survives client disconnects.

## Why async (hard constraint)
Firebase Hosting has a 60-second timeout on requests, so stitching/scrubbing large videos cannot be a single blocking /api request.

## Data model (Firestore)
Collection: mediaJobs/{jobId}
- createdBy: uid
- type: "scrub" | "stitch"
- status: "queued" | "processing" | "done" | "error"
- createdAt, updatedAt
- inputs: [{ name, storagePath, mime, size }]
- options: { scrubMode: "attribution" | "privacy" }
- stitchOrder?: number[]
- outputs?: [{ name, storagePath, mime, size }]
- reportPath?: string
- error?: { message, detail? }
- progress?: { phase, current, total }

## Storage rules (key point)
- uploads and outputs must be path-isolated by uid.
- video uploads require increasing the file size cap (current 10MB patterns are not viable).

## Processing flow
Client:
1) Uploads to Storage (resumable)
2) Creates job doc in Firestore (status=queued)
3) Calls /api/jobs/{jobId}/enqueue
4) Subscribes to job doc updates (onSnapshot)

Worker:
1) Marks job processing
2) Downloads input files to /tmp
3) Runs MetaScrub (exiftool read-json → compute removals → exiftool write)
4) For stitch: ffmpeg concat (copy first; fallback re-encode), then scrub output
5) Uploads outputs + report JSON
6) Marks job done/error

## Observability
- Cloud Run logs: per jobId prefix
- Firestore: error fields for UI display
(Hosting ↔ Cloud Run pairing + rewrite concept is explicitly supported by Firebase docs. 
)

/docs/API_SPEC.md
# API Spec — /api (Cloud Run)

All endpoints require Firebase ID token except the worker endpoint (which uses a secret).

## Auth
Client sends:
Authorization: Bearer <firebaseIdToken>

## Endpoints

POST /api/media/jobs
- Creates a Firestore job doc
Body:
{
  "type": "scrub" | "stitch",
  "inputs": [{"storagePath": "...", "name": "...", "mime": "...", "size": 123}],
  "options": {"scrubMode": "attribution" | "privacy"},
  "stitchOrder": [0,1,2]  // required for stitch
}
Returns:
{ "jobId": "..." }

POST /api/media/jobs/{jobId}/enqueue
- Enqueues Cloud Task to process jobId
Returns:
{ "ok": true }

POST /api/media/worker/process
- Protected with header:
X-Worker-Secret: <SECRET>
Body:
{ "jobId": "..." }
- Does the actual processing

GET /api/media/health
- Health check
/docs/TASK_MANIFEST.yaml
project: meta-media-tools
repo: new
phases:
  - id: P0
    name: Bootstrap & docs
    tasks:
      - id: P0.1
        title: Create new repo + base folder structure
      - id: P0.2
        title: Add docs (REQUIREMENTS, METADATA_SPEC, ARCHITECTURE, API_SPEC, TASK_MANIFEST)
      - id: P0.3
        title: Choose tech baseline (Vite+React+TS, Tailwind; PWA optional)

  - id: P1
    name: Firebase project setup
    tasks:
      - id: P1.1
        title: Create new Firebase project + enable billing (required for Cloud Run)
      - id: P1.2
        title: Enable Firebase Auth (Google provider)
      - id: P1.3
        title: Enable Firestore + create indexes if needed
      - id: P1.4
        title: Enable Firebase Storage + set CORS if needed
      - id: P1.5
        title: Create firebase.json hosting + /api rewrite to Cloud Run

  - id: P2
    name: Frontend MVP
    tasks:
      - id: P2.1
        title: Scaffold Vite+React+TS app + Tailwind + mobile layout
      - id: P2.2
        title: Implement Google sign-in (redirect flow for mobile)
      - id: P2.3
        title: Implement file picker + multi-file list
      - id: P2.4
        title: Implement upload to Storage + progress UI
      - id: P2.5
        title: Implement job creation + Firestore job status listener
      - id: P2.6
        title: Results view with download links

  - id: P3
    name: Backend API (Cloud Run)
    tasks:
      - id: P3.1
        title: Create Cloud Run service (Node 22, TS) with minimal routing
      - id: P3.2
        title: Verify Firebase ID tokens server-side (Admin SDK)
      - id: P3.3
        title: Implement /api/media/jobs + /enqueue + /health
      - id: P3.4
        title: Add Cloud Tasks enqueue (or Pub/Sub) for async processing
      - id: P3.5
        title: Implement worker endpoint protected by X-Worker-Secret

  - id: P4
    name: Media processing engine
    tasks:
      - id: P4.1
        title: Update Dockerfile to install ffmpeg + exiftool
      - id: P4.2
        title: Implement MetaScrub (read metadata JSON, compute removals, write removals)
      - id: P4.3
        title: Implement Stitch (concat copy -> fallback re-encode) then scrub output
      - id: P4.4
        title: Generate per-file report.json (removed tags, before/after checks)

  - id: P5
    name: Security rules & limits
    tasks:
      - id: P5.1
        title: Firestore rules for mediaJobs per-uid access
      - id: P5.2
        title: Storage rules per-uid access for uploads/outputs
      - id: P5.3
        title: Increase upload size limit for videos under uploads/** and outputs/**

  - id: P6
    name: QA + deployment
    tasks:
      - id: P6.1
        title: Integration test on sample HEIC + MOV: confirm tags removed & files playable
      - id: P6.2
        title: Deploy Cloud Run + deploy Hosting
      - id: P6.3
        title: Add retention cleanup (scheduled delete after N days)
Multi-agent prompt pack (teams of agents)
These are “charters” you can paste into your multi-agent runner.

Agent 1 — Spec writer (PM)
Create /docs/REQUIREMENTS.md, /docs/METADATA_SPEC.md, and /docs/API_SPEC.md for a new app “Media Tools”.
Focus on: goals, non-goals, user flows, scrub modes (attribution vs privacy), file naming rules, acceptance tests.
Keep scope minimal and mobile-first.
Agent 2 — Architect
Create /docs/ARCHITECTURE.md with an async job architecture:
Firebase Hosting -> /api rewrite -> Cloud Run
Firestore job ledger + Storage blobs.
Use Cloud Tasks to avoid Hosting 60s timeout.
Define data model + processing flow + failure modes + retention policy.
Agent 3 — Firebase/Infra
Provision a new Firebase project and wire:
- Firebase Hosting for web app
- Firestore for jobs
- Storage for uploads/outputs
- Auth Google provider
Configure firebase.json rewrite to Cloud Run /api/**.
Write Firestore rules and Storage rules for per-uid access.
Increase Storage upload cap for videos.
Create deploy scripts and a README with exact commands.
Agent 4 — Frontend
Build the mobile web UI (Vite+React+TS):
- Google sign-in (redirect on mobile)
- Two tabs: Scrub / Stitch
- Multi-file upload list + progress
- Reorder list for stitch
- Create job doc + enqueue processing
- Live job status view (listen to Firestore)
- Download outputs
Keep UI dead simple, touch-friendly.
Agent 5 — Backend/API
Build Cloud Run Node service:
- Minimal router
- Verify Firebase ID tokens for client endpoints
- Implement create-job + enqueue endpoints
- Implement worker endpoint protected with X-Worker-Secret
- Worker downloads inputs from Storage to /tmp, runs processing, uploads outputs, updates Firestore
Add structured logs keyed by jobId.
Agent 6 — Media engine specialist
Implement processing:
- Install and invoke exiftool + ffmpeg
- MetaScrub: read exiftool JSON, remove only Ray-Ban Meta attribution/tracking fields (per METADATA_SPEC), preserve other metadata
- Stitch: concat copy first; fallback re-encode; then scrub merged output
Generate a report.json per job listing removed tags and per-file outcomes.
Agent 7 — QA
Create test plan + sanity scripts:
- Upload HEIC/MOV samples
- Verify removed tags are absent (exiftool dump)
- Verify outputs open/play on iPhone + desktop
- Verify job status transitions and error handling
- Verify user isolation (cannot read another user’s job/files)
Firebase Studio–specific “single prompt” (if you want to generate the skeleton in Studio)
Firebase Studio can generate apps and help integrate Firebase services (Auth/Firestore/Storage) via its App Prototyping agent and integrations. 

Here’s a prompt tuned for it:

Create a mobile-first web app called “Media Tools”.

Pages:
1) Login page with Google Sign-In (Firebase Auth)
2) Main page with two tabs:
   - “Scrub metadata”
   - “Stitch videos”

Scrub tab:
- Multi-file upload input (photos/videos)
- Upload files to Cloud Storage under uploads/{uid}/{jobId}/
- Create a Firestore document in collection mediaJobs with status=queued and inputs list
- Show job status and outputs list with download buttons

Stitch tab:
- Allow selecting 2+ videos
- Allow reordering
- Create a Firestore job document with type=stitch and stitchOrder
- Show output link after completion, named with “_1-2-3_merged.mp4”

Security:
- Firestore rules: only creator can read/write their job doc
- Storage rules: only user can read/write their uploads/outputs paths
- Increase upload size limit for videos (>= 1GB)

Backend:
- Add an /api service (Cloud Run) that processes jobs asynchronously (do not rely on a single long request).
- The backend downloads from Storage, runs exiftool/ffmpeg, uploads outputs, updates Firestore.

Do not implement any AI chat features.
Keep UI minimal and touch-friendly.
(That “connect to Firebase + integrate Auth/Firestore/Storage from prompts” workflow is explicitly described by Firebase’s own Studio blog/docs. 
)

The one decision you should lock now
Async jobs with Cloud Tasks isn’t optional if you want this to feel solid. Hosting’s timeout will bite you otherwise. 

Everything else can iterate.

If you paste your CLAUD.md + agents.md, I’ll rewrite the agent charters to match your exact multi-agent protocol (folder naming, “work sessions”, how you want tasks chunked, your preferred output formats), so your agents generate the repo with your conventions instead of inventing their own.