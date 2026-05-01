# Technical Plan: AhaSlides Lesson Publisher MVP

## Context

AhaSlides trainers churn because the platform doesn't support self-paced e-learning. Trainers stitch together 5+ tools to deliver async lessons. The Lesson Publisher MVP lets trainers create block-based self-paced lessons, publish them as shareable URLs, and track learner progress. Validated by Daniel Nguyen (wireframe feedback positive), with 3 more champion users recruited.

This is a standalone Node.js/TypeScript service with its own PostgreSQL database, communicating with AhaSlides core via API.

## Architecture Overview

```
                    learn.ahaslides.com        app.ahaslides.com
                         │                          │
              ┌──────────▼──────────┐    ┌──────────▼──────────┐
              │  Lesson Publisher   │    │   AhaSlides Core    │
              │  (Node.js/TS)      │◄──►│   (Node.js/TS)      │
              │  Fastify + Kysely  │    │                      │
              └────────┬───────────┘    └──────────────────────┘
                       │                 Communication:
              ┌────────▼───────────┐     - OAuth2 (trainer auth)
              │  LP PostgreSQL     │     - REST (presentation import)
              └────────────────────┘
```

**Key decisions:**
- Standalone service, own DB. No shared tables with AhaSlides core.
- JSONB for block content (text/image/video/quiz/file have different shapes).
- Email-based learner identity (no password, no account). Upsert on email for cross-lesson continuity.
- SSR for registration gate (SEO, social cards), SPA for learner view (interactivity).
- On-demand dashboard queries (trainers check infrequently, no WebSockets needed).

## Data Model

### Tables

**trainers** -- thin proxy, auth lives in AhaSlides core
- `id` UUID PK
- `ahaslides_user_id` VARCHAR(64) UNIQUE -- FK to core
- `slug` VARCHAR(255) UNIQUE -- URL namespace for trainer (D10)
- `display_name`, `email`, `avatar_url`
- `created_at`, `updated_at`

**lessons**
- `id` UUID PK
- `trainer_id` UUID FK -> trainers
- `title` VARCHAR(500)
- `slug` VARCHAR(255) -- URL-friendly, UNIQUE(trainer_id, slug)
- `description` TEXT -- learning objectives
- `estimated_minutes` SMALLINT
- `status` ENUM('draft', 'published', 'archived')
- `published_at` TIMESTAMPTZ
- `deleted_at` TIMESTAMPTZ -- soft delete (D12)
- `source_presentation_id` VARCHAR(64) -- if imported from AhaSlides
- `created_at`, `updated_at`

**blocks** -- ordered content within a lesson
- `id` UUID PK
- `lesson_id` UUID FK -> lessons ON DELETE CASCADE
- `type` ENUM('text', 'image', 'video', 'quiz', 'file')
- `position` SMALLINT -- drag-to-reorder
- `title` VARCHAR(500)
- `content` JSONB -- type-specific payload
- `created_at`, `updated_at`
- INDEX on (lesson_id, position)

Block content JSONB shapes:
```
text:  { "html": "<p>...</p>" }
image: { "url": "...", "alt": "...", "caption": "..." }
video: { "provider": "youtube"|"loom"|"vimeo", "embed_url": "...", "duration_seconds": N }
quiz:  { "questions": [{ "id": "q1", "text": "...", "options": [{ "id": "a", "text": "...", "is_correct": bool }], "explanation": "..." }] }
file:  { "url": "...", "filename": "...", "size_bytes": N, "mime_type": "..." }
```

**learners** -- global, no password
- `id` UUID PK
- `email` VARCHAR(255) UNIQUE
- `name` VARCHAR(255)
- `created_at`

**enrollments** -- learner x lesson
- `id` UUID PK
- `learner_id` UUID FK -> learners
- `lesson_id` UUID FK -> lessons
- `status` ENUM('not_started', 'in_progress', 'completed', 'idle')
- `enrolled_at`, `started_at`, `completed_at`, `last_active_at`
- UNIQUE(learner_id, lesson_id)

