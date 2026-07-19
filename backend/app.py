"""
F1 App Backend
==============

A small Flask API deployed on Render. Two jobs, both things a static HTML
file/browser genuinely cannot do on its own:

1. /telemetry — runs FastF1 (Python-only, needs a real server) to pull
   speed, braking points, gear, RPM, and throttle for each driver's
   fastest lap, merges it with the equivalent OpenF1 payload the frontend
   already builds, and returns ONE combined JSON. No track map (X/Y
   position) — deliberately excluded, see project notes.

2. /reddit — pulls recent posts from r/formula1 via Reddit's free public
   API. No API key needed for this read-only, low-volume use.

Nothing here talks to Anthropic/Claude — analysis still happens in a
Claude Project, by design (see project notes on why that stays separate).
This service only fetches and shapes data; it draws no conclusions.

IMPORTANT — fastf1 is imported LAZILY (inside fetch_fastf1_telemetry, not
at module level). Importing it eagerly pulls in pandas/numpy at process
boot and sits in memory permanently, which on Render's free 512MB tier
left too little headroom — a plain /reddit request could get its worker
killed (SIGKILL, OOM) even though /reddit itself is lightweight, simply
because fastf1's baseline footprint was already using most of the budget.
Loading it only when /telemetry is actually called keeps the idle process
small and only pays FastF1's memory cost when a telemetry request needs it.
"""

import os
import re
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allows the GitHub Pages frontend (a different origin) to call this API

# FastF1's own recommended cache dir — speeds up repeat requests for the
# same session. Render's free tier disk is ephemeral (wiped on
# redeploy/restart), which is fine: worst case, a cold cache just means
# the next request after a restart takes longer, it doesn't break anything.
# Just creating the folder here is cheap and doesn't need fastf1 imported;
# actually enabling it happens inside fetch_fastf1_telemetry, alongside the
# lazy import itself.
CACHE_DIR = "/tmp/fastf1_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
_fastf1_cache_enabled = False


