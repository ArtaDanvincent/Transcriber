# Transcriber System Design Spec

**Date:** 2026-08-24
**Status:** Approved

## Overview

A web-based transcription tool where users upload audio/video recordings, transcribe them manually in a dedicated workspace, and export the finished transcript. No roles, no assignment workflow, no review process — any logged-in user can do everything with their own recordings.

**Core flow:** Register/Login -> My Transcriptions -> Upload Audio -> Transcribe -> Export

## Architecture

```
VERCEL (Cloud)
  Next.js Frontend (React + TypeScript + Tailwind)
      |
      | HTTPS (REST API)
      v
SELF-HOSTED SERVER
  FastAPI Backend
      |           |
  PostgreSQL    Local Filesystem
  (5 tables)    (/app/storage/)
```

- **Monolith backend** — single FastAPI app handles auth, CRUD, file serving, export
- **JWT authentication** — stateless, works across Vercel/self-hosted boundary
- **Frontend calls only the backend** — no direct DB or file access from client
- **Nginx/Caddy** in front of FastAPI for HTTPS termination
- **Backend reachable from internet** via static IP, domain, or Cloudflare Tunnel

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + React + TypeScript |
| UI | Tailwind CSS |
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| File Storage | Local filesystem on backend server |
| AI (Phase 3) | Whisper (designed for, not implemented) |
| Frontend Deploy | Vercel via GitHub |
| Backend Deploy | Self-hosted server |

## Database Design

5 tables total.

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | VARCHAR(255) | Unique, indexed |
| password_hash | VARCHAR(255) | bcrypt |
| name | VARCHAR(100) | Display name |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### jobs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> users, indexed |
| title | VARCHAR(255) | User-given title |
| description | TEXT | Optional notes |
| status | VARCHAR(20) | `draft` (default) or `completed` (user marks manually) |
| media_file_path | VARCHAR(500) | Path on filesystem |
| media_type | VARCHAR(10) | `audio` or `video` |
| media_duration | INTEGER | Duration in seconds |
| media_original_name | VARCHAR(255) | Original uploaded filename |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### speakers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| job_id | UUID | FK -> jobs |
| name | VARCHAR(100) | e.g. "Speaker 1", "Juan" |
| label | VARCHAR(20) | Short label for UI |
| color | VARCHAR(7) | Hex color for visual distinction |
| created_at | TIMESTAMP | |

### segments

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| job_id | UUID | FK -> jobs, indexed |
| speaker_id | UUID | FK -> speakers, nullable |
| start_time | DECIMAL(10,3) | Start in seconds (ms precision) |
| end_time | DECIMAL(10,3) | End in seconds |
| text | TEXT | Transcribed content |
| position | INTEGER | Sort order, indexed with job_id |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### exports

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| job_id | UUID | FK -> jobs |
| format | VARCHAR(10) | `txt`, `srt`, `vtt`, `docx`, `pdf` |
| file_path | VARCHAR(500) | Path to generated file |
| created_at | TIMESTAMP | |

### Key Indexes
- `jobs.user_id` — fast lookup of user's transcriptions
- `segments(job_id, position)` — fast ordered loading of transcript
- `speakers.job_id` — load speakers for a job

### Design Notes
- Transcript stored as **segments** (one row per speaker turn), not a text blob
- `position` column allows reorder without recalculating timestamps
- No versioning in MVP — autosave updates segments in place
- Speaker `color` for visual distinction in workspace

## File Storage

```
/app/storage/
  media/
    {user_id}/
      {job_id}/
        recording.mp4
  exports/
    {user_id}/
      {job_id}/
        transcript.txt
        transcript.srt
```

- Organized by `user_id/job_id` — no collisions, easy cleanup on delete
- Original filenames stored in DB, files on disk use job ID
- Served through API with ownership check — not a public folder
- Upload size limit: 500MB default
- Accepted formats: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.mp4`, `.webm`, `.mov`

## API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
```

### Jobs
```
GET    /api/jobs                  — list user's jobs (paginated)
POST   /api/jobs                  — create job + upload media
GET    /api/jobs/{id}             — job details
PATCH  /api/jobs/{id}             — update title, description, status
DELETE /api/jobs/{id}             — delete job + files
GET    /api/jobs/{id}/media       — stream media file (auth-checked)
```

