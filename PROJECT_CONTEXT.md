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
| 3 | Enhance the existing face-recognition and GPS attendance system beyond a simple pass/fail check. Combine signals such as face verification, liveness, geofence status, timestamp, device signals and location changes. Generate an attendance confidence score indicating how trustworthy a particular attendance is. Participants may introduce liveness actions such as blinking, head movement or raising a hand to prevent photo-based spoofing. The system should identify suspicious or unusual attendance and flag them for administrator review. | No | Attendance trust score (0–100, 6 weighted signals) + Gemini two-frame liveness with a random action; spoof → SUSPICIOUS + flagged; score ring & signal breakdown for leads; anomalies API | api, ai, fe | Shruti |
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
- Deployed URLs: frontend `https://she-solves3-0-sahayog.vercel.app` · API `https://sahayog-backend-3yus.onrender.com/api/health` · face service `https://shesolves3-0-sahayog.onrender.com/health`
- Demo accounts: see `server/seed.js` (admin / team lead / field worker)
- Demo story (2 min): <who clicks what, which challenge each step shows>

### Challenge 3 demo (~40 s) — attendance trust
1. **Worker** (`worker@sevasetu.gov.in`) → Check In → GPS ✓ → liveness step shows a random action ("Blink twice") → 3-2-1 countdown → do it → field photo → submit. Result: **TRUSTED** badge (≈90).
   *Say:* "Not pass/fail anymore — six signals combine into a confidence score: face distance, AI liveness, geofence, timing, device and impossible travel."
2. **Spoof:** check in again holding a phone showing the worker's photo. Gemini flags it as a screen → **SUSPICIOUS (40)**, record auto-flagged, team lead notified. *Say:* "A photo can't fake a random action — and a spoof can't be averaged away by good GPS."
3. **Team lead** (`lead@sevasetu.gov.in`) → Flagged Records → "Low trust score" filter → Review → score ring, per-signal bars (✨ AI tag on liveness), reasons, both liveness frames → Mark Present / Reject.
4. *(Optional)* Impossible travel: DevTools → Sensors → set a far-away city → check in → "Impossible travel: 120 km (720 km/h)".
- Before judging: wake both Render services; liveness takes ~10–15 s on Gemini — fill the wait with the "flag, don't block" line.
- If Gemini is down the check-in still works: liveness shows "not verified" and the record lands in **REVIEW**, never TRUSTED.
