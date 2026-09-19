#!/usr/bin/env python3
"""CrowdGuard Live Telemetry Feeder Daemon.
Continuously feeds realistic camera and BLE telemetry to the FastAPI backend
so that all monitored zones maintain active live data and real-time risk scores.
"""
from __future__ import annotations

import argparse
import math
import random
import time
from datetime import datetime, timezone
import httpx

# Nominal crowd parameters per zone (nominal count, standard deviation)
ZONE_PARAMS = {
    "z1": {"name": "Main Gate Plaza", "capacity": 400, "base": 135, "std": 12, "flow": (0.05, 0.08)},
    "z2": {"name": "Metro Concourse", "capacity": 600, "base": 340, "std": 25, "flow": (-0.15, 0.42)},
    "z3": {"name": "Market Street", "capacity": 900, "base": 480, "std": 35, "flow": (0.35, 0.12)},
    "z4": {"name": "Food Court", "capacity": 300, "base": 95, "std": 10, "flow": (0.02, 0.04)},
}


def parse_args():
    parser = argparse.ArgumentParser(description="CrowdGuard Live Telemetry Feeder")
    parser.add_argument("--api", default="http://localhost:8000", help="API base URL (default: http://localhost:8000)")
    parser.add_argument("--interval", type=float, default=3.0, help="Interval in seconds between telemetry pulses (default: 3.0)")
    return parser.parse_args()


def main():
    args = parse_args()
    base_url = args.api.rstrip("/")
    print(f"CrowdGuard Telemetry Feeder starting against {base_url} (interval: {args.interval}s)...")

    step = 0
    with httpx.Client(timeout=4.0) as client:
        while True:
            step += 1
            now_iso = datetime.now(timezone.utc).isoformat()
            t = time.time()

            for zone_id, p in ZONE_PARAMS.items():
                # Add gentle sinusoidal diurnal variation plus noise
                sine_wave = math.sin(t / 45.0 + hash(zone_id) % 10) * (p["std"] * 0.8)
                noise = random.gauss(0, p["std"] * 0.4)
                est_count = int(max(10, min(p["capacity"], p["base"] + sine_wave + noise)))

                # Camera count (slightly varied from true estimate)
                cam_count = max(5, int(est_count + random.randint(-10, 10)))

                # BLE detected devices (deliberate scale factor ~0.55 of true headcount)
                ble_devices = max(5, int(est_count * 0.52 + random.randint(-8, 8)))

                # 1. Post Camera reading
                try:
                    client.post(
                        f"{base_url}/api/v1/vision/simulate",
                        json={
                            "zone_id": zone_id,
                            "count": cam_count,
                            "occluded": False,
                        },
                    )
                except Exception as exc:
                    print(f"[{zone_id}] Vision post error: {exc}")

                # 2. Post BLE reading
                try:
                    client.post(
                        f"{base_url}/api/v1/beacons/ingest",
                        json={
                            "zone_id": zone_id,
                            "unique_devices": ble_devices,
                            "scanner_id": f"scanner-{zone_id}-auto",
                            "timestamp": now_iso,
                        },
                    )
                except Exception as exc:
                    print(f"[{zone_id}] BLE post error: {exc}")

            if step % 10 == 0:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Pulse #{step}: Telemetry active across all 4 zones.")

            time.sleep(args.interval)


if __name__ == "__main__":
    main()
