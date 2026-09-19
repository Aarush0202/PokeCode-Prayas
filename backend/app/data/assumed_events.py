"""CrowdGuard Assumed / Illustrative Events.

Provides illustrative synthetic events anchored to real calendar times in IST (Asia/Kolkata).
Each event has:
- source = "assumed"
- is_illustrative = True
- title prefixed with "[Illustrative]"
- id prefixed with "assume-"
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from app.schemas.shared import EventItem

IST_TZ = ZoneInfo("Asia/Kolkata")


def next_weekday_at(
    weekday: int,
    hour: int,
    tz: str = "Asia/Kolkata",
    reference_time: Optional[datetime] = None,
) -> datetime:
    """Return the next upcoming datetime on the specified weekday and hour in the given timezone.

    Parameters:
    - weekday: 0 = Monday, 1 = Tuesday, ..., 5 = Saturday, 6 = Sunday.
    - hour: 0 to 23 in the local timezone.
    - tz: timezone string (default "Asia/Kolkata").
    - reference_time: baseline datetime (defaults to current UTC time).
    """
    zone_tz = ZoneInfo(tz)
    ref = reference_time or datetime.now(timezone.utc)
    ref_local = ref.astimezone(zone_tz)

    days_ahead = (weekday - ref_local.weekday()) % 7
    if days_ahead == 0 and ref_local.hour >= hour:
        # If today is that weekday but the hour has already passed, schedule for next week
        days_ahead = 7

    target_date = ref_local.date() + timedelta(days=days_ahead)
    target_dt = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        hour,
        0,
        0,
        tzinfo=zone_tz,
    )
    return target_dt


def get_assumed_events(reference_time: Optional[datetime] = None) -> List[EventItem]:
    """Generate calendar-anchored illustrative assumed events across all venue categories."""
    events = [
        # 1. Market: Chandni Chowk Saturday Evening Bazaar (ch01)
        EventItem(
            id="assume-market-ch01",
            title="[Illustrative] Chandni Chowk Heritage Night Bazaar",
            start_time=next_weekday_at(5, 18, reference_time=reference_time),  # Saturday 18:00 IST
            end_time=next_weekday_at(5, 18, reference_time=reference_time) + timedelta(hours=4),
            venue="Chandni Chowk Main Promenade",
            category="market",
            expected_attendance=3500,
            zone_id="ch01",
            source="assumed",
            is_illustrative=True,
        ),
        # 2. Transit Hub: Metro Interchange Monday Commuter Inflow Rush (z2)
        EventItem(
            id="assume-transit-z02",
            title="[Illustrative] Metro Commuter Rush Surge",
            start_time=next_weekday_at(0, 8, reference_time=reference_time),  # Monday 08:00 IST
            end_time=next_weekday_at(0, 8, reference_time=reference_time) + timedelta(hours=3),
            venue="Metro Platform Gate A & Central Interchange",
            category="transit",
            expected_attendance=650,
            zone_id="z2",
            source="assumed",
            is_illustrative=True,
        ),
        # 3. Public Square: Connaught Place Sunday Evening Cultural Gathering (ch02)
        EventItem(
            id="assume-public-square-ch02",
            title="[Illustrative] Connaught Place Weekend Cultural Gathering",
            start_time=next_weekday_at(6, 17, reference_time=reference_time),  # Sunday 17:00 IST
            end_time=next_weekday_at(6, 17, reference_time=reference_time) + timedelta(hours=4),
            venue="Central Park Inner Circle",
            category="festival",
            expected_attendance=5000,
            zone_id="ch02",
            source="assumed",
            is_illustrative=True,
        ),
        # 4. Campus Ground: Cyber Hub Amphitheatre Match Day & Concert (gg01)
        EventItem(
            id="assume-campus-gg01",
            title="[Illustrative] Cyber Hub Live Concert & College Finals",
            start_time=next_weekday_at(5, 19, reference_time=reference_time),  # Saturday 19:00 IST
            end_time=next_weekday_at(5, 19, reference_time=reference_time) + timedelta(hours=4),
            venue="Cyber Hub Amphitheatre Main Stage",
            category="concert",
            expected_attendance=2200,
            zone_id="gg01",
            source="assumed",
            is_illustrative=True,
        ),
        # 5. Religious Site: Sheetla Mata Mandir Grand Aarti Festival (gg03)
        EventItem(
            id="assume-religious-gg03",
            title="[Illustrative] Sheetla Mata Mandir Grand Aarti Festival",
            start_time=next_weekday_at(1, 18, reference_time=reference_time),  # Tuesday 18:00 IST
            end_time=next_weekday_at(1, 18, reference_time=reference_time) + timedelta(hours=3),
            venue="Sheetla Mata Mandir Courtyard Complex",
            category="religious_gathering",
            expected_attendance=4500,
            zone_id="gg03",
            source="assumed",
            is_illustrative=True,
        ),
        # 6. Food Street: Central Food Court Friday Dinner Fest (z4)
        EventItem(
            id="assume-food-street-z04",
            title="[Illustrative] Weekend Street Food Carnival",
            start_time=next_weekday_at(4, 20, reference_time=reference_time),  # Friday 20:00 IST
            end_time=next_weekday_at(4, 20, reference_time=reference_time) + timedelta(hours=3),
            venue="Central Food Court Courtyard",
            category="food",
            expected_attendance=320,
            zone_id="z4",
            source="assumed",
            is_illustrative=True,
        ),
        # Reserved ID coverage for mock/benchmark evaluation: ch04, mo03, rl01, fs01
        EventItem(
            id="assume-public-square-ch04",
            title="[Illustrative] Civic Plaza Community Gathering",
            start_time=next_weekday_at(6, 16, reference_time=reference_time),  # Sunday 16:00 IST
            end_time=next_weekday_at(6, 16, reference_time=reference_time) + timedelta(hours=4),
            venue="Civic Plaza Open Grounds",
            category="festival",
            expected_attendance=2800,
            zone_id="ch04",
            source="assumed",
            is_illustrative=True,
        ),
        EventItem(
            id="assume-campus-mo03",
            title="[Illustrative] Inter-Collegiate Match Day Championship",
            start_time=next_weekday_at(5, 15, reference_time=reference_time),  # Saturday 15:00 IST
            end_time=next_weekday_at(5, 15, reference_time=reference_time) + timedelta(hours=3),
            venue="University Sports Stadium Ground",
            category="sports",
            expected_attendance=3800,
            zone_id="mo03",
            source="assumed",
            is_illustrative=True,
        ),
        EventItem(
            id="assume-religious-rl01",
            title="[Illustrative] Temple Devotional Festival Gathering",
            start_time=next_weekday_at(1, 19, reference_time=reference_time),  # Tuesday 19:00 IST
            end_time=next_weekday_at(1, 19, reference_time=reference_time) + timedelta(hours=3),
            venue="Heritage Temple Plaza",
            category="religious_gathering",
            expected_attendance=3200,
            zone_id="rl01",
            source="assumed",
            is_illustrative=True,
        ),
        EventItem(
            id="assume-food-fs01",
            title="[Illustrative] Night Food Street Bazaar",
            start_time=next_weekday_at(4, 21, reference_time=reference_time),  # Friday 21:00 IST
            end_time=next_weekday_at(4, 21, reference_time=reference_time) + timedelta(hours=3),
            venue="Heritage Food Street Lane",
            category="food",
            expected_attendance=600,
            zone_id="fs01",
            source="assumed",
            is_illustrative=True,
        ),
    ]
    return events