def slugify(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "session"


def detect_braking_points(telemetry):
    """
    Flags the ONSET of each braking zone (distance + speed at that point),
    not every sample while the brake is held — see fastf1_export.py notes
    for why. Kept identical here so the manual-script output and the
    backend output always match in shape.
    """
    points = []
    was_braking = False
    for _, row in telemetry.iterrows():
        is_braking = bool(row.get("Brake", False))
        if is_braking and not was_braking:
            points.append({
                "distance_m": round(float(row["Distance"]), 1) if "Distance" in row else None,
                "speed_kmh": round(float(row["Speed"]), 1) if "Speed" in row else None,
            })
        was_braking = is_braking
    return points


def sampled_trace(telemetry, sample_every_m=25):
    """
    Reduces the full telemetry stream to fixed-distance-interval samples —
    speed, gear, RPM, throttle, DRS — rather than dumping every raw sample.
    This is the "with all" channel set: cheap in size (a few hundred KB for
    a full field, confirmed earlier), so no reason to trim further.
    """
    if "Distance" not in telemetry.columns:
        return []
    trace = []
    last_marker = -sample_every_m
    for _, row in telemetry.iterrows():
        dist = float(row["Distance"])
        if dist - last_marker >= sample_every_m:
            trace.append({
                "distance_m": round(dist, 1),
                "speed_kmh": round(float(row["Speed"]), 1) if "Speed" in row else None,
                "gear": int(row["nGear"]) if "nGear" in row and row["nGear"] == row["nGear"] else None,
                "rpm": int(row["RPM"]) if "RPM" in row and row["RPM"] == row["RPM"] else None,
                "throttle_pct": round(float(row["Throttle"]), 1) if "Throttle" in row else None,
                "drs": int(row["DRS"]) if "DRS" in row and row["DRS"] == row["DRS"] else None,
            })
            last_marker = dist
    return trace


def fetch_fastf1_telemetry(year, gp, session_code):
    """
    Returns a dict keyed by driver acronym — same key convention OpenF1 uses.
    Imports fastf1 lazily (see module docstring for why) — this is the ONLY
    place fastf1 gets imported and its cache gets enabled, and only runs
    when a /telemetry request actually needs it.
    """
    import fastf1  # lazy — keeps the idle process footprint small

    global _fastf1_cache_enabled
    if not _fastf1_cache_enabled:
        fastf1.Cache.enable_cache(CACHE_DIR)
        _fastf1_cache_enabled = True

    session = fastf1.get_session(year, gp, session_code)
    session.load(telemetry=True, laps=True, weather=False)

    out = {}
    for drv_code in session.laps["Driver"].unique():
        driver_laps = session.laps.pick_driver(drv_code)
        fastest = driver_laps.pick_fastest()
        if fastest is None or fastest.empty:
            continue
        try:
            tel = fastest.get_telemetry()
        except Exception:
            continue  # this driver's telemetry isn't available; skip, don't fail the whole request

        out[drv_code] = {
            "fastest_lap_time": str(fastest["LapTime"]) if fastest.get("LapTime") is not None else None,
            "top_speed_kmh": round(float(tel["Speed"].max()), 1) if "Speed" in tel else None,
            "braking_points": detect_braking_points(tel),
            "telemetry_trace": sampled_trace(tel),
        }
    return out


def merge_into_openf1_payload(openf1_payload, fastf1_by_driver):
    """
    Attaches FastF1 fields onto the matching driver entry in whichever
    OpenF1 branch structure this is (classification / phases.results /
    drivers) — matched by driver acronym, the key both sources share.
    Never overwrites existing OpenF1 fields; only adds new ones.
    """
    def attach(entry):
        code = entry.get("driver")
        if code and code in fastf1_by_driver:
            entry["fastf1"] = fastf1_by_driver[code]
        return entry

    if "classification" in openf1_payload:
        openf1_payload["classification"] = [attach(d) for d in openf1_payload["classification"]]
    if "phases" in openf1_payload:
        for phase in openf1_payload["phases"]:
            phase["results"] = [attach(d) for d in phase.get("results", [])]
    if "drivers" in openf1_payload:
        openf1_payload["drivers"] = [attach(d) for d in openf1_payload["drivers"]]

    openf1_payload["fastf1_merged"] = True
    return openf1_payload


@app.route("/telemetry", methods=["POST"])
def telemetry():
    """
    Expects a JSON body: { "year": 2026, "gp": "Belgian Grand Prix",
    "session": "R", "openf1_payload": {...} } — the frontend sends its
    own already-built OpenF1 export as openf1_payload, and gets back the
    same structure with FastF1 fields merged in.
    """
    body = request.get_json(force=True, silent=True) or {}
    year = body.get("year")
    gp = body.get("gp")
    session_code = body.get("session")
    openf1_payload = body.get("openf1_payload")

    if not (year and gp and session_code):
        return jsonify({"error": "year, gp, and session are required"}), 400
    if not openf1_payload:
        return jsonify({"error": "openf1_payload is required"}), 400

    try:
        fastf1_by_driver = fetch_fastf1_telemetry(int(year), gp, session_code)
    except Exception as e:
        return jsonify({"error": f"FastF1 fetch failed: {e}"}), 502

    merged = merge_into_openf1_payload(openf1_payload, fastf1_by_driver)
    return jsonify(merged)


@app.route("/reddit", methods=["GET"])
def reddit():
    """
    Pulls recent hot posts from r/formula1 via Reddit's public JSON
    endpoint. No API key/auth needed for this read-only, low-volume use —
    Reddit requires a descriptive User-Agent header on requests, which is
    set below per Reddit's own API rules.
    """
    limit = request.args.get("limit", "15")
    try:
        resp = requests.get(
            f"https://www.reddit.com/r/formula1/hot.json?limit={limit}",
            headers={"User-Agent": "f1-live-timing-app/1.0 (personal project)"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return jsonify({"error": f"Reddit fetch failed: {e}"}), 502

    posts = []
    for child in data.get("data", {}).get("children", []):
        p = child.get("data", {})
        posts.append({
            "title": p.get("title"),
            "author": p.get("author"),
            "score": p.get("score"),
            "num_comments": p.get("num_comments"),
            "url": f"https://reddit.com{p.get('permalink', '')}",
            "created_utc": p.get("created_utc"),
            "is_self": p.get("is_self"),
            "link_flair_text": p.get("link_flair_text"),
        })

    return jsonify({"source": "r/formula1", "posts": posts})


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "f1-app-backend"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
