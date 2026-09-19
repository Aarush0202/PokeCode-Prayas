"""Named public venues held out of synthetic ML training.
Forecast-only (no physical IoT sensors installed).
"""
from typing import List
from app.schemas.shared import VenueCategory, Zone

NAMED_PLACES: List[Zone] = [
    Zone(
        id="ch01",
        name="Chandni Chowk",
        capacity=5000,
        area_sqm=6000.0,
        lat=28.6506,
        lon=77.2303,
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    Zone(
        id="ch02",
        name="Connaught Place Inner Circle",
        capacity=8000,
        area_sqm=10000.0,
        lat=28.6315,
        lon=77.2167,
        category=VenueCategory.PUBLIC_SQUARE,
        city="Delhi",
    ),
    Zone(
        id="ch03",
        name="Lajpat Nagar Central Market",
        capacity=4000,
        area_sqm=4500.0,
        lat=28.5700,
        lon=77.2400,
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    Zone(
        id="gg01",
        name="Cyber Hub Amphitheatre",
        capacity=2500,
        area_sqm=3000.0,
        lat=28.4950,
        lon=77.0890,
        category=VenueCategory.CAMPUS_GROUND,
        city="Gurugram",
    ),
    Zone(
        id="gg02",
        name="Leisure Valley Park Ground",
        capacity=12000,
        area_sqm=15000.0,
        lat=28.4680,
        lon=77.0650,
        category=VenueCategory.PUBLIC_SQUARE,
        city="Gurugram",
    ),
    Zone(
        id="gg03",
        name="Sheetla Mata Mandir Complex",
        capacity=7000,
        area_sqm=8000.0,
        lat=28.4720,
        lon=77.0250,
        category=VenueCategory.RELIGIOUS_SITE,
        city="Gurugram",
    ),
]
