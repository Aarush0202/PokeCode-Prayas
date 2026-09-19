"""CrowdGuard Event Planner Parser Service.
Extracts structured event planning parameters from untrusted free-text descriptions.
Supports Anthropic Claude LLM extraction with a 100% deterministic rule-based fallback.
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.schemas.shared import ZONES
from app.data.named_places import NAMED_PLACES

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")

# Combine all known zones and named places
ALL_VENUES = {z.id: z for z in list(ZONES) + list(NAMED_PLACES)}

VALID_EVENT_TYPES = {
    "concert",
    "sports_match",
    "rally",
    "festival",
    "religious_gathering",
    "other",
}

VALID_DRAW_LEVELS = {"normal", "high", "very_high"}


class PlannerParseFields(BaseModel):
    zone_id: Optional[str] = None
    start_time: Optional[str] = None
    duration_hours: Optional[float] = None
    event_type: Optional[str] = None
    expected_attendance: Optional[int] = None
    draw_level: Optional[str] = None


class PlannerParseResponse(BaseModel):
    fields: PlannerParseFields
    missing: List[str]
    matched_by: str  # "llm" | "rules"
    note: str = "Review and confirm every field before assessing."


def _extract_attendance(text: str) -> Optional[int]:
    """Extract expected attendance numbers like 5000, 5,000, 5k, 5 thousand."""
    # Pattern 1: e.g. "5k" or "5.5k"
    k_match = re.search(r"\b(\d+(?:\.\d+)?)\s*k\b", text, re.IGNORECASE)
    if k_match:
        return int(float(k_match.group(1)) * 1000)

    # Pattern 2: e.g. "5 thousand" or "5 lakh"
    th_match = re.search(r"\b(\d+)\s*(?:thousand|lakh|lac)\b", text, re.IGNORECASE)
    if th_match:
        multiplier = 100000 if "lakh" in th_match.group(0).lower() or "lac" in th_match.group(0).lower() else 1000
        return int(th_match.group(1)) * multiplier

    # Pattern 3: count followed by people/attendees/persons/crowd/visitors/devotees
    match = re.search(r"\b(\d{1,3}(?:,\d{3})*|\d{2,7})\s*(?:people|attendees|persons|crowd|visitors|devotees)\b", text, re.IGNORECASE)
    if match:
        return int(match.group(1).replace(",", ""))

    # Pattern 4: count preceded by about/around/approx/expected
    match = re.search(r"\b(?:about|around|approx|approximately|expected)\s+(\d{1,3}(?:,\d{3})*|\d{2,7})\b", text, re.IGNORECASE)
    if match:
        return int(match.group(1).replace(",", ""))

    return None


def _extract_zone_id(text: str) -> Optional[str]:
    """Fuzzy/keyword match venue names against known zones and named places."""
    lowered = text.lower()

    # Prioritized explicit name lookups
    aliases = [
        ("sector 17 central plaza", "ch04"),
        ("sector 17 plaza", "ch04"),
        ("parade ground", "ch04"),
        ("sector 17 market", "ch01"),
        ("sector 17", "ch01"),  # Default for Sector 17
        ("isbt 43", "ch02"),
        ("isbt sector 43", "ch02"),
        ("bus terminal 43", "ch02"),
        ("elante", "ch03"),
        ("sukhna lake", "ch05"),
        ("sukhna", "ch05"),
        ("lake", "ch05"),
        ("panjab university", "ch06"),
        ("student centre", "ch06"),
        ("stuc", "ch06"),
        ("phase 3b2", "mo01"),
        ("3b2", "mo01"),
        ("phase 7", "mo02"),
        ("pca stadium", "mo03"),
        ("pca", "mo03"),
        ("cricket stadium", "mo03"),
        ("phase 6", "mo04"),
        ("nada sahib", "rl01"),
        ("gurudwara nada", "rl01"),
        ("iskcon", "rl02"),
        ("sector 8 food", "fs01"),
        ("sector 8", "fs01"),
        ("phase 5 khau gali", "fs02"),
        ("khau gali", "fs02"),
        ("phase 5", "fs02"),
        # Core 4 live zones
        ("main gate plaza", "z1"),
        ("main gate", "z1"),
        ("metro concourse", "z2"),
        ("metro station", "z2"),
        ("market street", "z3"),
        ("food court", "z4"),
    ]

    for alias, zid in aliases:
        if alias in lowered:
            return zid

    # Check direct zone ID mentions e.g. "zone z1" or "ch01"
    for zid in ALL_VENUES:
        if re.search(rf"\b{zid}\b", lowered):
            return zid

    return None


def _extract_event_type(text: str) -> Optional[str]:
    """Identify event category from keywords."""
    lowered = text.lower()
    if any(w in lowered for w in ["concert", "singer", "music", "band", "performance", "dj", "gig"]):
        return "concert"
    if any(w in lowered for w in ["cricket", "match", "tournament", "football", "derby", "sports"]):
        return "sports_match"
    if any(w in lowered for w in ["rally", "protest", "march", "campaign", "procession", "political"]):
        return "rally"
    if any(w in lowered for w in ["festival", "mela", "carnival", "fair", "celebration", "utsav"]):
        return "festival"
    if any(w in lowered for w in ["puja", "kirtan", "prayer", "darshan", "satsang", "gurpurab", "temple", "gurudwara"]):
        return "religious_gathering"
    return "other" if ("event" in lowered or "gathering" in lowered) else None


def _extract_draw_level(text: str) -> str:
    """Identify crowd draw level from presence of VIPs or celebrity modifiers."""
    lowered = text.lower()
    if any(w in lowered for w in ["superstar", "mega", "massive", "international"]):
        return "very_high"
    if any(w in lowered for w in ["vip", "actor", "actress", "celebrity", "singer", "bollywood", "famous", "star"]):
        return "high"
    return "normal"


def _extract_duration(text: str) -> Optional[float]:
    """Extract event duration in hours."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours|hrs|hour|hr)\b", text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def _extract_start_time(text: str, ref_dt: Optional[datetime] = None) -> Optional[str]:
    """Parse relative dates and times into IST ISO format."""
    now_ist = ref_dt.astimezone(IST) if ref_dt else datetime.now(IST)
    lowered = text.lower()

    # Time of day extraction: only match if followed by am/pm, or has colon like 19:00, or preceded by 'at'
    hour = 18  # default evening
    minute = 0
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lowered)
    if not time_match:
        time_match = re.search(r"\b(?:at\s+)?(\d{1,2}):(\d{2})\b", lowered)
    if not time_match:
        time_match = re.search(r"\bat\s+(\d{1,2})\s*(?:o'clock)?\b", lowered)

    if time_match:
        h = int(time_match.group(1))
        m = int(time_match.group(2)) if time_match.group(2) else 0
        meridiem = time_match.group(3) if len(time_match.groups()) >= 3 else None
        if meridiem:
            if meridiem == "pm" and h < 12:
                h += 12
            elif meridiem == "am" and h == 12:
                h = 0
            hour, minute = h, m
        elif 0 <= h <= 23:
            hour, minute = h, m

    # Day of week parsing: e.g. "next saturday", "this sunday", "tomorrow"
    target_date = now_ist.date()
    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    if "tomorrow" in lowered:
        target_date = target_date + timedelta(days=1)
    else:
        for idx, day_name in enumerate(days_of_week):
            if day_name in lowered:
                current_weekday = now_ist.weekday()
                days_ahead = (idx - current_weekday) % 7
                if "next " + day_name in lowered:
                    days_ahead = days_ahead + 7 if days_ahead < 7 else days_ahead
                elif days_ahead == 0 and (now_ist.hour > hour):
                    days_ahead = 7
                target_date = target_date + timedelta(days=days_ahead)
                break

    parsed_dt = datetime(
        year=target_date.year,
        month=target_date.month,
        day=target_date.day,
        hour=hour,
        minute=minute,
        second=0,
        tzinfo=IST,
    )
    return parsed_dt.isoformat()


