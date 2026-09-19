"""CrowdGuard shared schemas. Cross-team contract — DO NOT EDIT."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class VenueCategory(str, Enum):
    MARKET = "market"
    TRANSIT_HUB = "transit_hub"
    RELIGIOUS_SITE = "religious_site"
    CAMPUS_GROUND = "campus_ground"
    FOOD_STREET = "food_street"
    PUBLIC_SQUARE = "public_square"


class RiskTier(str, Enum):
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    NO_DATA = "no_data"


RiskLevel = RiskTier


class Zone(BaseModel):
    id: str
    name: str
    capacity: int
    area_sqm: float
    lat: float
    lon: float
    category: VenueCategory = VenueCategory.PUBLIC_SQUARE
    city: str = "Gurugram"


class Flow(BaseModel):
    dx: float = 0.0
    dy: float = 0.0
    magnitude: float = 0.0


class VisionSignal(BaseModel):
    zone_id: str
    timestamp: datetime
    person_count: int
    density_per_sqm: float
    flow: Flow = Field(default_factory=Flow)
    confidence: float = 0.0


class VisionAnalyzeResponse(VisionSignal):
    annotated_image_b64: Optional[str] = None
    model_name: str = "yolov8n"
    mocked: bool = False


class BeaconSignal(BaseModel):
    zone_id: str
    timestamp: datetime
    unique_devices: int
    scanner_id: str = "sim-1"


class BeaconIngestResponse(BaseModel):
    accepted: bool
    zone_id: str
    stored_readings: int


class EventItem(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    venue: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None
    category: str = "other"
    expected_attendance: int = 0
    source: str = "synthetic"
    zone_id: Optional[str] = None
    is_illustrative: bool = False


class EventsResponse(BaseModel):
    generated_at: datetime
    count: int
    events: List[EventItem]


class ForecastPoint(BaseModel):
    timestamp: datetime
    predicted_count: int
    predicted_density: float
    risk_tier: RiskTier
    drivers: List[str] = Field(default_factory=list)


class ForecastResponse(BaseModel):
    zone_id: str
    zone_name: str
    generated_at: datetime
    horizon_hours: int
    points: List[ForecastPoint]


class ZoneRisk(BaseModel):
    zone_id: str
    zone_name: str
    timestamp: datetime
    risk_score: float
    risk_tier: RiskTier
    level: RiskTier = Field(default=RiskTier.NORMAL)
    fused_estimate: int
    occupancy: float = 0.0
    capacity: int
    vision: Optional[VisionSignal] = None
    beacon: Optional[BeaconSignal] = None
    forecast_pressure: float = 0.0
    reasons: List[str] = Field(default_factory=list)
    has_live_signals: bool = True
    signal_status: str = "ok"  # "ok" | "stale" | "none"

    def model_post_init(self, __context) -> None:
        if self.level == RiskTier.NORMAL and self.risk_tier != RiskTier.NORMAL:
            object.__setattr__(self, "level", self.risk_tier)
        elif self.risk_tier == RiskTier.NORMAL and self.level != RiskTier.NORMAL:
            object.__setattr__(self, "risk_tier", self.level)


class RiskLiveResponse(BaseModel):
    generated_at: datetime
    zones: List[ZoneRisk]


class Alert(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    tier: RiskTier
    message: str
    raised_at: datetime
    risk_score: float


class AlertsResponse(BaseModel):
    generated_at: datetime
    alerts: List[Alert]


ZONES: List[Zone] = [
    Zone(id="z1", name="Main Gate Plaza", capacity=400, area_sqm=500.0, lat=28.4595, lon=77.0266, category=VenueCategory.PUBLIC_SQUARE, city="Gurugram"),
    Zone(id="z2", name="Metro Concourse", capacity=600, area_sqm=450.0, lat=28.4601, lon=77.0289, category=VenueCategory.TRANSIT_HUB, city="Gurugram"),
    Zone(id="z3", name="Market Street", capacity=900, area_sqm=1200.0, lat=28.4570, lon=77.0301, category=VenueCategory.MARKET, city="Gurugram"),
    Zone(id="z4", name="Food Court", capacity=300, area_sqm=350.0, lat=28.4588, lon=77.0245, category=VenueCategory.FOOD_STREET, city="Gurugram"),
]

ZONE_BY_ID = {z.id: z for z in ZONES}


def tier_from_score(score: float) -> RiskTier:
    if score >= 0.85:
        return RiskTier.CRITICAL
    if score >= 0.65:
        return RiskTier.HIGH
    if score >= 0.40:
        return RiskTier.ELEVATED
    return RiskTier.NORMAL
