# TASKS.md — each person edits ONLY their own section

Status: ⬜ todo · 🟨 doing · ✅ pushed · 🚫 blocked (say on what)

## Frontend — <name>
- ⬜ 

## Backend — <name>
- ⬜ 

## AI / ML — Shruti
Challenge 3 — Attendance fraud & anomaly detection (branch `feat/ch3-attendance-trust`)
- ✅ Trust score service: face distance 30 · liveness 20 · geofence 20 · timing 10 · device 10 · location jump 10 → TRUSTED / REVIEW / SUSPICIOUS (`server/services/attendanceTrust.service.js`)
- ✅ Critical rules: spoof / failed liveness / face mismatch → capped at 40 (SUSPICIOUS + FLAGGED); no TRUSTED without passed liveness
- ✅ Check-in/out scored + saved; accepts `livenessFrame`, `livenessAction`, `deviceId`, `userAgent`; flag, never block
- ✅ Gemini two-frame liveness (`server/services/ai/liveness.js`) — runs in parallel with face check, neutral on fallback
- ✅ `GET /api/admin/attendance/anomalies?band=&limit=` (ADMIN, TEAM_LEAD own tasks) + API_CONTRACT
- ✅ UI: random liveness action + countdown in Check-in/Check-out, device id, trust ring + signal bars in attendance drawer and Flagged Records ("Low trust score" filter)
- ✅ Reliability: field photos compressed client-side, Cloudinary timeouts → 504 "try again", public DNS for outbound calls (`server/utils/fastDns.js`)
- ⬜ Merge branch to `main` and re-test check-in on the deployed URLs
- ⬜ (optional) Admin "Attendance anomalies" page using the anomalies endpoint — needs App.jsx route

Challenge 4 — Multilingual AI field reports (branch `feat/ch4-ai-reports`)
- ✅ Report generator (`server/services/ai/reportGenerator.js`): report text + data + ≤3 photos + before/after attendance photos + trust score → structured report in en / hi / mr; templated fallback in the same language
- ✅ `POST /api/ai/reports/:fieldReportId/generate?lang=&refresh=` (TEAM_LEAD own tasks, ADMIN), cached in `FieldReport.aiReport` + API_CONTRACT
- ✅ Gemini overload resilience: `ai.service` falls back to `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash`) on 503/429 within the same timeout (helps liveness + impact story too); report generator retries once
- ✅ UI: "Generate AI report" + language picker in Team Lead Field Reports, document card, Print / Save as PDF (`components/reports/`)
- ✅ Admin Reports Inbox: forwarded report shows task, worker, lead's note + the AI report; "AI report" / "Forwarded" chips; Print / Save as PDF prints the AI report (`admin.controller.js` formatReportDoc + `AdminDashboard.jsx`)

## Demo & deck — all
- ⬜ Wake both Render services 5 min before judging (API `/api/health`, face service `/health`)
- ⬜ Run the full demo on the deployed URL, not localhost
- ⬜ Update slides with the Round 3 features + screenshots
