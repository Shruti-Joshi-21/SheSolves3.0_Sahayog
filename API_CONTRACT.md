# API_CONTRACT.md

Base: `/api` (local via Vite proxy; deployed via `VITE_API_URL`). All routes except auth need `Authorization: Bearer <jwt>`.
Success: `{ success: true, message, data }` · Error: `{ success: false, message }`.

## Existing route groups (Round 2 — see `server/routes/*.js` for full lists)
| Prefix | Who | Main endpoints |
|---|---|---|
| `/api/auth` | all | `POST /login`, `GET /me`, signup (worker with face image, team lead, admin) |
| `/api/worker` | FIELD_WORKER | `GET /dashboard`, `POST /checkin`, `POST /checkout` (multipart: `faceImage`, `fieldImage`), `GET/POST/DELETE /leave`, `GET /tasks`, `GET/POST /reports` |
| `/api/teamlead` | TEAM_LEAD | `GET /dashboard-summary`, `GET/POST /tasks`, `GET /available-workers`, `GET /attendance`, `GET /attendance/flagged`, `PATCH /attendance/flagged/:id/resolve`, `GET/PATCH /leave-requests`, `GET /field-reports`, `POST /field-reports/:id/forward` |
| `/api/admin` | ADMIN | `GET /stats`, `/users`, `/analytics/*`, `/reports`, `/reports/pending-leads`, `/leave/*`, `/overview`, `/system-alerts` |
| `/api/locations`, `/api/tasks`, `/api/attendance`, `/api/leave`, `/api/reports` | mixed | legacy/supporting routes |
| `/api/health` | public | `{ status: "ok" }` — wake-up / uptime check |
| `/api/ai/health` | public | `{ ok, source: "ai" \| "fallback", model }` — proves the Gemini key works |

## New endpoints (Round 3) — add a row BEFORE building; Status: planned → mock → live
| Method | Path | Roles | Request | `data` returned | Owner lane | Status |
|---|---|---|---|---|---|---|
| POST | `/api/worker/checkin` (extended) | FIELD_WORKER | existing multipart + optional `livenessFrame` (2nd face image), `livenessAction` (e.g. "Blink twice"), `deviceId` (localStorage `sahayog_device_id`), `userAgent` | existing fields + `confidence: { score 0–100, band, signals, reasons[] }` | api | live |
| POST | `/api/worker/checkout` (extended) | FIELD_WORKER | same optional fields as checkin | existing fields + `confidence` (the weaker of check-in / check-out) | api | live |
| GET | `/api/admin/attendance/anomalies?band=&limit=` | ADMIN, TEAM_LEAD (own tasks only) | `band` = TRUSTED / REVIEW / SUSPICIOUS (optional), `limit` default 50, max 200 | `{ records: [AttendanceRecord + populated worker{fullName,username}, task{title,workType,locationName,date,startTime,endTime,allowedRadius}], counts: { TRUSTED, REVIEW, SUSPICIOUS } }` sorted by lowest `confidenceScore` | api | live |

**Attendance trust score (Challenge 3).** Weights: face 30 · liveness 20 · geofence 20 · timing 10 · device 10 · travel (location jump) 10.
Bands: ≥80 `TRUSTED`, 50–79 `REVIEW`, <50 `SUSPICIOUS` (SUSPICIOUS also sets `status: FLAGGED` and adds the reasons to `flagReasons` — flag, never block).
`confidenceSignals` shape: `{ face|liveness|geofence|timing|device|travel: { score /*points earned*/, weight, detail }, _meta: { phase, reasons[], checkIn{score,band}, checkOut{score,band} } }` — UI draws bars as `score / weight` and skips `_meta`. `signals.liveness.frames` = [frame1Url, frame2Url] when sent.

## Model changes (Round 3) — additive only
| Model | New field | Type / default | Why |
|---|---|---|---|
| User | `skills` | `[String]`, default `[]` | Skill-based worker matching (from: waste segregation, tree plantation, beach cleanup, composting, community awareness, water testing, data collection, first aid) |
| User | `experienceYears` | `Number`, default `0` | Worker ranking / recommendation |
| User | `languages` | `[String]`, default `['English']` | Match workers to community awareness tasks |
| Task | `requiredSkills` | `[String]`, default `[]` | Skills needed for the task (seed derives them from `workType`) |
| AttendanceRecord | `confidenceScore` | `Number`, default `null` | Overall attendance trust score |
| AttendanceRecord | `confidenceBand` | `String` enum `TRUSTED` / `REVIEW` / `SUSPICIOUS`, default `null` | Bucketed trust level for the UI |
| AttendanceRecord | `confidenceSignals` | `Mixed`, default `{}` | Per-signal breakdown behind the score (GPS, face, time, device…) |
| AttendanceRecord | `faceDistance` | `Number`, default `null` | Raw face-match distance from the face service |
| AttendanceRecord | `livenessPassed` | `Boolean`, default `null` | Liveness check result (`null` = not run) |
| AttendanceRecord | `livenessAction` | `String`, default `''` | Which liveness prompt was used (e.g. blink, turn head) |
| AttendanceRecord | `deviceId` | `String`, default `''` | Device fingerprint, to detect shared-device proxy check-ins |
| AttendanceRecord | `userAgent` | `String`, default `''` | Browser/device info for the same check |
| FieldReport | `aiReport` | `Mixed`, default `null` | Stored Gemini analysis of the report (summary, tags, `source`) |
