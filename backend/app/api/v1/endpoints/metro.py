"""CrowdGuard Delhi Metro Operations API Endpoints.

Handles /api/v1/metro/status, /api/v1/metro/lines, and /api/v1/metro/stations.
"""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.schemas.shared import RiskTier

router = APIRouter()


class MetroLineStatus(BaseModel):
    id: str
    name: str
    color: str
    status: str  # "NOMINAL" | "ELEVATED" | "CONGESTED" | "DISRUPTED"
    ridership_daily: int
    train_frequency_mins: float
    interchange_pressure: float
    active_advisories: List[str] = Field(default_factory=list)


class MetroStationTelemetry(BaseModel):
    station_id: str
    station_name: str
    line_intersections: List[str]
    current_occupancy: int
    max_capacity: int
    turnstile_throughput_ppm: int
    platform_1_density: float
    platform_2_density: float
    esc_speed_regulation: str
    risk_score: float
    risk_tier: RiskTier
    dmrc_forecast_pressure: float


class MetroOverviewResponse(BaseModel):
    system_name: str = "Delhi Metro Rail Corporation (DMRC)"
    network_status: str = "ELEVATED_PEAK"
    total_daily_ridership_calibration: int = 5065000
    active_train_count: int = 342
    lines: List[MetroLineStatus]
    stations: List[MetroStationTelemetry]


@router.get("/status", response_model=MetroOverviewResponse)
def get_metro_status() -> MetroOverviewResponse:
    """Return real-time DMRC Delhi Metro network status and line health."""
    lines = [
        MetroLineStatus(
            id="yellow",
            name="Yellow Line (Samaypur Badli - Millennium City Centre)",
            color="#eab308",
            status="CONGESTED",
            ridership_daily=1420000,
            train_frequency_mins=2.5,
            interchange_pressure=0.84,
            active_advisories=[
                "High transfer surge at Rajiv Chowk & Hauz Khas",
                "Gate throttling active at Gate 2 Rajiv Chowk",
            ],
        ),
        MetroLineStatus(
            id="blue",
            name="Blue Line (Dwarka Sec 21 - Noida Electronic City)",
            color="#3b82f6",
            status="ELEVATED",
            ridership_daily=1380000,
            train_frequency_mins=2.8,
            interchange_pressure=0.72,
            active_advisories=["Peak hour ingress regulation at Botanical Garden"],
        ),
        MetroLineStatus(
            id="violet",
            name="Violet Line (Kashmere Gate - Raja Nahar Singh)",
            color="#8b5cf6",
            status="NOMINAL",
            ridership_daily=840000,
            train_frequency_mins=3.5,
            interchange_pressure=0.48,
            active_advisories=[],
        ),
        MetroLineStatus(
            id="magenta",
            name="Magenta Line (Janakpuri West - Botanical Garden)",
            color="#ec4899",
            status="ELEVATED",
            ridership_daily=710000,
            train_frequency_mins=3.8,
            interchange_pressure=0.65,
            active_advisories=["Hauz Khas underground walkway crowd buildup"],
        ),
    ]

    stations = [
        MetroStationTelemetry(
            station_id="dm_z1",
            station_name="Rajiv Chowk Interchange",
            line_intersections=["Yellow Line", "Blue Line"],
            current_occupancy=2080,
            max_capacity=2500,
            turnstile_throughput_ppm=340,
            platform_1_density=1.65,
            platform_2_density=1.42,
            esc_speed_regulation="REDUCED_0.50M_S",
            risk_score=0.83,
            risk_tier=RiskTier.HIGH,
            dmrc_forecast_pressure=0.88,
        ),
        MetroStationTelemetry(
            station_id="dm_z2",
            station_name="Kashmere Gate Hub",
            line_intersections=["Red Line", "Yellow Line", "Violet Line"],
            current_occupancy=1920,
            max_capacity=2800,
            turnstile_throughput_ppm=285,
            platform_1_density=1.20,
            platform_2_density=1.15,
            esc_speed_regulation="NORMAL_0.75M_S",
            risk_score=0.68,
            risk_tier=RiskTier.HIGH,
            dmrc_forecast_pressure=0.71,
        ),
        MetroStationTelemetry(
            station_id="dm_z3",
            station_name="Hauz Khas Junction",
            line_intersections=["Yellow Line", "Magenta Line"],
            current_occupancy=1240,
            max_capacity=1800,
            turnstile_throughput_ppm=210,
            platform_1_density=1.05,
            platform_2_density=0.98,
            esc_speed_regulation="NORMAL_0.75M_S",
            risk_score=0.62,
            risk_tier=RiskTier.ELEVATED,
            dmrc_forecast_pressure=0.65,
        ),
        MetroStationTelemetry(
            station_id="dm_z4",
            station_name="Millennium City Centre",
            line_intersections=["Yellow Line"],
            current_occupancy=780,
            max_capacity=1500,
            turnstile_throughput_ppm=140,
            platform_1_density=0.65,
            platform_2_density=0.55,
            esc_speed_regulation="NORMAL_0.75M_S",
            risk_score=0.35,
            risk_tier=RiskTier.NORMAL,
            dmrc_forecast_pressure=0.42,
        ),
        MetroStationTelemetry(
            station_id="dm_z5",
            station_name="Botanical Garden",
            line_intersections=["Blue Line", "Magenta Line"],
            current_occupancy=980,
            max_capacity=1600,
            turnstile_throughput_ppm=180,
            platform_1_density=0.82,
            platform_2_density=0.78,
            esc_speed_regulation="NORMAL_0.75M_S",
            risk_score=0.58,
            risk_tier=RiskTier.ELEVATED,
            dmrc_forecast_pressure=0.60,
        ),
        MetroStationTelemetry(
            station_id="dm_z6",
            station_name="Central Secretariat",
            line_intersections=["Yellow Line", "Violet Line"],
            current_occupancy=650,
            max_capacity=1400,
            turnstile_throughput_ppm=120,
            platform_1_density=0.50,
            platform_2_density=0.48,
            esc_speed_regulation="NORMAL_0.75M_S",
            risk_score=0.28,
            risk_tier=RiskTier.NORMAL,
            dmrc_forecast_pressure=0.32,
        ),
    ]

    return MetroOverviewResponse(
        lines=lines,
        stations=stations,
    )


@router.get("/lines", response_model=List[MetroLineStatus])
def get_metro_lines() -> List[MetroLineStatus]:
    """Return status of all monitored Delhi Metro lines."""
    return get_metro_status().lines


@router.get("/stations", response_model=List[MetroStationTelemetry])
def get_metro_stations() -> List[MetroStationTelemetry]:
    """Return status of all monitored Delhi Metro station hubs."""
    return get_metro_status().stations
