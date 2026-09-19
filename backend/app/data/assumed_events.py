"""CrowdGuard Assumed Events (IST-anchored illustrative events).

Per CrowdGuard Person B contract:
- Every event has source="assumed", is_illustrative=True.
- Every title begins with '[Illustrative]'.
- Every id is prefixed with 'assume-'.
- Anchored to real calendar times in Asia/Kolkata (IST), e.g. next Saturday 18:00 IST.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from app.schemas.shared import EventItem

IST = ZoneInfo("Asia/Kolkata")


def next_weekday_at(weekday: int, hour: int, minute: int = 0, tz: str = "Asia/Kolkata") -> datetime:
    """Return the next occurrence of a specific weekday and time in the specified timezone.
    
    weekday: 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday.
    If the specified day/hour is later today in that timezone, returns today at that time.
    Otherwise advances to the next week.
    """
    zone = ZoneInfo(tz)
    now = datetime.now(zone)
    days_ahead = (weekday - now.weekday()) % 7
    if days_ahead == 0 and (now.hour > hour or (now.hour == hour and now.minute >= minute)):
        days_ahead = 7
    target_date = (now + timedelta(days=days_ahead)).date()
    return datetime(target_date.year, target_date.month, target_date.day, hour, minute, tzinfo=zone)


def get_assumed_events() -> List[EventItem]:
    """Return canonical illustrative events anchored to upcoming real calendar IST times."""
    # Build upcoming IST target datetimes
    sat_18 = next_weekday_at(weekday=5, hour=18, minute=0)   # Next Saturday 18:00 IST
    fri_17 = next_weekday_at(weekday=4, hour=17, minute=0)   # Next Friday 17:00 IST
    sun_18 = next_weekday_at(weekday=6, hour=18, minute=0)   # Next Sunday 18:00 IST
    wed_11 = next_weekday_at(weekday=2, hour=11, minute=0)   # Next Wednesday 11:00 IST
    sun_1830 = next_weekday_at(weekday=6, hour=18, minute=30)# Next Sunday 18:30 IST
    sat_20 = next_weekday_at(weekday=5, hour=20, minute=0)   # Next Saturday 20:00 IST

    defs: List[Dict[str, Any]] = [
        # ch01: Chandni Chowk (Market)
        {
            "id": "assume-ch01-market",
            "title": "[Illustrative] Heritage Night Bazaar & Festive Shopping Walk",
            "start_time": sat_18,
            "duration_h": 4,
            "venue": "Chandni Chowk Pedestrian Promenade",
            "category": "market",
            "expected_attendance": 2200,
            "zone_id": "ch01",
            "lat": 28.6562,
            "lon": 77.2309,
        },
        # ch02: Rajiv Chowk (Transit Hub)
        {
            "id": "assume-ch02-transit",
            "title": "[Illustrative] Friday Evening Metro Transit Inflow Surge",
            "start_time": fri_17,
            "duration_h": 3,
            "venue": "Rajiv Chowk Metro Concourse Interchange",
            "category": "transit_hub",
            "expected_attendance": 2800,
            "zone_id": "ch02",
            "lat": 28.6328,
            "lon": 77.2195,
        },
        # ch04: CP Central Park (Public Square)
        {
            "id": "assume-ch04-square",
            "title": "[Illustrative] Sunday Evening Live Cultural Concert & Light Show",
            "start_time": sun_18,
            "duration_h": 3,
            "venue": "Connaught Place Central Park Amphitheatre",
            "category": "public_square",
            "expected_attendance": 1800,
            "zone_id": "ch04",
            "lat": 28.6315,
            "lon": 77.2167,
        },
        # mo03: DU Arts Faculty Ground (Campus Ground)
        {
            "id": "assume-mo03-campus",
            "title": "[Illustrative] University Inter-College Tech Symposium & Hackathon",
            "start_time": wed_11,
            "duration_h": 5,
            "venue": "North Campus Arts Faculty Lawns",
            "category": "campus_ground",
            "expected_attendance": 1400,
            "zone_id": "mo03",
            "lat": 28.6892,
            "lon": 77.2104,
        },
        # rl01: Akshardham Temple (Religious Site)
        {
            "id": "assume-rl01-temple",
            "title": "[Illustrative] Grand Weekend Aarti & Pilgrim Gathering",
            "start_time": sun_1830,
            "duration_h": 2,
            "venue": "Akshardham Temple Plaza & Exhibition Grounds",
            "category": "religious_site",
            "expected_attendance": 3200,
            "zone_id": "rl01",
            "lat": 28.6127,
            "lon": 77.2773,
        },
        # fs01: Matia Mahal / Jama Masjid (Food Street)
        {
            "id": "assume-fs01-food",
            "title": "[Illustrative] Weekend Gourmet Street Food Heritage Walk",
            "start_time": sat_20,
            "duration_h": 4,
            "venue": "Matia Mahal Food Lane Central",
            "category": "food_street",
            "expected_attendance": 1100,
            "zone_id": "fs01",
            "lat": 28.6507,
            "lon": 77.2334,
        },
        # z3: Market Street Demo Event (Labelled Illustrative per Honesty Rule)
        {
            "id": "assume-z3-cricket",
            "title": "[Illustrative] IPL Live Cricket Mega Screening & Street Fest",
            "start_time": sat_18,
            "duration_h": 4,
            "venue": "Market Street Arena & Big Screen Plaza",
            "category": "market",
            "expected_attendance": 1600,
            "zone_id": "z3",
            "lat": 28.4570,
            "lon": 77.0301,
        },
    ]

    events: List[EventItem] = []
    for d in defs:
        # Convert timezone-aware IST datetimes to UTC for shared contract compliance
        start_utc = d["start_time"].astimezone(timezone.utc)
        end_utc = (d["start_time"] + timedelta(hours=d["duration_h"])).astimezone(timezone.utc)

        ev = EventItem(
            id=d["id"],
            title=d["title"],
            start_time=start_utc,
            end_time=end_utc,
            venue=d["venue"],
            lat=d["lat"],
            lon=d["lon"],
            category=d["category"],
            expected_attendance=d["expected_attendance"],
            source="assumed",
            zone_id=d["zone_id"],
            is_illustrative=True,
        )
        events.append(ev)

    return events
