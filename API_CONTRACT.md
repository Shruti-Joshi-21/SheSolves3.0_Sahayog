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
|  |  |  |  |
