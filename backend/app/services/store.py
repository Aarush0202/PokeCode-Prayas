"""CrowdGuard in-memory store. Cross-team contract — DO NOT EDIT."""
from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional

from app.schemas.shared import BeaconSignal, EventItem, VisionSignal

MAX_PER_ZONE = 500

_vision: Dict[str, Deque[VisionSignal]] = defaultdict(lambda: deque(maxlen=MAX_PER_ZONE))
_beacon: Dict[str, Deque[BeaconSignal]] = defaultdict(lambda: deque(maxlen=MAX_PER_ZONE))
_events: List[EventItem] = []


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def add_vision(signal: VisionSignal) -> int:
    _vision[signal.zone_id].append(signal)
    return len(_vision[signal.zone_id])


def latest_vision(zone_id: str) -> Optional[VisionSignal]:
    bucket = _vision.get(zone_id)
    return bucket[-1] if bucket else None


def vision_history(zone_id: str, limit: int = 50) -> List[VisionSignal]:
    return list(_vision.get(zone_id, []))[-limit:]


def add_beacon(signal: BeaconSignal) -> int:
    _beacon[signal.zone_id].append(signal)
    return len(_beacon[signal.zone_id])


def latest_beacon(zone_id: str) -> Optional[BeaconSignal]:
    bucket = _beacon.get(zone_id)
    return bucket[-1] if bucket else None


def beacon_history(zone_id: str, limit: int = 50) -> List[BeaconSignal]:
    return list(_beacon.get(zone_id, []))[-limit:]


def set_events(events: List[EventItem]) -> int:
    global _events
    _events = list(events)
    return len(_events)


def get_events() -> List[EventItem]:
    return list(_events)


def reset() -> None:
    _vision.clear()
    _beacon.clear()
    set_events([])
