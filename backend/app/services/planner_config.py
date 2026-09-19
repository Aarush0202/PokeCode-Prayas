"""Configuration and heuristics for the Event Planner assessment engine.
All constants represent crowd-safety guidelines and domain heuristics.
"""
from typing import Dict, List, NamedTuple
from app.schemas.shared import VenueCategory


class EventProfile(NamedTuple):
    pre_h: float  # Arrival ramp hours before event start
    post_h: float  # Dispersal decay hours after event end
    on_site_fraction: float  # Peak fraction of attendees simultaneously on site


EVENT_PROFILES: Dict[str, EventProfile] = {
    "concert": EventProfile(pre_h=2.0, post_h=1.0, on_site_fraction=0.95),
    "sports_match": EventProfile(pre_h=2.5, post_h=1.0, on_site_fraction=0.95),
    "rally": EventProfile(pre_h=1.5, post_h=1.0, on_site_fraction=0.90),
    "festival": EventProfile(pre_h=1.0, post_h=1.5, on_site_fraction=0.70),
    "religious_gathering": EventProfile(pre_h=1.0, post_h=1.0, on_site_fraction=0.80),
    "other": EventProfile(pre_h=1.0, post_h=1.0, on_site_fraction=0.85),
}

# Celebrity pull / publicity multiplier assumption
DRAW_MULTIPLIER: Dict[str, float] = {
    "normal": 1.0,
    "high": 1.25,
    "very_high": 1.5,
}

# Safety thresholds (occupancy ratio and crowd density)
RATIO_COMFORTABLE: float = 0.70  # Below this, event is comfortably feasible
RATIO_LIMIT: float = 1.00  # Venue design capacity limit
OVERSHOOT_TOLERANCE: float = 1.15  # Peak ratio tolerance in +30% scenario before downgrading
DENSITY_WARN: float = 2.0  # Persons per square meter warning threshold (Ithaca/Fruin standard)

# Suitable venue categories per event type for alternative recommendations
ALLOWED_CATEGORIES: Dict[str, List[VenueCategory]] = {
    "concert": [VenueCategory.CAMPUS_GROUND, VenueCategory.PUBLIC_SQUARE, VenueCategory.MARKET],
    "sports_match": [VenueCategory.CAMPUS_GROUND, VenueCategory.PUBLIC_SQUARE],
    "rally": [VenueCategory.PUBLIC_SQUARE, VenueCategory.CAMPUS_GROUND],
    "festival": [VenueCategory.PUBLIC_SQUARE, VenueCategory.MARKET, VenueCategory.FOOD_STREET],
    "religious_gathering": [VenueCategory.RELIGIOUS_SITE, VenueCategory.PUBLIC_SQUARE],
    "other": [
        VenueCategory.PUBLIC_SQUARE,
        VenueCategory.CAMPUS_GROUND,
        VenueCategory.MARKET,
        VenueCategory.FOOD_STREET,
        VenueCategory.TRANSIT_HUB,
        VenueCategory.RELIGIOUS_SITE,
    ],
}

DEFAULT_ASSUMPTIONS: List[str] = [
    "Venue capacity and usable area are administrative estimates, not field-surveyed.",
    "Baseline footfall profile is derived from statistical synthetic time-series modeling.",
    "Draw multiplier reflects assumed publicity pull rather than ticketed sales data.",
    "Arrival and egress curves assume normal pedestrian distribution without sudden mass transit surges.",
    "Crowd density safety thresholds follow standard Fruin Level-of-Service heuristics.",
]

DISCLAIMER_TEXT: str = (
    "Decision support only. Not a safety approval; real events need police, fire and local-authority clearance."
)
