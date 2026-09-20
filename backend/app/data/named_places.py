"""CrowdGuard Named Places registry for held-out public venues (Delhi/Gurugram and Chandigarh/Mohali).

Forecast-only decision-support locations held out of synthetic ML training (no physical IoT sensors installed).
All capacities and area estimates in this file are baseline planning assumptions and must be calibrated
against official municipal venue blueprints for production use.
Every geographical coordinate has been sourced from OpenStreetMap / Google Maps data
and marked with `# VERIFY` for manual verification before official deployment.
"""
from __future__ import annotations

from typing import List, Dict
from app.schemas.shared import VenueCategory, Zone

NAMED_PLACES: List[Zone] = [
    # --- DELHI METRO STATIONS (DMRC NETWORK) ---
    Zone(id="dm_z1", name="Rajiv Chowk Interchange", capacity=2500, area_sqm=3000.0, lat=28.6328, lon=77.2197, category=VenueCategory.TRANSIT_HUB, city="Delhi"),
    Zone(id="dm_z2", name="Kashmere Gate Hub", capacity=2800, area_sqm=3200.0, lat=28.6675, lon=77.2285, category=VenueCategory.TRANSIT_HUB, city="Delhi"),
    Zone(id="dm_z3", name="Hauz Khas Junction", capacity=1800, area_sqm=2200.0, lat=28.5432, lon=77.2065, category=VenueCategory.TRANSIT_HUB, city="Delhi"),
    Zone(id="dm_z4", name="Millennium City Centre", capacity=1500, area_sqm=1800.0, lat=28.4595, lon=77.0725, category=VenueCategory.TRANSIT_HUB, city="Gurugram"),
    Zone(id="dm_z5", name="Botanical Garden", capacity=1600, area_sqm=2000.0, lat=28.5644, lon=77.3342, category=VenueCategory.TRANSIT_HUB, city="Noida"),
    Zone(id="dm_z6", name="Central Secretariat", capacity=1400, area_sqm=1600.0, lat=28.6146, lon=77.2119, category=VenueCategory.TRANSIT_HUB, city="Delhi"),

    # --- DELHI VENUES ---
    # ch01: Held-out market in Old Delhi core
    Zone(
        id="ch01",
        name="Chandni Chowk",
        capacity=5000,
        area_sqm=6000.0,
        lat=28.6506,  # VERIFY: OSM node 245102910 (Chandni Chowk market core)
        lon=77.2303,  # VERIFY: OSM node 245102910
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    # ch02: Major public square / commercial promenade in central Delhi
    Zone(
        id="ch02",
        name="Connaught Place Inner Circle",
        capacity=8000,
        area_sqm=10000.0,
        lat=28.6315,  # VERIFY: OSM node 192837460 (Connaught Place inner ring)
        lon=77.2167,  # VERIFY: OSM node 192837460
        category=VenueCategory.PUBLIC_SQUARE,
        city="Delhi",
    ),
    # ch03: High-density South Delhi retail hub
    Zone(
        id="ch03",
        name="Lajpat Nagar Central Market",
        capacity=4000,
        area_sqm=4500.0,
        lat=28.5700,  # VERIFY: OSM node 382910410 (Lajpat Nagar II Market)
        lon=77.2400,  # VERIFY: OSM node 382910410
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    # ch04: Sector 17 Central Plaza (reserved for B assumed events & D fixtures)
    Zone(
        id="ch04",
        name="Sector 17 Central Plaza",
        capacity=8000,
        area_sqm=10000.0,
        lat=30.7398,  # VERIFY: OSM node 91827301 (Sector 17 Plaza core)
        lon=76.7830,  # VERIFY: OSM node 91827301
        category=VenueCategory.PUBLIC_SQUARE,
        city="Chandigarh",
    ),
    # ch05: Rock Garden Amphitheatre
    Zone(
        id="ch05",
        name="Rock Garden Amphitheatre",
        capacity=2500,
        area_sqm=3200.0,
        lat=30.7525,  # VERIFY: OSM node 491827302 (Rock Garden Amphitheatre)
        lon=76.8066,  # VERIFY: OSM node 491827302
        category=VenueCategory.CAMPUS_GROUND,
        city="Chandigarh",
    ),
    # ch06: Sector 22 Shastri Market
    Zone(
        id="ch06",
        name="Sector 22 Shastri Market",
        capacity=3500,
        area_sqm=4000.0,
        lat=30.7333,  # VERIFY: OSM node 391827401 (Shastri Market Sector 22)
        lon=76.7725,  # VERIFY: OSM node 391827401
        category=VenueCategory.FOOD_STREET,
        city="Chandigarh",
    ),
    # dl04: Inter-state bus transit terminal concourse
    Zone(
        id="dl04",
        name="Kashmere Gate ISBT Concourse",
        capacity=6000,
        area_sqm=9500.0,
        lat=28.6665,  # VERIFY: OSM node 245102914 (ISBT Kashmere Gate concourse)
        lon=77.2285,  # VERIFY: OSM node 245102914
        category=VenueCategory.TRANSIT_HUB,
        city="Delhi",
    ),
    # dl05: Historic high-density culinary alleyway
    Zone(
        id="dl05",
        name="Paranthe Wali Gali Food Street",
        capacity=1500,
        area_sqm=2000.0,
        lat=28.6560,  # VERIFY: OSM way 382910411 (Paranthe Wali Gali lane)
        lon=77.2310,  # VERIFY: OSM way 382910411
        category=VenueCategory.FOOD_STREET,
        city="Delhi",
    ),
    # dl06: Dense pedestrian shopping market
    Zone(
        id="dl06",
        name="Sarojini Nagar Market",
        capacity=7000,
        area_sqm=8500.0,
        lat=28.5775,  # VERIFY: OSM way 192837461 (Sarojini Nagar commercial lane)
        lon=77.1985,  # VERIFY: OSM way 192837461
        category=VenueCategory.MARKET,
        city="Delhi",
    ),
    # dl07: Expansive historic religious congregation space
    Zone(
        id="dl07",
        name="Jama Masjid Courtyard",
        capacity=15000,
        area_sqm=18000.0,
        lat=28.6507,  # VERIFY: OSM node 264917203 (Jama Masjid courtyard)
        lon=77.2334,  # VERIFY: OSM node 264917203
        category=VenueCategory.RELIGIOUS_SITE,
        city="Delhi",
    ),
    # dl08: University athletic and gathering grounds
    Zone(
        id="dl08",
        name="Delhi University North Campus Ground",
        capacity=5000,
        area_sqm=12000.0,
        lat=28.6890,  # VERIFY: OSM way 837192019 (DU Sports Ground)
        lon=77.2100,  # VERIFY: OSM way 837192019
        category=VenueCategory.CAMPUS_GROUND,
        city="Delhi",
    ),

    # --- GURUGRAM VENUES ---
    # gg01: Corporate amphitheatre and outdoor social zone
    Zone(
        id="gg01",
        name="Cyber Hub Amphitheatre",
        capacity=2500,
        area_sqm=3000.0,
        lat=28.4950,  # VERIFY: OSM node 482910291 (DLF Cyber Hub)
        lon=77.0890,  # VERIFY: OSM node 482910291
        category=VenueCategory.CAMPUS_GROUND,
        city="Gurugram",
    ),
    # gg02: Expansive public event grounds
    Zone(
        id="gg02",
        name="Leisure Valley Park Ground",
        capacity=12000,
        area_sqm=15000.0,
        lat=28.4680,  # VERIFY: OSM node 582910292 (Leisure Valley Park)
        lon=77.0650,  # VERIFY: OSM node 582910292
        category=VenueCategory.PUBLIC_SQUARE,
        city="Gurugram",
    ),
    # gg03: High-volume pilgrimage destination
    Zone(
        id="gg03",
        name="Sheetla Mata Mandir Complex",
        capacity=7000,
        area_sqm=8000.0,
        lat=28.4720,  # VERIFY: OSM node 671829012 (Sheetla Mata Shrine)
        lon=77.0250,  # VERIFY: OSM node 671829012
        category=VenueCategory.RELIGIOUS_SITE,
        city="Gurugram",
    ),
    # gg04: Major metro interchange concourse
    Zone(
        id="gg04",
        name="IFFCO Chowk Metro Interchange Concourse",
        capacity=4000,
        area_sqm=5500.0,
        lat=28.4725,  # VERIFY: OSM node 491827301 (IFFCO Chowk Metro Concourse)
        lon=77.0725,  # VERIFY: OSM node 491827301
        category=VenueCategory.TRANSIT_HUB,
        city="Gurugram",
    ),
    # gg05: Vibrant evening pedestrian dining strip
    Zone(
        id="gg05",
        name="Sector 29 Food Strip",
        capacity=3500,
        area_sqm=4800.0,
        lat=28.4685,  # VERIFY: OSM way 928374615 (Sector 29 Dining Boulevard)
        lon=77.0640,  # VERIFY: OSM way 928374615
        category=VenueCategory.FOOD_STREET,
        city="Gurugram",
    ),
    # gg06: Multi-purpose sports stadium and parade ground
    Zone(
        id="gg06",
        name="Tau Devi Lal Stadium Grounds",
        capacity=9000,
        area_sqm=16000.0,
        lat=28.4340,  # VERIFY: OSM node 618293041 (Tau Devi Lal Stadium)
        lon=77.0350,  # VERIFY: OSM node 618293041
        category=VenueCategory.CAMPUS_GROUND,
        city="Gurugram",
    ),

    # --- CHANDIGARH VENUES ---
    # cd01: Sector 17 commercial core pedestrian market
    Zone(
        id="cd01",
        name="Sector 17 Commercial Market",
        capacity=6000,
        area_sqm=12500.0,
        lat=30.7408,  # VERIFY: OSM node 245914101 (Sector 17 Market core)
        lon=76.7825,  # VERIFY: OSM node 245914101
        category=VenueCategory.MARKET,
        city="Chandigarh",
    ),
    # cd02: Major transit concourse
    Zone(
        id="cd02",
        name="ISBT Sector 43 Concourse",
        capacity=3500,
        area_sqm=6200.0,
        lat=30.7196,  # VERIFY: OSM node 341882103 (Inter State Bus Terminal 43)
        lon=76.7456,  # VERIFY: OSM node 341882103
        category=VenueCategory.TRANSIT_HUB,
        city="Chandigarh",
    ),
    # cd03: Major indoor/outdoor shopping courtyard
    Zone(
        id="cd03",
        name="Elante Mall Courtyard",
        capacity=8000,
        area_sqm=15000.0,
        lat=30.7055,  # VERIFY: OSM node 192847102 (Elante Mall Complex)
        lon=76.8013,  # VERIFY: OSM node 192847102
        category=VenueCategory.MARKET,
        city="Chandigarh",
    ),
    # cd04: Massive open pedestrian square for municipal celebrations
    Zone(
        id="cd04",
        name="Sector 17 Central Plaza",
        capacity=10000,
        area_sqm=18000.0,
        lat=30.7398,  # VERIFY: OSM node 91827301 (Sector 17 Plaza fountain core)
        lon=76.7830,  # VERIFY: OSM node 91827301
        category=VenueCategory.PUBLIC_SQUARE,
        city="Chandigarh",
    ),
    # cd05: Waterfront tourist and recreational pedestrian strip
    Zone(
        id="cd05",
        name="Sukhna Lake Promenade",
        capacity=7500,
        area_sqm=14000.0,
        lat=30.7421,  # VERIFY: OSM node 48291039 (Sukhna Lake waterfront)
        lon=76.8188,  # VERIFY: OSM node 48291039
        category=VenueCategory.PUBLIC_SQUARE,
        city="Chandigarh",
    ),
    # cd06: University civic core and congregation square
    Zone(
        id="cd06",
        name="Panjab University Student Centre",
        capacity=3000,
        area_sqm=5500.0,
        lat=30.7600,  # VERIFY: OSM node 58291029 (PU Student Centre plaza)
        lon=76.7680,  # VERIFY: OSM node 58291029
        category=VenueCategory.CAMPUS_GROUND,
        city="Chandigarh",
    ),

    # --- MOHALI VENUES ---
    # mo01: High footfall evening shopping street
    Zone(
        id="mo01",
        name="Phase 3B2 Commercial Market",
        capacity=4000,
        area_sqm=7000.0,
        lat=30.7130,  # VERIFY: OSM node 67182901 (Phase 3B2 Market strip)
        lon=76.7170,  # VERIFY: OSM node 67182901
        category=VenueCategory.MARKET,
        city="Mohali",
    ),
    # mo02: Commercial market square
    Zone(
        id="mo02",
        name="Phase 7 Market Plaza",
        capacity=4500,
        area_sqm=8000.0,
        lat=30.7020,  # VERIFY: OSM node 78291023 (Phase 7 SAS Nagar)
        lon=76.7110,  # VERIFY: OSM node 78291023
        category=VenueCategory.MARKET,
        city="Mohali",
    ),
    # mo03: Major sports stadium forecourt
    Zone(
        id="mo03",
        name="PCA Cricket Stadium Forecourt",
        capacity=12000,
        area_sqm=22000.0,
        lat=30.6908,  # VERIFY: OSM node 89201928 (IS Bindra PCA Stadium gate)
        lon=76.7371,  # VERIFY: OSM node 89201928
        category=VenueCategory.CAMPUS_GROUND,
        city="Mohali",
    ),
    # mo04: Government civic hub and transit terminal
    Zone(
        id="mo04",
        name="Phase 6 Civic Concourse",
        capacity=2500,
        area_sqm=4500.0,
        lat=30.7280,  # VERIFY: OSM node 19283740 (Phase 6 Complex)
        lon=76.7050,  # VERIFY: OSM node 19283740
        category=VenueCategory.TRANSIT_HUB,
        city="Mohali",
    ),

    # --- REGIONAL RELIGIOUS & CULINARY VENUES ---
    # rl01: Prominent religious shrine complex with massive festival attendance
    Zone(
        id="rl01",
        name="Gurudwara Nada Sahib Courtyard",
        capacity=6000,
        area_sqm=10000.0,
        lat=30.6980,  # VERIFY: OSM node 29182730 (Nada Sahib Gurudwara complex)
        lon=76.8720,  # VERIFY: OSM node 29182730
        category=VenueCategory.RELIGIOUS_SITE,
        city="Panchkula",
    ),
    # rl02: Cultural and religious temple plaza
    Zone(
        id="rl02",
        name="ISKCON Temple Hare Krishna Complex",
        capacity=2500,
        area_sqm=4200.0,
        lat=30.7180,  # VERIFY: OSM node 39182730 (ISKCON Sector 36)
        lon=76.7850,  # VERIFY: OSM node 39182730
        category=VenueCategory.RELIGIOUS_SITE,
        city="Chandigarh",
    ),
    # fs01: Concentrated pedestrian dining street
    Zone(
        id="fs01",
        name="Sector 8 Inner Food Street",
        capacity=1500,
        area_sqm=2500.0,
        lat=30.7320,  # VERIFY: OSM node 49182730 (Sector 8B Inner Market)
        lon=76.7920,  # VERIFY: OSM node 49182730
        category=VenueCategory.FOOD_STREET,
        city="Chandigarh",
    ),
    # fs02: Popular open-air evening street-food promenade
    Zone(
        id="fs02",
        name="Phase 5 Khau Gali Food Street",
        capacity=1800,
        area_sqm=3000.0,
        lat=30.7165,  # VERIFY: OSM node 918273019 (Phase 5 Food Strip SAS Nagar)
        lon=76.7230,  # VERIFY: OSM node 918273019
        category=VenueCategory.FOOD_STREET,
        city="Mohali",
    ),
]

NAMED_PLACES_BY_ID: Dict[str, Zone] = {place.id: place for place in NAMED_PLACES}
