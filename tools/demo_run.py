#!/usr/bin/env python3
"""CrowdGuard Demo Runner.
Orchestrates an end-to-end blind-spot verification scenario:
1. Resets state; checks z1-z4 are NORMAL.
2. Injects an occluded camera reading for z3 (Market Street, capacity 900).
3. Ramps BLE beacon count from 40 to peak (default 520, with option to ramp higher).
4. Polls /api/v1/risk/live/z3 every 2s.
5. Measures exact seconds to first ELEVATED and first HIGH, and verifies alert firing.
Can run against a live server or directly in-process via FastAPI TestClient.
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

# Add backend directory to sys.path so in-process execution works cleanly
import os
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def parse_args():
    parser = argparse.ArgumentParser(description="CrowdGuard Orchestrated Demo Runner")
    parser.add_argument("--api", default="http://localhost:8000", help="Backend API base URL (default: http://localhost:8000)")
    parser.add_argument("--zone", default="z3", help="Target zone ID (default: z3)")
    parser.add_argument("--start", type=int, default=40, help="Initial BLE device count (default: 40)")
    parser.add_argument("--peak", type=int, default=520, help="Peak BLE device count (default: 520)")
    parser.add_argument("--seconds", type=float, default=60.0, help="Ramp duration in seconds (default: 60.0)")
    parser.add_argument("--interval", type=float, default=2.0, help="Poll interval in seconds (default: 2.0)")
    parser.add_argument("--camera-occluded-count", type=int, default=35, help="Occluded camera count (default: 35)")
    parser.add_argument("--in-process", action="store_true", help="Run in-process via TestClient without starting external server")
    return parser.parse_args()


def get_client(args):
    """Return an HTTP client (either httpx over network or TestClient in-process)."""
    if args.in_process:
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    import httpx
    try:
        c = httpx.Client(base_url=args.api.rstrip("/"), timeout=5.0)
        # Quick health check
        r = c.get("/health")
        if r.status_code == 200:
            return c
    except Exception:
        pass

    # Fallback to in-process if live server not responding
    print(f"Notice: Live server at {args.api} not detected. Falling back to in-process TestClient.")
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def run_demo():
    args = parse_args()
    client = get_client(args)

    print("=" * 72)
    print("  CrowdGuard Orchestrated Blind-Spot Demo Runner")
    print(f"  Target Zone        : {args.zone} (Market Street, Capacity 900)")
    print(f"  Camera Blind-Spot  : Occluded reading ({args.camera_occluded_count} people)")
    print(f"  Beacon Surge Ramp  : {args.start} -> {args.peak} devices over {args.seconds:.1f}s")
    print("=" * 72)

    # Step 1: Reset in-memory store
    try:
        from app.services import store
        store.reset()
        print("[Step 1] In-memory store reset successfully.")
    except Exception as err:
        print(f"[Step 1] Note on store reset: {err}")

    # Check baseline status
    live_resp = client.get("/api/v1/risk/live")
    if live_resp.status_code == 200:
        zones = live_resp.json().get("zones", [])
        tiers = {z["zone_id"]: z["risk_tier"] for z in zones}
        print(f"[Step 1] Initial Zone Tiers: {tiers}")

    # Step 2: Inject occluded camera frame
    sim_cam = client.post(
        "/api/v1/vision/simulate",
        json={"zone_id": args.zone, "count": args.camera_occluded_count, "occluded": True},
    )
    if sim_cam.status_code == 200:
        print(f"[Step 2] Camera blind-spot simulated: {args.camera_occluded_count} persons in {args.zone} (occluded=True).")
    else:
        print(f"[Step 2] Camera simulate failed: {sim_cam.status_code} {sim_cam.text}")

    # Step 3 & 4: Ramp BLE and poll /risk/live/{zone_id}
    print("\nStarting Beacon Ramp and Risk Monitoring...")
    print(f"{'Elapsed(s)':<11}{'BLE Count':<11}{'Cam Count':<11}{'Fused Est':<11}{'Risk Score':<12}{'Tier':<12}{'Rule / Trigger'}")
    print("-" * 75)

    start_time = time.time()
    time_elevated: float | None = None
    time_high: float | None = None
    time_critical: float | None = None
    alert_fired: bool = False

    while True:
        elapsed = time.time() - start_time
        progress = min(elapsed / max(args.seconds, 1.0), 1.0)
        current_ble = int(args.start + (args.peak - args.start) * progress)

        # Ingest BLE count
        client.post(
            "/api/v1/beacons/ingest",
            json={
                "zone_id": args.zone,
                "unique_devices": current_ble,
                "scanner_id": "demo-scanner-1",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Refresh camera reading with fresh timestamp so it doesn't go stale during ramp
        client.post(
            "/api/v1/vision/simulate",
            json={"zone_id": args.zone, "count": args.camera_occluded_count, "occluded": True},
        )

        # Poll risk
        risk_res = client.get(f"/api/v1/risk/live/{args.zone}")
        if risk_res.status_code == 200:
            data = risk_res.json()
            tier = data.get("risk_tier", "NORMAL")
            score = data.get("risk_score", 0.0)
            fused = data.get("fused_estimate", 0)
            reasons = data.get("reasons", [])
            primary_reason = reasons[0] if reasons else "baseline"

            if tier in ("ELEVATED", "HIGH", "CRITICAL") and time_elevated is None:
                time_elevated = elapsed
            if tier in ("HIGH", "CRITICAL") and time_high is None:
                time_high = elapsed
            if tier == "CRITICAL" and time_critical is None:
                time_critical = elapsed

            cam_count = data.get("vision", {}).get("person_count", "-") if data.get("vision") else "-"

            print(
                f"{elapsed:<11.1f}{current_ble:<11}{cam_count:<11}{fused:<11}{score:<12.3f}{tier:<12}{primary_reason[:30]}"
            )

        if progress >= 1.0 and elapsed >= args.seconds + 2.0:
            break

        time.sleep(args.interval)

    # Step 5: Check alert status
    alerts_res = client.get("/api/v1/risk/alerts")
    active_alerts = []
    if alerts_res.status_code == 200:
        active_alerts = alerts_res.json().get("alerts", [])
        alert_fired = any(a.get("zone_id") == args.zone for a in active_alerts)

    print("-" * 75)
    print("\n=== MEASURED DEMO TIMING RESULTS ===")
    print(f"  Target Zone                       : {args.zone}")
    print(f"  Initial Count -> Peak BLE         : {args.start} -> {args.peak}")
    print(f"  Ramp Duration                     : {args.seconds:.1f}s")
    print(f"  Time to first ELEVATED            : {f'{time_elevated:.1f}s' if time_elevated is not None else 'Not reached'}")
    print(f"  Time to first HIGH                : {f'{time_high:.1f}s' if time_high is not None else 'Not reached'}")
    print(f"  Time to first CRITICAL            : {f'{time_critical:.1f}s' if time_critical is not None else 'Not reached'}")
    print(f"  Alert Fired for {args.zone}               : {'YES' if alert_fired else 'NO'} ({len(active_alerts)} total active alerts)")
    print("=" * 75)

    return {
        "zone": args.zone,
        "time_elevated": time_elevated,
        "time_high": time_high,
        "alert_fired": alert_fired,
    }


if __name__ == "__main__":
    run_demo()