**block_progress** -- per learner per block
- `id` UUID PK
- `enrollment_id` UUID FK -> enrollments ON DELETE CASCADE
- `block_id` UUID FK -> blocks ON DELETE CASCADE
- `completed` BOOLEAN
- `completed_at` TIMESTAMPTZ
- UNIQUE(enrollment_id, block_id)

**quiz_responses** -- individual question answers
- `id` UUID PK
- `enrollment_id` UUID FK -> enrollments ON DELETE CASCADE
- `block_id` UUID FK -> blocks ON DELETE CASCADE
- `question_id` VARCHAR(64)
- `selected_option_id` VARCHAR(64)
- `is_correct` BOOLEAN -- denormalized for fast dashboard queries
- `answered_at` TIMESTAMPTZ
- UNIQUE(enrollment_id, block_id, question_id)

### Enrollment Status State Machine

```
  register         first block complete      mark lesson complete
(no row) ──► not_started ──► in_progress ──► completed
                                  ▲    │
                          activity│    │no activity 7d
                          resumes│    │(background job)
                                  │    ▼
                                  idle
```

## API Endpoints

### Trainer (auth required via AhaSlides JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/auth/me | Validate JWT, upsert trainer |
| GET | /api/v1/lessons | List trainer's lessons with stats |
| POST | /api/v1/lessons | Create lesson |
| GET | /api/v1/lessons/:id | Get lesson with blocks |
| PUT | /api/v1/lessons/:id | Update lesson metadata |
| DELETE | /api/v1/lessons/:id | Soft delete |
| POST | /api/v1/lessons/:id/publish | Publish + set published_at |
| POST | /api/v1/lessons/:id/unpublish | Revert to draft |
| GET/POST/PUT/DELETE | /api/v1/lessons/:id/blocks | Block CRUD |
| PUT | /api/v1/lessons/:id/blocks/reorder | Batch reorder |
| GET | /api/v1/import/presentations | List AhaSlides presentations (proxied) |
| POST | /api/v1/import/presentations/:id | Import into lesson |
| GET | /api/v1/lessons/:id/learners | Paginated learner table |
| GET | /api/v1/dashboard/stats | Aggregate stats |
| POST | /api/v1/uploads/presign | S3 presigned URL |

### Learner (public + learner JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/public/:trainerSlug/:lessonSlug | Lesson metadata for registration page (no auth) |
| POST | /api/v1/public/:trainerSlug/:lessonSlug/register | Register, create enrollment, return token + lesson (rate limited) |
| GET | /api/v1/learner/progress | Current enrollment progress |
| POST | /api/v1/learner/blocks/:id/complete | Mark block complete |
| POST | /api/v1/learner/blocks/:id/quiz | Submit quiz answer, get instant feedback |
| POST | /api/v1/learner/complete | Mark lesson complete |

## Auth Flows

**Trainer:** OAuth2 authorization code flow with AhaSlides core. LP registers as an OAuth client. AhaSlides access_token stored server-side, used for import API calls.

**Learner:** Name + email registration returns a self-issued JWT (24h TTL). Payload: `{ learnerId, enrollmentId, lessonId, exp }`. On expiry, re-register with same email resumes existing enrollment.

## Import Pipeline

1. LP calls AhaSlides core `GET /api/v1/presentations/:id/export` (new endpoint needed on core side)
2. Maps slide types to block types:
   - heading/paragraph -> text
   - image -> image
   - video -> video
   - multiple_choice/quiz -> quiz
   - poll/word_cloud/open_ended -> text (with note: "This was a live activity")
   - spinner_wheel/leaderboard -> skipped with warning
3. One-time copy, not sync. `source_presentation_id` records provenance.

## Rendering Strategy

