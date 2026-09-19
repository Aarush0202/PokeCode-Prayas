#!/usr/bin/env python3
"""CrowdGuard Beacon Simulator.
Demo instrument: Simulates Bluetooth scanner ingestion by ramping or holding device counts.
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
import httpx


def parse_args():
    parser = argparse.ArgumentParser(
        description="CrowdGuard BLE Beacon Simulator — ramps or holds device counts to test fusion & risk triggers."
    )
    parser.add_argument("--zone", default="z3", help="Target zone ID (z1, z2, z3, z4). Default: z3 (Market Street)")
    parser.add_argument("--api", default="http://localhost:8000", help="API base URL. Default: http://localhost:8000")
    parser.add_argument("--start", type=int, default=40, help="Initial device count for ramp mode. Default: 40")
    parser.add_argument("--peak", type=int, default=520, help="Peak device count for ramp mode. Default: 520")
    parser.add_argument("--minutes", type=float, default=2.0, help="Duration of ramp in minutes. Default: 2.0")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between posts. Default: 3.0")
    parser.add_argument("--steady", type=int, default=None, help="Hold constant count (overrides ramp mode)")
    parser.add_argument("--scanner-id", default="sim-cli-1", help="Scanner hardware identifier")
    return parser.parse_args()


def main():
    args = parse_args()
    api_url = f"{args.api.rstrip('/')}/api/v1/beacons/ingest"

    print("=" * 65)
    print("  CrowdGuard BLE Beacon Simulator")
    print(f"  Target Zone : {args.zone}")
    print(f"  API Endpoint: {api_url}")
    if args.steady is not None:
        print(f"  Mode        : STEADY state ({args.steady} devices)")
    else:
        print(f"  Mode        : RAMP ({args.start} -> {args.peak} over {args.minutes} mins)")
    print(f"  Interval    : Every {args.interval}s")
    print("=" * 65)
    print("Press Ctrl+C to stop simulation.\n")

    start_time = time.time()
    total_seconds = max(args.minutes * 60.0, 1.0)
    step = 0

    with httpx.Client(timeout=5.0) as client:
        while True:
            elapsed = time.time() - start_time
            step += 1

            if args.steady is not None:
                current_devices = args.steady
            else:
                progress = min(elapsed / total_seconds, 1.0)
                current_devices = int(args.start + (args.peak - args.start) * progress)

            payload = {
                "zone_id": args.zone,
                "unique_devices": current_devices,
                "scanner_id": args.scanner_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            try:
                resp = client.post(api_url, json=payload)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    status_line = (
                        f"[{step:03d}] {datetime.now().strftime('%H:%M:%S')} | "
                        f"Zone: {args.zone} | Count: {current_devices:4d} devices | "
                        f"Stored Total: {data.get('stored_readings', 0):3d} | OK 200"
                    )
                    print(status_line)
                else:
                    print(f"[{step:03d}] Failed HTTP {resp.status_code}: {resp.text}")
            except httpx.ConnectError:
                print(
                    f"[{step:03d}] Connection failed to {args.api}. "
                    "Is the CrowdGuard backend running on port 8000?"
                )
            except Exception as err:
                print(f"[{step:03d}] Error: {err}")

            if args.steady is None and elapsed >= total_seconds:
                print(f"\n[Completed] Reached peak ({args.peak} devices). Holding peak count...")

            time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
        sys.exit(0)
