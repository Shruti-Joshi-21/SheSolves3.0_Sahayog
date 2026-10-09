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

## Ch1 — Smart assignment + worker ratings (Claude Code #1)
| Method | Path | Roles | Request | `data` returned | Status |
|---|---|---|---|---|---|
| GET | `/api/teamlead/available-workers` (extended) | TEAM_LEAD | query: `date, startTime, endTime` (required) + optional `workType, requiredSkills` (comma list), `latitude, longitude` | Array sorted by `matchScore` desc — see shape below | live |
| GET | `/api/teamlead/tasks/:taskId/ratings` | TEAM_LEAD (task owner) | — | `{ task: { _id, title, workType, status }, canRate, workers: [{ workerId, name, stars \| null, comment, ratedAt }] }` | live |
| POST | `/api/teamlead/tasks/:taskId/ratings` | TEAM_LEAD (task owner) | `{ ratings: [{ workerId, stars: 1-5, comment? (≤300) }] }` — upsert; task must be COMPLETED; workers must be assigned | same as GET | live |

`POST /api/teamlead/tasks` also accepts `requiredSkills: string[]` (defaults to `WORK_TYPE_SKILLS[workType]`).

Available-worker shape (old fields kept, new ones added):
```js
{ _id, name, initials, workHistory: [workType], weeklyHours, skills, experienceYears, languages,
  matchScore: 0-100, recommended: true /* only the top one */, matchedSkills: [],
  reasons: ["Has 'beach cleanup' skill", "Rated 5★ across 2 similar drives", "100% verified attendance", ...],
  ratingSummary: { avgForWorkType, countForWorkType, avgOverall, countOverall },
  breakdown: { skills, rating, experience, reliability, workload, proximity } // each { score, max, detail }
}
```
Weights: skills 30 · rating 20 (Bayesian, prior 3.5★ × 3; falls back to overall at half weight; unrated = neutral) · experience 15 · reliability 15 · workload 10 · proximity 10. Logic: `server/services/workerMatch.service.js`.

New model `WorkerRating`: `taskId, workerId, ratedBy, stars (1-5), comment (≤300), workType, timestamps` — unique `(taskId, workerId)`.
Seed adds 4 workers (priya@, arjun@, sneha@, imran@sevasetu.gov.in / password123) and 7 past COMPLETED drives with attendance + ratings.

## Ch2 — Impact dashboard API (Claude Code #1)
| Method | Path | Roles | Request | `data` returned | Status |
|---|---|---|---|---|---|
| GET | `/api/admin/impact` | ADMIN | optional `?story=false` to skip the AI story | Impact shape below | live |
| GET | `/api/public/impact` | **public, no auth** (donor page) | optional `?story=false` | Same shape — contains no worker names | live |

```js
{
  generatedAt,
  period: { current: { start, end, label: 'Last 30 days' }, previous: { start, end, label: 'Previous 30 days' } },
  kpis: {                       // each: { value /* last 30 days */, previous /* 30 days before */, deltaPct, total /* all time */ }
    wasteCollectedKg, drivesCompleted, volunteerHours, locationsCovered, workersActive, photoEvidence
  },
  byWorkType: [{ workType, drives, volunteerHours, wasteCollectedKg }],      // all time, most drives first
  trend: [{ month: '2026-10', label: 'Oct 2026', drivesCompleted, volunteerHours, wasteCollectedKg }], // last 6 months, oldest first
  locations: [{ locationName, latitude, longitude, drives, workTypes: [], lastDriveAt }],               // map pins
  gallery: [{ attendanceId, taskTitle, workType, locationName, date, beforeImage, afterImage }],       // ≤12, verified attendance with both photos
  impactStory: { text, highlights: [], source: 'ai' | 'fallback' }                                     // omitted when ?story=false
}
```
- `deltaPct` is a percentage (`-12.5`, `100`); it's `0` when both periods are 0.
- Waste comes from field-report fields whose name contains waste/weight + `(kg)` (e.g. "Waste collected (kg)", "Total weight (kg)").
- Volunteer hours = check-in → check-out time of VERIFIED attendance.
- `impactStory` comes from Gemini (cached 30 min); if Gemini is down it is a templated sentence (`source: 'fallback'`), so the card is never empty.
- Logic: `server/services/impact.service.js`. The older `/api/admin/impact-metrics` is unchanged.

## Ch4 — Multilingual AI field reports (Claude Code #2, AI lane)
| Method | Path | Roles | Request | `data` returned | Status |
|---|---|---|---|---|---|
| POST | `/api/ai/reports/:fieldReportId/generate` | TEAM_LEAD (own tasks only), ADMIN | query: `lang` = `en` \| `hi` \| `mr` (default `en`), optional `refresh=1` to regenerate | AI report shape below | live |

```js
{
  title, summary,
  workDone: [String], quantities: [{ label, value, unit }], issuesFound: [String],
  evidenceAssessment: { photosMatchTask: true | false | null /* null = not checked (fallback) */, notes },
  attendanceNote, recommendations: [String],
  language, lang, generatedAt, source: 'ai' | 'fallback',
  evidenceImages: [url],   // photos the AI looked at: ≤3 report photos, then before/after attendance photos
  cached: Boolean          // true = returned from FieldReport.aiReport without calling Gemini
}
```
- Every string is written in `lang` (Hindi/Marathi in Devanagari); numbers, units and names are kept as given.
- Saved to `FieldReport.aiReport`, so `GET /api/teamlead/field-reports/:id` already includes the last generated report.
- Cache: the saved report is returned instantly if it has the same `lang` and `source: 'ai'`. A saved fallback is always regenerated.
- Gemini overload (503/429) on `GEMINI_MODEL` → `ai.service` retries on `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash`, `off` disables); the generator then retries once more after 3 s. Only if all fail is a templated report built from the raw data in the same language (`source: 'fallback'`). Takes ~15–35 s with photos, worst case ~80 s.
- Logic: `server/services/ai/reportGenerator.js`.

**Admin inbox (Ch4 extension, additive).** `GET /api/admin/reports` and `PATCH /api/admin/reports/:id/read` now also return per report:
`taskTitle, workType, locationName, worker: { _id, fullName }, forwardedToAdmin, forwardedAt, forwardNote /* team lead's note from AdminReport */, aiReport /* same shape as above, or null */`.
The admin sees the latest AI report on the field report (if the lead regenerates it in another language, the admin sees that one).
