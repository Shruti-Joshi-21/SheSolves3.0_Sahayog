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
|  |  |  |  |  |  |  |

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
