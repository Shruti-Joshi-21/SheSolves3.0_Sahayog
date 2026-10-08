# PROJECT_CONTEXT.md

## What Sahayog is (already built — Round 2)
NGO field workforce platform with three role dashboards:
- **Field Worker** — guided check-in/out (GPS geofence → live face capture → before/after photo), tasks, field reports with photo evidence, leave requests, attendance history.
- **Team Lead** — dashboard stats, multi-step task creation (location search, conflict-aware scheduling, fatigue warning >35 h/week), attendance review, flagged records, leave approvals, field reports.
- **Admin** — org-wide Chart.js analytics (attendance trend, verification status, team comparison, task type), user management, lead nudges, CSV reports.

Existing ML: face recognition (dlib, 128-d encodings) in `python_service/` verifies check-ins against the worker's registered face. Out-of-range or face-mismatch check-ins are **flagged, not blocked**.

## Round 3 — challenges (fill in on the day)
| # | Challenge (verbatim) | Bonus? | Our feature | Lane(s) | Owner |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |

## AI / ML additions (decide on the day — pick what fits the challenges)
Ideas that fit Sahayog's data, cheapest first (all through `server/services/ai.service.js`):
1. **Field report AI summary + risk tags** for team leads (text + photos → summary, issues, urgency).
2. **Photo evidence check** (Gemini vision): does the before/after photo actually show the task's work type? Auto-flag suspicious ones — extends the existing anti-fraud story.
3. **Auto-drafted weekly team-lead summary** from that week's attendance/tasks/reports — plugs into the existing Lead Nudge system.
4. **Smart worker recommendation** when creating a task (distance, availability, hours worked, past flags) — explain the ranking with AI.
5. **Attendance anomaly score** per worker (rules/stats over GPS distance, face distance, timing) — "real ML" angle, can live in `python_service`.
6. **Ask-your-data** for admins: question → aggregate stats JSON → plain-language answer.

## Demo
- Deployed URLs: frontend `<vercel url>` · API `<render url>/api/health` · face service `<hf space url>/health`
- Demo accounts: see `server/seed.js` (admin / team lead / field worker)
- Demo story (2 min): <who clicks what, which challenge each step shows>