def parse_event_with_rules(text: str, ref_dt: Optional[datetime] = None) -> PlannerParseResponse:
    """Deterministic, zero-dependency rules-based parser."""
    zone_id = _extract_zone_id(text)
    event_type = _extract_event_type(text)
    attendance = _extract_attendance(text)
    draw_level = _extract_draw_level(text)
    duration = _extract_duration(text)
    start_time = _extract_start_time(text, ref_dt)

    fields = PlannerParseFields(
        zone_id=zone_id,
        start_time=start_time,
        duration_hours=duration,
        event_type=event_type,
        expected_attendance=attendance,
        draw_level=draw_level,
    )

    missing = []
    if fields.zone_id is None:
        missing.append("zone_id")
    if fields.start_time is None:
        missing.append("start_time")
    if fields.duration_hours is None:
        missing.append("duration_hours")
    if fields.event_type is None:
        missing.append("event_type")
    if fields.expected_attendance is None:
        missing.append("expected_attendance")
    if fields.draw_level is None:
        missing.append("draw_level")

    return PlannerParseResponse(
        fields=fields,
        missing=missing,
        matched_by="rules",
        note="Review and confirm every field before assessing.",
    )


def parse_event_with_llm(text: str, ref_dt: Optional[datetime] = None) -> Optional[PlannerParseResponse]:
    """Call Anthropic API if key is present; returns None on failure to trigger fallback."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic  # type: ignore

        model_name = os.getenv("PLANNER_PARSER_MODEL", "claude-haiku-4-5-20251001")
        client = anthropic.Anthropic(api_key=api_key, timeout=8.0)

        now_str = (ref_dt or datetime.now(IST)).strftime("%Y-%m-%d %H:%M:%S IST")
        venues_list = [{"id": z.id, "name": z.name, "city": getattr(z, "city", "Chandigarh")} for z in ALL_VENUES.values()]

        prompt = f"""You are a municipal crowd safety event parser. Extract event parameters from the user's free text.