- **Registration gate (public URL):** SSR. Fast, SEO-friendly, social cards. ~5KB HTML.
- **Learner view (after registration):** SPA (React/Preact). Interactive quizzes, progress checkboxes. Lazy-load images/videos. Target: <200KB JS bundle.
- **Editor + Dashboard:** SPA (trainer-only, no SEO needed).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict) |
| HTTP | Fastify |
| DB queries | Kysely (type-safe SQL) |
| Validation | Zod |
| Database | PostgreSQL 15+ |
| File storage | S3/R2 (presigned URLs) |
| Frontend | React 18 or Preact |

## Project Structure

```
lesson-publisher/
├── src/
│   ├── index.ts
│   ├── config.ts              # env vars with Zod
│   ├── db/
│   │   ├── client.ts          # Kysely client
│   │   ├── migrations/
│   │   └── types.ts           # generated DB types
│   ├── routes/
│   │   ├── auth.ts            # trainer auth
│   │   ├── lessons.ts         # CRUD + publish
│   │   ├── blocks.ts          # CRUD + reorder
│   │   ├── import.ts          # AhaSlides import
│   │   ├── public.ts          # learner registration + SSR
│   │   ├── learner.ts         # progress + quiz
│   │   └── dashboard.ts       # stats + learner table
│   ├── middleware/
│   │   ├── trainer-auth.ts
│   │   └── learner-auth.ts
│   ├── services/
│   │   ├── ahaslides-client.ts
│   │   ├── import-mapper.ts
│   │   ├── enrollment.ts
│   │   └── upload.ts
│   └── types/
│       ├── block-content.ts   # discriminated union for JSONB
│       └── api.ts             # Zod schemas
├── migrations/
│   └── 001_initial.sql
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Resolved Decisions (from eng review)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Auth method | OAuth2 (already exists on core) | No new auth infrastructure needed |
| D2 | Import API | Core team builds export endpoint | Central to value prop, removes 5-tool problem |
| D3 | URL pattern | learn.ahaslides.com subdomain | Clean separation, strong branding |
| D4 | Email verification | Skip for MVP | Low-stakes training, not exams. Add later if abuse |
| D5 | Block reorder | Array-index update | Simple, idempotent, max ~30 blocks per lesson |
| D6 | Quiz answer exposure | Accept client-side answers for MVP | Self-paced learning, not certification |
| D7 | Test strategy | Full coverage from day 1 | CC+gstack makes complete tests cost the same as minimal |
| D8 | Dashboard performance | Direct queries, summary table later | Indexes handle MVP scale, optimize when needed |
| D9 | Outside voice | Ran (Claude subagent) | 10 findings, 4 incorporated |
| D10 | URL slug pattern | /:trainerSlug/:lessonSlug | Fixes bug: per-trainer slugs need trainer in URL |
| D11 | HTML sanitization | Sanitize on save (sanitize-html) | Prevents stored XSS in text blocks |
| D12 | Rate limiting + soft delete + logging | Add all three | Rate limit on /register, deleted_at column, Pino logging |

## Failure Modes

| Codepath | Failure | Test? | Error handling? | User sees? |
|----------|---------|-------|-----------------|------------|
| Learner registration | Duplicate email, different name | Yes (upsert) | Handled (keeps existing name) | Seamless |
| Quiz submission | Network timeout mid-answer | No (client retry) | Client should retry | Toast error |
| Import pipeline | AhaSlides core API down | Yes | Return error with message | "Import unavailable" |
| Published URL | Lesson unpublished after learner started | Yes | Enrollment persists, blocks still visible | Continue learning |
| Dashboard query | Slow with 1000+ learners | No (deferred) | Pagination + index | Slow load, add summary table |
| Learner JWT | Expired after 24h | Yes | Re-register with same email resumes | Re-enter name/email |

**Critical gaps (no test AND no error handling AND silent failure): 0**

## Parallelization Strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| A: DB schema + migrations | db/ | -- |
| B: Auth middleware (trainer + learner) | middleware/ | A (needs tables) |
| C: Lesson + Block CRUD | routes/, services/ | A |
| D: Learner registration + progress | routes/, services/ | A, B |
| E: Import pipeline | services/, routes/ | A, C (needs lesson/block tables) |
| F: Dashboard queries | routes/ | A, C, D (needs all tables populated) |
| G: Frontend (editor, learner view, dashboard) | frontend/ | C, D, F (needs API) |

**Parallel lanes:**
- Lane 1: A -> B -> D (schema, auth, learner flows)
- Lane 2: A -> C -> E (schema, CRUD, import) -- can start after A completes
- Lane 3: F (dashboard) -- after A, C, D
- Lane 4: G (frontend) -- after APIs stabilize

Launch Lane 1 + Lane 2 in parallel after A. Lane 3 + 4 follow.

## Outside Voice Findings (deferred, not incorporated)

These were flagged by the independent reviewer but intentionally deferred:

- **Learner email impersonation** -- real risk but low-stakes context. Add email verification in v1.1 if trainers report issues.
- **Learner JWT scoped per-lesson** -- no cross-lesson "my lessons" UX. Acceptable for v1 (single-lesson product). Course hierarchy in v2 solves this.
- **GDPR/privacy** -- AhaSlides already has a privacy policy and legal team. LP needs to be covered under the existing privacy policy. Flag to legal before launch.
- **Concurrency on block reorder** -- max ~30 blocks, single trainer editing. No concurrent editors in v1. Add optimistic locking if needed.
- **Core team dependency** -- build import-mapper with mock data first. Core team builds export endpoint in parallel. Integration test when both ready.

## NOT in scope (v1)

- Course hierarchy (Course -> Sections -> Lessons) -- v2
- Live-to-async bridge (convert live session to lesson in one click) -- v2
- AI course generator -- v2+
- Custom domains -- deferred
- SCORM/xAPI export -- corporate feature, later
- SSO/enterprise admin -- corporate feature, later
- CPF compliance certificates -- pending Barbara's feedback
- Learner accounts with passwords -- email-only for now
- Real-time dashboard updates (WebSockets) -- on-demand queries sufficient

## What already exists (reusable from AhaSlides core)

- Trainer user accounts and authentication
- Presentation data model (slides, quiz questions, answers) -- consumed via export API
- Engagement/participation/accuracy metrics -- not directly needed for MVP, but available for future enrichment

## Dependencies on AhaSlides core team

1. **OAuth2 client registration** -- LP needs to be registered as an OAuth client
2. **Presentation export endpoint** -- `GET /api/v1/presentations/:id/export` needs to be built on core side
3. **DNS/routing** -- `learn.ahaslides.com` subdomain needs to route to LP service

## Verification

1. Run migrations: `npm run migrate`
2. Start service: `npm run dev`
3. Create a lesson via API, add blocks, publish
4. Visit published URL, register as learner, complete blocks, answer quiz
5. Check trainer dashboard shows correct stats and per-learner progress
6. Test import flow with a mock AhaSlides presentation
7. Verify mobile layout on learner view (375px viewport)

## Eng Review Completion Summary

- Step 0: Scope Challenge -- scope accepted as-is (greenfield MVP, complexity justified)
- Architecture Review: 4 issues found, all resolved (D1-D4)
- Code Quality Review: 2 issues found, all resolved (D5-D6)
- Test Review: diagram produced, 35+ gaps identified (greenfield), full coverage strategy adopted (D7)
- Performance Review: 1 issue found, resolved (D8)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items (greenfield project)
- Failure modes: 0 critical gaps
- Outside voice: ran (Claude subagent), 10 findings, 4 incorporated (D10-D12), 5 deferred
- Parallelization: 4 lanes, 2 parallel / 2 sequential
- Lake Score: 12/12 recommendations chose complete option