### Segments
```
GET    /api/jobs/{id}/segments    — all segments ordered
POST   /api/jobs/{id}/segments    — add segment
PATCH  /api/segments/{id}         — update segment
DELETE /api/segments/{id}         — delete segment
PUT    /api/jobs/{id}/segments    — bulk save (autosave)
```

### Speakers
```
GET    /api/jobs/{id}/speakers    — list speakers
POST   /api/jobs/{id}/speakers    — add speaker
PATCH  /api/speakers/{id}         — rename, change color
DELETE /api/speakers/{id}         — delete speaker
```

### Export
```
POST   /api/jobs/{id}/export      — generate { format: "txt" | "srt" | "vtt" }
GET    /api/exports/{id}/download — download file
```

### Design Notes
- Bulk save (`PUT /segments`) for autosave — sends full segment list
- Media streaming with `Content-Range` headers for seeking
- All endpoints verify `job.user_id == current_user.id`
- Job list paginated, sorted by `updated_at` descending

## Backend Structure

```
backend/
  app/
    main.py              — FastAPI app, CORS, startup
    config.py            — settings (DB URL, storage path, JWT secret)
    database.py          — SQLAlchemy engine + session
    models/              — SQLAlchemy models
      user.py
      job.py
      segment.py
      speaker.py
      export.py
    schemas/             — Pydantic request/response schemas
      auth.py
      job.py
      segment.py
      speaker.py
      export.py
    routers/             — endpoint handlers
      auth.py
      jobs.py
      segments.py
      speakers.py
      exports.py
    services/            — business logic
      auth.py
      media.py
      export.py
    dependencies.py      — get_current_user, get_db
  alembic/               — database migrations
  requirements.txt
  .env
```

## Frontend Structure

```
frontend/
  src/
    app/                        — Next.js App Router
      layout.tsx
      page.tsx                  — redirect to login
      login/page.tsx
      register/page.tsx
      dashboard/page.tsx        — My Transcriptions
      workspace/[jobId]/page.tsx — Transcription Workspace
    components/
      ui/                       — Button, Input, Modal
      layout/
        Navbar.tsx
        AuthGuard.tsx
      dashboard/
        JobList.tsx
        JobCard.tsx
        UploadModal.tsx
      workspace/
        MediaPlayer.tsx
        TranscriptEditor.tsx
        SegmentBlock.tsx
        SpeakerPanel.tsx
        ExportMenu.tsx
        PlaybackControls.tsx
    hooks/
      useAuth.ts
      useJobs.ts
      useSegments.ts
      useAutoSave.ts
      useMediaSync.ts
    lib/
      api.ts                    — fetch wrapper with JWT
      formatTime.ts             — seconds to HH:MM:SS
    types/
      index.ts                  — Job, Segment, Speaker, User
  tailwind.config.ts
  next.config.ts
  tsconfig.json
  package.json
```

## Pages

### Login / Register
- Email + password forms
- JWT stored after login
- Redirect to dashboard

### Dashboard (My Transcriptions)
- List of user's jobs sorted by last modified
- Each card: title, media type icon, duration, word count, status, time ago
- Click card -> opens workspace
- Upload button -> modal (file picker + title)
- Delete with confirmation

### Transcription Workspace

```
+--------------------------------+------------------------------------+
|                                |                                    |
|     MEDIA PLAYER               |     TRANSCRIPT EDITOR              |
|                                |                                    |
|  Video frame / waveform        |  [00:00:03] Speaker 1:             |
|                                |  Good morning everyone...           |
|  Progress bar      12:34       |                                    |
|                                |  [00:00:08] Speaker 2:             |
|  Skip/Play/Speed/Volume        |  Thank you for joining...          |
|                                |                                    |
+--------------------------------+  + Add Segment                     |
|  SPEAKERS                      |                                    |
|  Speaker 1 [rename]            |  Word count: 342                   |
|  Speaker 2 [rename]            |  Last saved: 2 seconds ago         |
|  + Add Speaker                 |                                    |
+--------------------------------+------------------------------------+
```

