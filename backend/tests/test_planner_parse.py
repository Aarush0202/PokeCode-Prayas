"""Unit tests for Event Planner free-text parser (rules fallback and mock LLM)."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.endpoints.planner_parse import router as planner_router
from app.services.planner_parse import (
    parse_event_text,
    parse_event_with_rules,
)

# Ensure planner_parse router is mounted on app if Person C hasn't merged router.py yet
if not any(getattr(route, "path", "").startswith("/api/v1/planner") for route in app.routes):
    app.include_router(planner_router, prefix="/api/v1/planner", tags=["Planner"])

client = TestClient(app)
IST = ZoneInfo("Asia/Kolkata")


def test_rules_parser_concert_sector17():
    """1. Parses 'concert at Sector 17 next Saturday 7pm about 5000 people' accurately."""
    # Freeze reference time to Saturday 2026-09-19 12:00:00 IST
    ref_dt = datetime(2026, 9, 19, 12, 0, 0, tzinfo=IST)
    text = "Concert with a Bollywood singer at Sector 17 next Saturday 7pm, about 5000 people"

    res = parse_event_with_rules(text, ref_dt=ref_dt)
    assert res.matched_by == "rules"
    assert res.fields.zone_id == "ch01"
    assert res.fields.event_type == "concert"
    assert res.fields.expected_attendance == 5000
    assert res.fields.draw_level == "high"  # because of 'singer' / 'bollywood'
    assert "2026-09-26T19:00:00+05:30" in res.fields.start_time
    assert "duration_hours" in res.missing


def test_rules_parser_unknown_place_gives_null_zone():
    """2. Unknown place gives zone_id: None (never invents a place)."""
    text = "Sports tournament at Springfield Oval next Sunday 10am with 2000 attendees"
    res = parse_event_with_rules(text)
    assert res.fields.zone_id is None
    assert "zone_id" in res.missing
    assert res.fields.event_type == "sports_match"
    assert res.fields.expected_attendance == 2000


def test_api_endpoint_input_over_1000_chars_gives_422():
    """3. Input over 1000 chars rejected with HTTP 422."""
    giant_text = "Concert at Sector 17 " + ("very loud " * 150)
    assert len(giant_text) > 1000

    resp = client.post("/api/v1/planner/parse", json={"text": giant_text})
    assert resp.status_code == 422


def test_llm_failure_falls_back_to_rules():
    """4. Garbage or failing LLM output falls back cleanly to deterministic rules."""
    with patch("os.getenv") as mock_env:
        mock_env.side_effect = lambda k, d=None: "dummy-key" if k == "ANTHROPIC_API_KEY" else d

        with patch("app.services.planner_parse.parse_event_with_llm", return_value=None):
            text = "Kirtan gathering at Gurudwara Nada Sahib tomorrow 8am for 4 hours with 3000 people"
            res = parse_event_text(text)
            assert res.matched_by == "rules"
            assert res.fields.zone_id == "rl01"
            assert res.fields.event_type == "religious_gathering"
            assert res.fields.expected_attendance == 3000
            assert res.fields.duration_hours == 4.0


def test_llm_mock_success():
    """5. Mock valid LLM response produces matched_by='llm'."""
    mock_llm_response = MagicMock()
    mock_content = MagicMock()
    mock_content.text = '{"zone_id": "ch03", "start_time": "2026-09-27T17:00:00+05:30", "duration_hours": 3.0, "event_type": "festival", "expected_attendance": 4500, "draw_level": "high"}'
    mock_llm_response.content = [mock_content]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_llm_response
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value = mock_client

    with patch("os.getenv") as mock_env:
        mock_env.side_effect = lambda k, d=None: "dummy-key" if k == "ANTHROPIC_API_KEY" else d
        with patch.dict("sys.modules", {"anthropic": mock_anthropic}):
            res = parse_event_text("Celebration at Elante next Sunday 5pm with 4500 people")
            assert res.matched_by == "llm"
            assert res.fields.zone_id == "ch03"
            assert res.fields.event_type == "festival"
            assert res.fields.expected_attendance == 4500
            assert res.fields.draw_level == "high"
            assert len(res.missing) == 0

