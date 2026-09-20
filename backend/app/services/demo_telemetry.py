"""Controlled synthetic demo telemetry generator for Live Operations.
Generates smooth, realistic camera & BLE signals processed by the existing fusion engine.
Demonstrates multimodal fusion, discrepancy cross-verification, and controlled single-sensor dropouts.
"""
import asyncio
import logging
import math
import random
from typing import Dict

from app.schemas.shared import BeaconSignal, Flow, VisionSignal, ZONE_BY_ID
from app.services import store

logger = logging.getLogger("pokecode.demo_telemetry")

_running = False
_task: asyncio.Task | None = None


class ZoneDemoState:

    def __init__(
        self,
        zone_id: str,
        cam_min: int,
        cam_max: int,
        ble_min: int,
        ble_max: int,
    ):
        self.zone_id = zone_id
        self.cam_min = cam_min
        self.cam_max = cam_max
        self.ble_min = ble_min
        self.ble_max = ble_max

        self.cam_current = float((cam_min + cam_max) // 2)
        self.ble_current = float((ble_min + ble_max) // 2)
        self.phase = random.uniform(0, 2 * math.pi)


# Target ranges matching venue capacities
_ZONE_CONFIGS: Dict[str, ZoneDemoState] = {
    "z1": ZoneDemoState("z1", cam_min=200, cam_max=330, ble_min=120, ble_max=200),
    "z2": ZoneDemoState("z2", cam_min=280, cam_max=420, ble_min=160, ble_max=260),
    "z3": ZoneDemoState("z3", cam_min=650, cam_max=850, ble_min=600, ble_max=800),
    "z4": ZoneDemoState("z4", cam_min=60, cam_max=140, ble_min=70, ble_max=150),
}


async def _run_loop():
    global _running
    logger.info("Starting CrowdGuard synthetic demo telemetry stream (interval: 6s)")
    tick_count = 0

    while _running:
        try:
            now = store.utcnow()
            tick_count += 1

            for zone_id, st in _ZONE_CONFIGS.items():
                st.phase += 0.15

                # Smooth sinusoidal variation with slight noise
                cam_target = (st.cam_min + st.cam_max) / 2 + math.sin(st.phase) * (st.cam_max - st.cam_min) * 0.35
                ble_target = (st.ble_min + st.ble_max) / 2 + math.cos(st.phase * 0.8) * (st.ble_max - st.ble_min) * 0.35

                st.cam_current += (cam_target - st.cam_current) * 0.2 + random.uniform(-3, 3)
                st.ble_current += (ble_target - st.ble_current) * 0.2 + random.uniform(-3, 3)

                cam_count = int(max(st.cam_min, min(st.cam_max, round(st.cam_current))))
                ble_count = int(max(st.ble_min, min(st.ble_max, round(st.ble_current))))

                area = ZONE_BY_ID[zone_id].area_sqm if zone_id in ZONE_BY_ID else 400.0
                density = round(cam_count / area, 3)

                # Demonstrate controlled camera dropout on z1 every 8 ticks (~48s) for 3 ticks (~18s)
                camera_offline = (zone_id == "z1") and (8 <= (tick_count % 12) <= 10)

                if not camera_offline:
                    store.add_vision(
                        VisionSignal(
                            zone_id=zone_id,
                            timestamp=now,
                            person_count=cam_count,
                            density_per_sqm=density,
                            flow=Flow(dx=round(random.uniform(-0.1, 0.1), 2), dy=round(random.uniform(-0.1, 0.1), 2), magnitude=0.12),
                            confidence=0.92,
                        )
                    )

                # BLE remains online
                store.add_beacon(
                    BeaconSignal(
                        zone_id=zone_id,
                        timestamp=now,
                        unique_devices=ble_count,
                        scanner_id=f"demo-ble-{zone_id}",
                    )
                )

        except Exception as exc:
            logger.warning("Error in demo telemetry loop: %s", exc)

        await asyncio.sleep(6.0)


def start_demo_telemetry():
    global _running, _task
    if _running:
        return
    _running = True
    _task = asyncio.create_task(_run_loop())


def stop_demo_telemetry():
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        _task = None
    logger.info("Stopped CrowdGuard synthetic demo telemetry stream")