**Workspace features:**
- Play/pause, skip forward/back 5s
- Playback speed: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
- Volume control
- Segment-based editing (timestamp + speaker + text per block)
- Click timestamp -> jump media; media plays -> auto-scroll editor
- Add/edit/delete/merge segments
- Speaker management with colors
- Autosave (debounced, 5s after last edit)
- Word count

**Keyboard shortcuts:**

| Shortcut | Action |
|----------|--------|
| Ctrl + Space | Play / Pause |
| Ctrl + Left | Rewind 5s |
| Ctrl + Right | Forward 5s |
| Ctrl + Up | Speed up |
| Ctrl + Down | Slow down |
| Ctrl + Enter | New segment at current time |
| Ctrl + S | Force save |
| Tab | Next segment |
| Shift + Tab | Previous segment |

## Security

- **JWT** — 15 min access token + 7 day refresh token with rotation
- **bcrypt** password hashing
- **Ownership checks** on every endpoint
- **CORS** — backend allows only Vercel frontend domain
- **Rate limiting** on login/register (5 attempts/min)
- **Upload validation** — MIME type + extension check, size limit
- **Pydantic validation** on all request bodies
- **Files outside web root** — served through API only
- **Filename sanitization** — stored by job ID, prevents path traversal

## Export Formats

### MVP
- **TXT** — plain text with timestamps and speaker labels
- **SRT** — subtitle format
- **VTT** — web subtitle format

### Phase 2
- **DOCX** — formatted document (python-docx)
- **PDF** — final delivery format (weasyprint or reportlab)

## MVP Scope

| Module | Included |
|--------|----------|
| Auth | Register, login, JWT, logout |
| Dashboard | List jobs, upload media, delete job |
| Workspace | Media player with speed/skip controls |
| | Segment-based transcript editor |
| | Speaker management (add, rename, color) |
| | Timestamp-media sync (click to jump, auto-scroll) |
| | Keyboard shortcuts |
| | Autosave |
| Export | TXT, SRT, VTT |
| Backend | FastAPI, PostgreSQL, local file storage |
| Deploy | Frontend on Vercel, backend self-hosted |

## Phase 2 — Productivity

- DOCX + PDF export
- Search & replace in transcript
- Undo/redo
- Audio waveform visualization
- Password reset
- Email verification
- Transcript version history
- Notes/comments on segments
- Bulk upload

## Phase 3 — AI & Scale

- Whisper STT integration
- Speaker diarization
- Filipino/Taglish language model
- Confidence scores + unclear word flags
- User roles & team features
- Review/approval workflow
- Admin dashboard & reports
- Cloud file storage migration

## Development Order

```
Week 1:  Backend setup — FastAPI skeleton, DB models, Alembic migrations, auth endpoints
Week 2:  Backend CRUD — jobs, segments, speakers, file upload/serve
Week 3:  Frontend setup — Next.js project, auth pages, API client, auth guard
Week 4:  Dashboard — job list, upload modal, delete
Week 5:  Workspace — media player, playback controls
Week 6:  Workspace — transcript editor, segment CRUD, speaker panel
Week 7:  Workspace — autosave, keyboard shortcuts, media-editor sync
Week 8:  Export — TXT, SRT, VTT generation + download
Week 9:  Polish — error handling, loading states, responsive fixes
Week 10: Deploy — Vercel frontend, backend server setup, Nginx, domain
```

## Risks & Challenges

1. **Backend reachability** — self-hosted backend must be accessible from Vercel. Cloudflare Tunnel or static IP + domain required. Test this early.
2. **Large file uploads** — 500MB uploads need proper chunked upload handling and Nginx `client_max_body_size` config.
3. **Media seeking** — streaming with `Content-Range` headers needs correct implementation for browser `<audio>`/`<video>` seeking.
4. **Autosave reliability** — debounced saves must handle conflicts (user edits while save is in-flight). Last-write-wins is acceptable for single-user.
5. **Cross-origin cookies/auth** — JWT in Authorization header avoids cookie CORS issues between Vercel and self-hosted backend.
6. **Filipino/Taglish STT** — Whisper's Filipino support is limited. May need fine-tuned models in Phase 3.