Reference current date/time: {now_str}. All times must be in IST (+05:30).

Known valid venue IDs and names:
{json.dumps(venues_list)}

Return ONLY valid JSON with keys:
{{
  "zone_id": "<valid id from list above or null if unknown/unmatched>",
  "start_time": "<ISO-8601 string with +05:30 or null>",
  "duration_hours": <float or null>,
  "event_type": "<concert|sports_match|rally|festival|religious_gathering|other or null>",
  "expected_attendance": <integer or null>,
  "draw_level": "<normal|high|very_high>"
}}
Do NOT invent places. If place is not clearly one of the known venues, set zone_id to null.
Text: "{text}"
"""
        response = client.messages.create(
            model=model_name,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text
        # Clean any markdown code blocks
        clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        raw_data = json.loads(clean_json)

        # Validate zone_id
        zid = raw_data.get("zone_id")
        if zid not in ALL_VENUES:
            raw_data["zone_id"] = None

        fields = PlannerParseFields(**raw_data)
        missing = [k for k, v in fields.model_dump().items() if v is None]

        return PlannerParseResponse(
            fields=fields,
            missing=missing,
            matched_by="llm",
            note="Review and confirm every field before assessing.",
        )
    except Exception as exc:
        logger.warning(f"Anthropic LLM parser call failed ({exc}). Falling back to rules.")
        return None


def parse_event_text(text: str, ref_dt: Optional[datetime] = None) -> PlannerParseResponse:
    """Primary entrypoint: attempts LLM parser then falls back seamlessly to rules."""
    if len(text) > 1000:
        raise ValueError("Input text exceeds maximum allowed length of 1000 characters.")

    llm_result = parse_event_with_llm(text, ref_dt=ref_dt)
    if llm_result is not None:
        return llm_result

    return parse_event_with_rules(text, ref_dt=ref_dt)
