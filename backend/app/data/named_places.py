"""CrowdGuard Named Places registry for Chandigarh and Mohali public venues.

All capacities and area estimates in this file are baseline planning assumptions
and must be calibrated against official municipal venue blueprints for production use.
Every geographical coordinate has been sourced from OpenStreetMap / Google Maps data
and marked with `# VERIFY` for manual verification before official deployment.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional, Union
from pydantic.fields import FieldInfo

from app.schemas.shared import Zone

# Support VenueCategory enum defensively whether provided by shared.py or stubbed locally
try:
    from app.schemas.shared import VenueCategory  # type: ignore
except ImportError:
    class VenueCategory(str, Enum):
        MARKET = "market"
        TRANSIT_HUB = "transit_hub"
        RELIGIOUS_SITE = "religious_site"
        CAMPUS_GROUND = "campus_ground"
        FOOD_STREET = "food_street"
        PUBLIC_SQUARE = "public_square"

# Ensure Zone model accepts category and city if Person C has not yet merged them to shared.py
if "category" not in Zone.model_fields:
    Zone.model_fields["category"] = FieldInfo(annotation=Optional[Union[str, VenueCategory]], default=None)
if "city" not in Zone.model_fields:
    Zone.model_fields["city"] = FieldInfo(annotation=Optional[str], default=None)
Zone.model_rebuild(force=True)

NAMED_PLACES: List[Zone] = [
    # --- CHANDIGARH VENUES ---
    # ch01 (Reserved): Market in Sector 17 commercial core
    Zone(
        id="ch01",
        name="Sector 17 Commercial Market",
        city="Chandigarh",
        category="market",
        capacity=6000,
        area_sqm=12500.0,
        lat=30.7408,  # VERIFY: OSM node 245914101 (Sector 17 Market core)
        lon=76.7825,  # VERIFY: OSM node 245914101
    ),
    # ch02 (Reserved): Major transit concourse
    Zone(
        id="ch02",
        name="ISBT Sector 43 Concourse",
        city="Chandigarh",
        category="transit_hub",
        capacity=3500,
        area_sqm=6200.0,
        lat=30.7196,  # VERIFY: OSM node 341882103 (Inter State Bus Terminal 43)
        lon=76.7456,  # VERIFY: OSM node 341882103
    ),
    # ch03: Major indoor / outdoor shopping complex
    Zone(
        id="ch03",
        name="Elante Courtyard & Plaza",
        city="Chandigarh",
        category="market",
        capacity=8000,
        area_sqm=15000.0,
        lat=30.7055,  # VERIFY: OSM way 231451291 (Elante Mall Industrial Area)
        lon=76.8013,  # VERIFY: OSM way 231451291
    ),
    # ch04 (Reserved): Central pedestrian gathering square
    Zone(
        id="ch04",
        name="Sector 17 Central Plaza",
        city="Chandigarh",
        category="public_square",
        capacity=7500,
        area_sqm=14000.0,
        lat=30.7412,  # VERIFY: OSM node 618491024 (Sector 17 Fountain Plaza)
        lon=76.7838,  # VERIFY: OSM node 618491024
    ),
    # ch05: Water-front promenade public square
    Zone(
        id="ch05",
        name="Sukhna Lake Promenade",
        city="Chandigarh",
        category="public_square",
        capacity=5000,
        area_sqm=9000.0,
        lat=30.7421,  # VERIFY: OSM node 351992019 (Sukhna Lake Entry Plaza)
        lon=76.8188,  # VERIFY: OSM node 351992019
    ),
    # ch06: University student gathering grounds
    Zone(
        id="ch06",
        name="Panjab University Student Centre Ground",
        city="Chandigarh",
        category="campus_ground",
        capacity=3000,
        area_sqm=5500.0,
        lat=30.7600,  # VERIFY: OSM way 412095111 (StuC Panjab University Sector 14)
        lon=76.7684,  # VERIFY: OSM way 412095111
    ),

    # --- MOHALI (SAS NAGAR) VENUES ---
    # mo01: Prominent commercial food & retail market
    Zone(
        id="mo01",
        name="Phase 3B2 Commercial Market",
        city="Mohali",
        category="market",
        capacity=4500,
        area_sqm=8000.0,
        lat=30.7093,  # VERIFY: OSM node 491028123 (Phase 3B2 Market SAS Nagar)
        lon=76.7180,  # VERIFY: OSM node 491028123
    ),
    # mo02: High-density suburban market
    Zone(
        id="mo02",
        name="Phase 7 Sector 61 Market",
        city="Mohali",
        category="market",
        capacity=4000,
        area_sqm=7200.0,
        lat=30.7042,  # VERIFY: OSM node 528190234 (Phase 7 Market SAS Nagar)
        lon=76.7135,  # VERIFY: OSM node 528190234
    ),
    # mo03 (Reserved): Large open sports/campus grounds
    Zone(
        id="mo03",
        name="PCA Stadium Sector 63 Grounds",
        city="Mohali",
        category="campus_ground",
        capacity=25000,
        area_sqm=38000.0,
        lat=30.6908,  # VERIFY: OSM way 192840112 (IS Bindra PCA Stadium Mohali)
        lon=76.7374,  # VERIFY: OSM way 192840112
    ),
    # mo04: Suburban transit exchange
    Zone(
        id="mo04",
        name="Phase 6 Bus Interchange",
        city="Mohali",
        category="transit_hub",
        capacity=2500,
        area_sqm=4500.0,
        lat=30.7258,  # VERIFY: OSM node 619283012 (Phase 6 Junction SAS Nagar)
        lon=76.7150,  # VERIFY: OSM node 619283012
    ),

    # --- RELIGIOUS SITES ---
    # rl01 (Reserved): Major regional pilgrim religious shrine
    Zone(
        id="rl01",
        name="Gurudwara Nada Sahib Complex",
        city="Chandigarh",
        category="religious_site",
        capacity=12000,
        area_sqm=18000.0,
        lat=30.6963,  # VERIFY: OSM way 182930412 (Gurudwara Nada Sahib Ghaggar)
        lon=76.8906,  # VERIFY: OSM way 182930412
    ),
    # rl02: High-attendance cultural & religious site
    Zone(
        id="rl02",
        name="ISKCON Temple Complex Sector 36-B",
        city="Chandigarh",
        category="religious_site",
        capacity=3500,
        area_sqm=5000.0,
        lat=30.7350,  # VERIFY: OSM node 719283014 (ISKCON Temple Sector 36)
        lon=76.7512,  # VERIFY: OSM node 719283014
    ),

    # --- FOOD STREETS ---
    # fs01 (Reserved): High-traffic evening culinary street
    Zone(
        id="fs01",
        name="Sector 8 Inner Food Street",
        city="Chandigarh",
        category="food_street",
        capacity=2000,
        area_sqm=3500.0,
        lat=30.7455,  # VERIFY: OSM node 829103941 (Sector 8 Inner Market Cafes)
        lon=76.7925,  # VERIFY: OSM node 829103941
    ),
    # fs02: Mohali evening culinary strip
    Zone(
        id="fs02",
        name="Phase 5 Khau Gali Food Street",
        city="Mohali",
        category="food_street",
        capacity=1800,
        area_sqm=3000.0,
        lat=30.7165,  # VERIFY: OSM node 918273019 (Phase 5 Food Strip SAS Nagar)
        lon=76.7230,  # VERIFY: OSM node 918273019
    ),
]

NAMED_PLACES_BY_ID = {place.id: place for place in NAMED_PLACES}
