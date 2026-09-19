# AGENTS.md — CrowdGuard Multi-Agent Collaboration Guide

> **Notice for all Antigravity & AI Agents:**
> This repository is actively co-developed by multiple developers and AI agents.
> **DO NOT** rewrite working features, delete existing models/data files, or break existing API/frontend contracts. Follow the strict guardrails below.

---

## 1. System Architecture & Tech Stack

- **Backend (`/backend`)**:
  - Python FastAPI on port `8000`.
  - Shared contract schemas: `backend/app/schemas/shared.py`.
  - Data & models: `backend/app/data/named_places.py` (100+ venues, 6 categories), `backend/app/data/assumed_events.py`, `backend/app/services/forecaster.py` (`forecast_model.joblib`), `backend/app/services/detector.py` (YOLOv8n).
  - Test suite: `backend/tests/` (All 74+ tests MUST pass).

- **Frontend (`/frontend`)**:
  - React 19 + TypeScript + Vite on port `3000`.
  - Design system: Vanilla CSS with custom properties (`frontend/src/index.css`, `frontend/src/App.css`). Supports Light & Dark themes.
  - API Client: `frontend/src/services/api.ts` (proxies `/api` to `http://localhost:8000`).
  - Fallback / Mock fixtures: `frontend/src/mocks/fixtures.ts` (ensures offline and graceful degradation).
  - TypeScript validation: `cd frontend && pnpm build` (`tsc -b && vite build` MUST pass with 0 errors).

---

## 2. Core UI Layout & Tabs (Do NOT Break)

The root UI in `frontend/src/App.tsx` has **three primary tabs**:
1. **`Live Operations`** (`activeTab === 'live'`):
   - Real-time 4-zone telemetry (`z1`–`z4`), venue spatial floorplan, camera feed HUD modal, multimodal fusion breakdown, incident audit log, and bidirectional control panel.
2. **`Predictive Forecast (48h)`** (`activeTab === 'forecast'`):
   - 48-Hour Recharts risk horizon curve with diurnal baseline toggle.
   - `PlacePicker`: Combobox supporting live sensors and 35+ to 100+ venues grouped by city.
   - `EventTimeline`: Scheduled municipal events & mass-transit peaks.
3. **`Event Planner (BETA)`** (`activeTab === 'planner'`):
   - Natural language event parser (`parseEventText`), feasibility verdict card, Recharts simulation timeline, and tactical mitigations.

**Rule for Frontend Changes:**
- If you add new views, integrate them inside one of these tabs, as a sub-panel, or as a new designated tab/modal. **Never discard or overwrite existing tabs.**

---

## 3. Data & Schema Guardrails

- **Immutable Contract:** `backend/app/schemas/shared.py` defines the shared Pydantic v2 schemas (`VisionSignal`, `BeaconSignal`, `ZoneRisk`, `EventItem`, `ForecastPoint`, `RiskTier`, `PlannerAssessRequest`, etc.).
- **Zones Endpoint Contract:**
  - `GET /api/v1/zones` returns `{"count": number, "zones": Zone[]}`.
  - Frontend code MUST defensively handle zones:
    ```ts
    const list = Array.isArray(data) ? data : data?.zones ?? FIXTURE_ZONES;
    ```
- **Preserve Data Files:**
  - **NEVER** delete or wipe `backend/app/data/named_places.py` or `backend/app/data/assumed_events.py`.
  - If you add new places or events, **append** to the existing dictionary/lists. Maintain required fields (`id`, `name`, `capacity`, `area_sqm`, `lat`, `lon`, `category`, `city`).
  - Valid categories: `'market'`, `'transit_hub'`, `'religious_site'`, `'campus_ground'`, `'food_street'`, `'public_square'`.

---

## 4. Git & Contribution Workflow for AI Agents

1. **Always Sync First:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/<your-feature-name>
   ```
2. **Never Force-Push or Rewrite History:**
   - Do NOT use `git push --force` or `git reset --hard` on shared branches.
   - Main branch is protected; changes must be submitted via Pull Requests.
3. **Mandatory Pre-Commit Verification:**
   - Run backend tests:
     ```bash
     pytest backend/tests/
     ```
   - Run frontend build:
     ```bash
     cd frontend && pnpm build
     ```
   Both checks must pass cleanly with **zero failures** before pushing.
4. **Push & Create PR:**
   ```bash
   git push -u origin feat/<your-feature-name>
   ```

---

## 5. Summary Checklist for Any Agent

- [ ] I have pulled latest `origin/main`.
- [ ] I have not removed or overwritten existing endpoints, schemas, or UI tabs.
- [ ] I preserved all files in `backend/app/data/` and all ML models.
- [ ] All defensive fallbacks (`FIXTURE_ZONES`, degraded mode) remain intact.
- [ ] `pytest backend/tests/` passes 100%.
- [ ] `cd frontend && pnpm build` passes with 0 TypeScript/build errors.
