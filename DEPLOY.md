# DEPLOY.md — do this TONIGHT (≈45 min), then every push to `main` redeploys automatically

```
Browser ──► Vercel (client/)  ──VITE_API_URL──►  Render (server/)  ──► MongoDB Atlas
                                                     │  ├──► Cloudinary (images)
                                                     │  ├──► Gemini API (AI features)
                                                     └──PYTHON_SERVICE_URL──► Render (python_service/)
```
Nothing changes in the data layer: **MongoDB stays the database, Cloudinary stays the image store.**

Live URLs: frontend `https://she-solves3-0-sahayog.vercel.app` · API `https://sahayog-backend-3yus.onrender.com` · face service `https://shesolves3-0-sahayog.onrender.com`

## 0. MongoDB Atlas (2 min)
Network Access → Add IP → `0.0.0.0/0` (Render doesn't have fixed IPs).

## 1. Face service → Render (15 min, needs most testing)
(Hugging Face Docker Spaces now need a paid plan, so the face service runs on Render's free tier.)
New → Web Service → connect `SheSolves3.0_Sahayog` →
- Language: **Python 3** · Root Directory: `python_service` · Instance: Free · Same region as the backend
- Build: `pip install -r requirements.txt gunicorn && pip install face-recognition==1.3.0 --no-deps`
- Start: `gunicorn -w 1 --threads 4 -t 120 -b 0.0.0.0:$PORT app:app`
- Health Check Path: `/health`
- Environment: `PYTHON_VERSION=3.10.13` (required — dlib-bin may not install on newer Python), `MONGODB_URI` (same Atlas URI as the server). Optional `FACE_TOLERANCE=0.5`.
- First build ~5–10 min (downloads the face model). Then `https://<face-app>.onrender.com/health` → must say `"mode": "real"`. If it says `mock`, the face library didn't install — check the build logs.
- Alternative: Language **Docker** with `python_service/Dockerfile` (no build/start commands needed).
> Free tier = 512 MB RAM. If the logs show "Out of memory" / SIGKILL on the first face registration, the models don't fit — tell the team immediately.

## 2. Backend → Render (10 min)
New → Web Service → connect `SheSolves3.0_Sahayog` →
- Root Directory: `server` · Build: `npm install` · Start: `npm start` · Instance: Free
- Health Check Path: `/api/health`
- Environment: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `PYTHON_SERVICE_URL=https://<face-app>.onrender.com`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.8-flash`
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
- **Render free sleeps after ~15 min idle** (first request then takes ~1 min). Both the API and the face service sleep — open `/api/health` and the face service `/health` 5 minutes before judging and keep a tab on them.
- If the face service is down when a worker registers, the server silently stores a **placeholder encoding** and that worker will never match later. Always check the face service's `/health` first; re-register any worker created while it was down.
- Uploads are capped at 12 MB per image by Multer — fine for phone photos.
- The Gemini model name changes over time; confirm it in Google AI Studio and update `GEMINI_MODEL` on Render if `/api/ai/health` shows `fallback`.
