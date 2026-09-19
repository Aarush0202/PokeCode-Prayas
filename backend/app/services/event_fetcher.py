"""CrowdGuard Event & Weather Fetcher.

Responsible for:
1. Generating plausible, always-upcoming seed events anchored to utcnow().
2. Fetching Open-Meteo weather with 30-minute in-memory caching and graceful 5s timeouts.
3. Updating store.py with resilient fallbacks (offline / zero-API-key friendly).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.schemas.shared import ZONE_BY_ID, EventItem
from app.services import store

logger = logging.getLogger("crowdguard.event_fetcher")

# In-memory weather cache: key = f"{zone_id}", value = (cached_at_datetime, hourly_data_dict)
_weather_cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 1800  # 30 minutes


def get_default_weather() -> Dict[str, Any]:
    return {
        "temperature_2m": [25.0] * 72,
        "precipitation": [0.0] * 72,
        "time": [],
    }


def fetch_weather_open_meteo(zone_id: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """Fetch hourly weather for zone from Open-Meteo with caching and 5s timeout."""
    now = store.utcnow()
    zone = ZONE_BY_ID.get(zone_id)
    if not zone:
        return get_default_weather(), f"Unknown zone: {zone_id}"

    if zone_id in _weather_cache:
        cached_time, cached_data = _weather_cache[zone_id]
        if (now - cached_time).total_seconds() < CACHE_TTL_SECONDS:
            return cached_data, None

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={zone.lat}&longitude={zone.lon}"
        f"&hourly=temperature_2m,precipitation&forecast_days=3"
    )

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            hourly = data.get("hourly", {})
            _weather_cache[zone_id] = (now, hourly)
            return hourly, None
    except Exception as exc:
        logger.warning("Open-Meteo weather fetch failed for %s: %s", zone_id, exc)
        default_data = get_default_weather()
        return default_data, f"Open-Meteo network error for {zone_id}: {str(exc)}"


def get_weather_for_zone_hour(zone_id: str, target_time: datetime) -> Tuple[float, float]:
    """Return (temp_c, rain_mm) for a specific zone and hour with fallback."""
    hourly, _ = fetch_weather_open_meteo(zone_id)
    times = hourly.get("time", [])
    target_str = target_time.strftime("%Y-%m-%dT%H:00")

    if target_str in times:
        idx = times.index(target_str)
        temps = hourly.get("temperature_2m", [])
        rains = hourly.get("precipitation", [])
        temp = float(temps[idx]) if idx < len(temps) else 25.0
        rain = float(rains[idx]) if idx < len(rains) else 0.0
        return temp, rain

    # Fallback default
    return 25.0, 0.0


def generate_seed_events(reference_time: Optional[datetime] = None) -> List[EventItem]:
    """Generate 10-15 realistic, time-relative events across the next 72 hours.
    
    Ensures a prominent crowd spike tomorrow evening in z3 (Market Street),
    as required by the CrowdGuard demo script.
    """
    now = reference_time or store.utcnow()
    # Normalize base to top of current hour
    base = now.replace(minute=0, second=0, microsecond=0)

    # Calculate tomorrow at 18:00 UTC
    tomorrow_18 = (base + timedelta(days=1)).replace(hour=18)

    seed_defs = [
        # Immediate / Today events
        {
            "id": "ev-seed-01",
            "title": "Prayas Hackathon Opening Ceremony & Keynote",
            "start_offset_h": 2,
            "duration_h": 3,
            "venue": "Main Auditorium Amphitheatre",
            "category": "conference",
            "expected_attendance": 350,
            "zone_id": "z1",
        },
        {
            "id": "ev-seed-02",
            "title": "Metro Concourse Evening Rush Hour Spike",
            "start_offset_h": 4,
            "duration_h": 3,
            "venue": "Metro Platform Gate A & Concourse",
            "category": "transit",
            "expected_attendance": 550,
            "zone_id": "z2",
        },
        {
            "id": "ev-seed-03",
            "title": "Chef Pop-Up & Live Grill Festival",
            "start_offset_h": 5,
            "duration_h": 4,
            "venue": "Central Food Court Courtyard",
            "category": "food",
            "expected_attendance": 280,
            "zone_id": "z4",
        },
        {
            "id": "ev-seed-04",
            "title": "Evening Aarti & Flower Market Rush",
            "start_offset_h": 6,
            "duration_h": 2,
            "venue": "Market Street North Junction",
            "category": "cultural",
            "expected_attendance": 480,
            "zone_id": "z3",
        },
        # Overnight / Next morning
        {
            "id": "ev-seed-05",
            "title": "Morning Metro Commuter Inflow Surge",
            "start_offset_h": 18,
            "duration_h": 3,
            "venue": "Metro Transit Interchange",
            "category": "transit",
            "expected_attendance": 580,
            "zone_id": "z2",
        },
        {
            "id": "ev-seed-06",
            "title": "University Project Exhibition & Pitch Day",
            "start_offset_h": 21,
            "duration_h": 5,
            "venue": "Main Gate Plaza Canopy",
            "category": "education",
            "expected_attendance": 390,
            "zone_id": "z1",
        },
        # TOMORROW EVENING - THE DEMO SHOWCASE SPIKE IN Z3!
        {
            "id": "ev-seed-07",
            "title": "IPL Live Cricket Mega Screening & Street Fest",
            "start_time": tomorrow_18,
            "duration_h": 4,
            "venue": "Market Street Arena & Big Screen Plaza",
            "category": "sports",
            "expected_attendance": 1600,
            "zone_id": "z3",
        },
        {
            "id": "ev-seed-08",
            "title": "Prayas Tech Fest Gala & DJ Night",
            "start_offset_h": 29,
            "duration_h": 4,
            "venue": "Main Stage Amphitheatre",
            "category": "festival",
            "expected_attendance": 850,
            "zone_id": "z1",
        },
        {
            "id": "ev-seed-09",
            "title": "Midnight Street Food Bazaar",
            "start_offset_h": 32,
            "duration_h": 4,
            "venue": "Food Court East Wing",
            "category": "food",
            "expected_attendance": 290,
            "zone_id": "z4",
        },
        # 48-72h horizon
        {
            "id": "ev-seed-10",
            "title": "Weekend Artisan Flea Market",
            "start_offset_h": 43,
            "duration_h": 6,
            "venue": "Market Street Promenade",
            "category": "shopping",
            "expected_attendance": 750,
            "zone_id": "z3",
        },
        {
            "id": "ev-seed-11",
            "title": "City Marathon Finish Line & Awards",
            "start_offset_h": 46,
            "duration_h": 3,
            "venue": "Main Gate Plaza",
            "category": "sports",
            "expected_attendance": 500,
            "zone_id": "z1",
        },
        {
            "id": "ev-seed-12",
            "title": "Sunday Transit Maintenance Rerouting Crowd",
            "start_offset_h": 51,
            "duration_h": 4,
            "venue": "Metro Concourse South Gate",
            "category": "transit",
            "expected_attendance": 440,
            "zone_id": "z2",
        },
        {
            "id": "ev-seed-13",
            "title": "Sunday Sundowner Acoustic Live Jam",
            "start_offset_h": 54,
            "duration_h": 3,
            "venue": "Food Court Terrace",
            "category": "entertainment",
            "expected_attendance": 270,
            "zone_id": "z4",
        },
        {
            "id": "ev-seed-14",
            "title": "Super Sunday Grand Shopping Carnival",
            "start_offset_h": 65,
            "duration_h": 5,
            "venue": "Market Street Central",
            "category": "shopping",
            "expected_attendance": 1200,
            "zone_id": "z3",
        },
    ]

    events: List[EventItem] = []
    for item in seed_defs:
        zone = ZONE_BY_ID[item["zone_id"]]
        if "start_time" in item:
            start = item["start_time"]
        else:
            start = base + timedelta(hours=item["start_offset_h"])
        end = start + timedelta(hours=item["duration_h"])

        event = EventItem(
            id=item["id"],
            title=item["title"],
            start_time=start,
            end_time=end,
            venue=item["venue"],
            lat=zone.lat,
            lon=zone.lon,
            category=item["category"],
            expected_attendance=item["expected_attendance"],
            source="seed",
            zone_id=item["zone_id"],
        )
        events.append(event)

    return events


def ensure_events_loaded() -> List[EventItem]:
    """Ensure in-memory store has events populated (lazy initialisation)."""
    current = store.get_events()
    if not current:
        seed = generate_seed_events()
        store.set_events(seed)
        return seed
    return current


def fetch_and_store_events() -> Dict[str, Any]:
    """Pipeline to refresh events and test weather, returning status report."""
    errors: List[str] = []
    sources_used = ["seed"]

    # 1. Regenerate seed events with current relative timestamps
    fresh_events = generate_seed_events()
    store.set_events(fresh_events)

    # 2. Touch weather for each zone to warm cache and verify network
    weather_ok = False
    for zone in ZONE_BY_ID.values():
        _, err = fetch_weather_open_meteo(zone.id)
        if err:
            errors.append(err)
        else:
            weather_ok = True

    if weather_ok:
        sources_used.append("open-meteo")

    return {
        "refreshed": True,
        "count": len(fresh_events),
        "sources_used": sources_used,
        "errors": errors,
    }
