# DEPLOY.md — do this TONIGHT (≈45 min), then every push to `main` redeploys automatically

```
Browser ──► Vercel (client/)  ──VITE_API_URL──►  Render (server/)  ──► MongoDB Atlas
                                                     │  ├──► Cloudinary (images)
                                                     │  ├──► Gemini API (AI features)
                                                     └──PYTHON_SERVICE_URL──► Hugging Face Space (python_service/)
```
Nothing changes in the data layer: **MongoDB stays the database, Cloudinary stays the image store.**

## 0. MongoDB Atlas (2 min)
Network Access → Add IP → `0.0.0.0/0` (Render and Hugging Face don't have fixed IPs).

## 1. Face service → Hugging Face Space (15 min, needs most testing)
1. huggingface.co → New Space → SDK **Docker** → Blank → CPU basic (free) → Public is fine (no secrets in code).
2. Upload `python_service/app.py`, `requirements.txt`, `Dockerfile` (Files → Add file → Upload).
3. In the Space's `README.md` frontmatter add `app_port: 7860`.
4. Settings → Variables and secrets → **Secret** `MONGODB_URI` (same Atlas URI as the server). Optional variable `FACE_TOLERANCE=0.5`.
5. Wait for the build (first one ~5–10 min — it downloads the 100 MB face model).
6. Open `https://<user>-<space>.hf.space/health` → must say `"mode": "real"`. If it says `mock`, the face library didn't install — check the build logs.
> This service lives outside GitHub: if anyone changes `python_service/` tomorrow, re-upload the changed file to the Space.

## 2. Backend → Render (10 min)
New → Web Service → connect `SheSolves3.0_Sahayog` →
- Root Directory: `server` · Build: `npm install` · Start: `npm start` · Instance: Free
- Health Check Path: `/api/health`
- Environment: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `PYTHON_SERVICE_URL=https://<user>-<space>.hf.space`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.8-flash`
- (Don't set `PORT` — Render provides it.)
- Check: `https://<app>.onrender.com/api/health` → ok, and `/api/ai/health` → `"source": "ai"`.

## 3. Frontend → Vercel (5 min)
Add New Project → import the repo →
- Root Directory: `client` · Framework: Vite (auto)
- Env: `VITE_API_URL=https://<app>.onrender.com/api`
- Deploy. `client/vercel.json` makes page refreshes on routes like `/teamlead/tasks` work.
- If you change `VITE_API_URL` later, **redeploy** — Vite bakes env vars in at build time.

## 4. End-to-end test on the deployed URL (10 min)
- [ ] Log in as each seeded role (`server/seed.js`, password `password123`)
- [ ] Register a NEW field worker with a real face photo (seeded workers have no face registered) — then check in as them, face should match
- [ ] Check in with someone else's face → should be flagged in Team Lead → Flagged Records
- [ ] Submit a field report with photos → images load from Cloudinary
- [ ] Each teammate pushes one tiny commit → Vercel + Render both redeploy

## Known gotchas
- **Render free sleeps after ~15 min idle** (first request then takes ~1 min). Open `/api/health` 5 minutes before judging and keep a tab on it.
- If the face service is down when a worker registers, the server silently stores a **placeholder encoding** and that worker will never match later. Always check the Space's `/health` first; re-register any worker created while it was down.
- Uploads are capped at 12 MB per image by Multer — fine for phone photos.
- The Gemini model name changes over time; confirm it in Google AI Studio and update `GEMINI_MODEL` on Render if `/api/ai/health` shows `fallback`.
