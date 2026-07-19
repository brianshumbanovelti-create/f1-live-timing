# F1 App Backend

A small Flask API that does the two things a static HTML page/browser
cannot do on its own:

1. **`POST /telemetry`** — runs [FastF1](https://github.com/theOehrly/Fast-F1)
   (Python-only) to pull speed, braking points, gear, RPM, and throttle for
   each driver's fastest lap, merges it into the frontend's existing OpenF1
   JSON export, and returns one combined file. No track map / X-Y position
   data — deliberately left out for now.

2. **`GET /reddit`** — pulls recent hot posts from r/formula1 via Reddit's
   free public JSON endpoint. No API key needed.

Analysis/debriefs do **not** happen here — that stays in a Claude Project,
on purpose (cross-session memory across a race weekend, no per-request API
cost, richer instructions living in one place). This service only fetches
and shapes data.

## Deploying on Render (free tier)

**Option A — Blueprint (recommended, least manual setup):**
1. In Render, click **New +** → **Blueprint**
2. Connect the `f1-live-timing` repo
3. Render will find `backend/render.yaml` and configure everything
4. Deploy

**Option B — Manual Web Service:**
1. In Render, click **New +** → **Web Service**
2. Connect the `f1-live-timing` repo
3. Set **Root Directory** to `backend`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn app:app`
6. Plan: **Free**
7. Deploy

Render will give you a live URL like `https://f1-app-backend.onrender.com`
— that's what the frontend's DUELS/NEWS tabs call.

## Known tradeoffs (accepted, not bugs)

- **Free tier cold starts.** After 15 minutes of inactivity the service
  spins down; the next request takes 30-60 seconds to wake it back up.
  Acceptable here since this only gets called once per session, not
  continuously.
- **Ephemeral disk.** Render's free tier wipes local disk on
  redeploy/restart, including FastF1's cache folder. This just means the
  first request after a restart is a cold FastF1 pull — no data is lost,
  nothing breaks.
- **No API keys required for either endpoint** — FastF1 pulls from public
  F1 timing archives, Reddit's JSON endpoint is public/unauthenticated for
  this kind of light, read-only use.

## Testing locally

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Then `POST` to `http://localhost:5000/telemetry` with a body like:
```json
{
  "year": 2026,
  "gp": "Belgian Grand Prix",
  "session": "R",
  "openf1_payload": { ... }
}
```

`GET http://localhost:5000/reddit` needs no body.

