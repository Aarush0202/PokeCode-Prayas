#!/usr/bin/env python3
"""CrowdGuard Real Bluetooth Low Energy (BLE) Scanner.

PRIVACY & ETHICS STATEMENT:
Raw Bluetooth hardware MAC addresses are immediately hashed using SHA-256
(truncated to 12 characters) in transient memory and discarded. No MAC addresses,
device names, or individual identities are ever stored or transmitted.
Only the aggregate device count per interval leaves this scanner.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import sys
from datetime import datetime, timezone
import httpx

try:
    from bleak import BleakScanner
    BLEAK_AVAILABLE = True
except ImportError:
    BLEAK_AVAILABLE = False


def hash_mac_address(address: str) -> str:
    """Anonymizes hardware address via one-way SHA-256 truncation."""
    return hashlib.sha256(address.encode("utf-8")).hexdigest()[:12]


async def scan_window(duration: float) -> int:
    """Scans for nearby BLE advertisements for duration seconds and returns unique count."""
    seen_hashes = set()

    def detection_callback(device, advertisement_data):
        anon_hash = hash_mac_address(device.address)
        seen_hashes.add(anon_hash)

    scanner = BleakScanner(detection_callback=detection_callback)
    await scanner.start()
    await asyncio.sleep(duration)
    await scanner.stop()

    return len(seen_hashes)


def parse_args():
    parser = argparse.ArgumentParser(
        description="CrowdGuard Live Bluetooth Scanner — anonymized BLE presence detection."
    )
    parser.add_argument("--zone", default="z1", help="Target zone ID (default: z1)")
    parser.add_argument("--interval", type=float, default=10.0, help="Scan window duration in seconds (default: 10)")
    parser.add_argument("--api", default="http://localhost:8000", help="API base URL (default: http://localhost:8000)")
    parser.add_argument("--scanner-id", default="ble-hw-1", help="Scanner device ID")
    return parser.parse_args()


async def main():
    args = parse_args()
    api_url = f"{args.api.rstrip('/')}/api/v1/beacons/ingest"

    print("=" * 65)
    print("  CrowdGuard Real BLE Scanner")
    print(f"  Zone ID      : {args.zone}")
    print(f"  Scan Window  : {args.interval}s")
    print(f"  API Endpoint : {api_url}")
    print("  Privacy Mode : SHA-256 MAC Anonymization Active")
    print("=" * 65)

    if not BLEAK_AVAILABLE:
        print("\n[Notice] 'bleak' library is not installed in this environment.")
        print("Please install bleak or use the fallback simulator:")
        print(f"  python tools/beacon_simulator.py --zone {args.zone}\n")
        return

    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            print(f"Scanning for BLE devices in {args.zone} for {args.interval}s...")
            try:
                unique_count = await scan_window(args.interval)
                print(f"Detected {unique_count} unique anonymized devices. Ingesting...")

                payload = {
                    "zone_id": args.zone,
                    "unique_devices": unique_count,
                    "scanner_id": args.scanner_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                resp = await client.post(api_url, json=payload)
                if resp.status_code in (200, 201):
                    print(f"-> Ingested: {unique_count} devices successfully into {args.zone}")
                else:
                    print(f"-> Server responded {resp.status_code}: {resp.text}")

            except PermissionError:
                print(
                    "\n[Permission Error] Bluetooth raw scanning requires root/CAP_NET_RAW permissions on Linux."
                )
                print("Tip: Run with 'sudo' or use the beacon simulator instead:")
                print(f"  python tools/beacon_simulator.py --zone {args.zone}\n")
                return
            except Exception as err:
                print(f"\n[Scanner Notice] Bluetooth hardware/driver issue: {err}")
                print("For demo presentation, seamlessly use the simulator:")
                print(f"  python tools/beacon_simulator.py --zone {args.zone}\n")
                return


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBLE Scanner stopped by user.")
        sys.exit(0)
