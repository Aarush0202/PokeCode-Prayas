"""CrowdGuard API v1 router. Registers every endpoint module defensively."""
from __future__ import annotations

import importlib
import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

api_router = APIRouter()

# (module name, url prefix, swagger tag)
_MODULES = [
    ("health", "", "Health"),
    ("demo", "", "Demo"),
    ("zones", "", "Zones"),
    ("vision", "/vision", "Vision"),
    ("beacons", "/beacons", "Beacons"),
    ("events", "/events", "Events"),
    ("forecast", "/forecast", "Forecast"),
    ("risk", "/risk", "Risk"),
    ("planner", "", "Planner"),
    ("planner_parse", "", "Planner Parse"),
    ("attention", "/attention", "Attention"),
    ("metro", "/metro", "Metro"),
]

for _name, _prefix, _tag in _MODULES:
    try:
        _module = importlib.import_module(f"app.api.v1.endpoints.{_name}")
        api_router.include_router(_module.router, prefix=_prefix, tags=[_tag])
    except Exception as exc:  # noqa: BLE001 - a missing teammate module must not break boot
        logger.warning("CrowdGuard: skipping router '%s' (%s)", _name, exc)
