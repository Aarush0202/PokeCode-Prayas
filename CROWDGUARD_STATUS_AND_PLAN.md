# CrowdGuard: Complete Status, Working Components & Next Steps Plan

**Project:** CrowdGuard — Stampede Early-Warning & Crowd Density Prediction System  
**Event:** Prayas Hackathon  
**Repository:** `PokeCode-Prayas`  
**Current Date:** September 19, 2026  
**Status:** **100% Feature Complete & Fully Integrated**

---

## 1. Executive One-Liner for Judges

> *"Existing systems react to a crowd that has already formed. CrowdGuard predicts where crowds will form from scheduled city event data, then verifies on the ground with camera and Bluetooth signals that cover each other's blind spots."*

---

## 2. The Complete Plan Done Till Now

```
+--------------------------------------------------------------------------------------------------+
|                                    CROWDGUARD FULL PIPELINE                                      |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   [ PERSON B: City Events & Weather ] --------> [ 48-Hour ML Forecaster (Joblib) ]               |
|                                                              | (Hours/Days Ahead Prediction)     |
|                                                              v                                   |
|   [ PERSON A: Camera CCTV Feed ] -------------> [ MULTI-SIGNAL FUSION ENGINE ] <---- [ PERSON C ]|
|   (YOLOv8n Person Counting & Flow)                   (Weighted Math + Blind Spot)    (BLE Beacons|
|                                                              |                        Presence)  |
|                                                              v                                   |
|   [ PERSON D: React 19 Dashboard ] <---------- [ Dynamic Risk Score (0.0 - 1.0) ]                |
|   (Live Tiers, Recharts, Alerts)               [ NORMAL | ELEVATED | HIGH | CRITICAL ]          |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

### Phase 0: Cross-Team Contract & Shared Infrastructure (Owner: Person C / You)
- **`backend/app/schemas/shared.py`**: Immutable shared contract defining:
  - 4 Monitored Zones: `z1` Main Gate Plaza, `z2` Metro Concourse, `z3` Market Street, `z4` Food Court.
  - Risk Tiers: `NORMAL` (<0.40), `ELEVATED` (0.40–0.64), `HIGH` (0.65–0.84), `CRITICAL` (>=0.85).
  - Pydantic v2 schemas: `VisionSignal`, `BeaconSignal`, `EventItem`, `ForecastPoint`, `ZoneRisk`, `Alert`.
- **`backend/app/services/store.py`**: High-speed in-memory ring buffer (500 readings per zone history) with timezone-aware UTC timestamps.
- **`backend/app/api/v1/router.py`**: Defensive dynamic module router. Gracefully isolates modules so missing files never crash server boot.
- **`backend/requirements-crowdguard.txt`**: Project dependencies (`numpy`, `pandas`, `scikit-learn`, `joblib`, `xgboost`, `httpx`, `python-multipart`).

### Phase 1: Beacons, Fusion Engine & Risk System (Owner: Person C / You)
- **`backend/app/api/v1/endpoints/zones.py`**:
  - `GET /api/v1/zones`: Lists all 4 zones.
  - `GET /api/v1/zones/{zone_id}`: Single zone metadata or 404.
- **`backend/app/api/v1/endpoints/beacons.py`**:
  - `POST /api/v1/beacons/ingest`: Ingests Bluetooth counts, validates zone ID, validates `unique_devices >= 0`.
  - `GET /api/v1/beacons/latest/{zone_id}`: Most recent BLE reading.
  - `GET /api/v1/beacons/history/{zone_id}`: Rolling window historical readings.
- **`backend/app/services/fusion.py`**:
  - Pure mathematical fusion engine (zero web framework dependencies for unit testability).
  - **Blind-Spot Disagreement Logic**: If Camera and Bluetooth diverge by >25% occupancy, takes `max(camera, bluetooth)` and explains: `"camera and Bluetooth counts disagree, using the higher estimate"`.
  - **Crowd Surge Rate Bonus**: Adds `+0.15` and `"crowd building rapidly"` if occupancy rises >10%/min.
  - **Flow Bottleneck Bonus**: Adds `+0.05` when camera directional flow magnitude >0.40.
  - **120-Second Staleness Rule**: Automatically discards feeds older than 2 minutes.
- **`backend/app/api/v1/endpoints/risk.py`**:
  - `GET /api/v1/risk/live`: Always returns 200 with all 4 zones, guaranteed never to fail.
  - `GET /api/v1/risk/live/{zone_id}`: Single zone risk or 400.
  - `GET /api/v1/risk/alerts`: Active alerts for any zone at `ELEVATED` or above.
- **`tools/beacon_simulator.py`**: Interactive CLI ramp/steady simulator.
- **`tools/ble_scanner.py`**: Real hardware Bluetooth scanner with SHA-256 MAC anonymization for privacy.
- **`tools/README.md`**: Complete demo rehearsal instructions.

### Phase 2: Teammate Integrations (Merged into `main`)
- **Person B (`feat/forecast`)**:
  - `backend/app/services/event_fetcher.py`: 11 city events with offline synthetic fallback.
  - `backend/app/services/forecaster.py`: Trained ML model (`forecast_model.joblib`) predicting 48-hour pressure timelines.
  - Endpoints: `GET /api/v1/events/nearby`, `POST /api/v1/events/refresh`, `GET /api/v1/forecast/{zone_id}`.
- **Person D (`feat/frontend` - Updated & Pulled)**:
  - React 19 + TypeScript + Vite web dashboard.
  - **Light & Dark Theme Toggle**: Modern clean light theme with dark mode toggle.
  - **RBAC Auth & Login Page**: Profile selection with operator roles (Security Lead, City Commissioner, Transit Operator).
  - **5 Judge-Feedback Enhancements**:
    1. **Spatial Venue Map (`VenueMap.tsx`)**: Interactive overhead 2D floorplan showing zones, choke points, and live heat.
    2. **Forecast Linkage Strip (`ForecastLinkageStrip.tsx`)**: Directly connects upcoming city events to live zone pressure.
    3. **Incident Audit Timeline (`IncidentLog.tsx`)**: Timestamped event log tracking escalations and tactical actions.
    4. **Risk Score Formula Explainer (`RiskScoreExplainer.tsx`)**: Visual breakdown of the mathematical fusion equation for judges.
    5. **Bidirectional Control Panel (`ControlPanel.tsx`)**: Manual surge injection and tactical de-escalation reset controls.
  - Real-time polling hook `useLiveRisk.ts`.
- **Person A (`feat/vision`)**:
  - `backend/app/services/detector.py`: YOLOv8n crowd detector with bounding box annotations.
  - Endpoints: `POST /api/v1/vision/analyze`, `POST /api/v1/vision/simulate`, `GET /api/v1/vision/latest/{zone_id}`.
  - Sample test frames in `tools/sample_frames/`.

---

## 3. What is Working Right Now (Verified)

### A. Automated Test Suite: 35 / 35 Tests Passing (100%)
```
============================= test session starts ==============================
backend/tests/test_beacons.py ....                                       [ 11%]
backend/tests/test_demo.py ...                                           [ 20%]
backend/tests/test_events.py ....                                        [ 31%]
backend/tests/test_forecast.py ......                                    [ 48%]
backend/tests/test_health.py ...                                         [ 57%]
backend/tests/test_risk.py ......                                        [ 74%]
backend/tests/test_vision.py ......                                      [ 91%]
backend/tests/test_zones.py ...                                          [100%]

======================== 35 passed, 2 warnings in 5.14s ========================
```

### B. Frontend Production Build
```
cd frontend && pnpm build
✓ 2462 modules transformed.
dist/index.html                   1.29 kB │ gzip:   0.71 kB
dist/assets/index-CDztEgbo.css    5.05 kB │ gzip:   1.75 kB
dist/assets/index-D3jw2vEh.js   640.24 kB │ gzip: 188.49 kB
✓ built in 282ms
```
Zero TypeScript or bundling errors.

### C. Live Servers Running Locally
- **FastAPI Backend**: `http://localhost:8000` (Interactive Swagger at `http://localhost:8000/docs`)
- **React 19 Dashboard**: `http://localhost:3000`

### D. Live Full-Stack Endpoints Tested & Verified:
1. `GET /api/v1/zones` -> Returns 4 monitored zones with capacity & GPS coordinates.
2. `POST /api/v1/beacons/ingest` -> Ingests phone counts, increments storage count.
3. `GET /api/v1/risk/live` -> Returns fused risk scores and reasons across all 4 zones.
4. `GET /api/v1/risk/alerts` -> Returns alerts for elevated zones.
5. `GET /api/v1/events/nearby` -> Returns 11 scheduled city events.
6. `GET /api/v1/forecast/z1` -> Generates 48-hour hourly crowd prediction curve.
7. `POST /api/v1/vision/simulate` -> Ingests camera headcount and flow vectors.
8. `tools/beacon_simulator.py` -> Successfully ramps devices and visibly flips zones from `NORMAL` -> `ELEVATED` -> `HIGH`.

---

## 4. Current Git & Repository Status

- Branch `main` contains **all 4 teammates' merged work**.
- Local working tree is completely clean.
- Local `main` is ahead of `origin/main` by 12 commits.
- **Standing Policy Active**: No changes are pushed to GitHub without your explicit confirmation.

---

## 5. What is the Plan Now (Next Steps)

### Step 1: Push `main` to GitHub
- **Action**: Push local `main` to `origin/main`.
- **Purpose**: Makes the completed, merged project available to all teammates and triggers CI/CD workflows on GitHub.
- **Command**:
  ```bash
  git push origin main
  ```

### Step 2: Rehearse the 3-Minute Live Demo
Rehearse this exact sequence twice before judging:

1. **Open the Dashboard**:
   - Open `http://localhost:3000` on the presentation screen.
   - Show all 4 zones starting at green **NORMAL** risk.
2. **Show Predictive Power (Day-Ahead Forecast)**:
   - Switch to the **Forecast** tab.
   - Point out tomorrow's 7:00 PM peak in Market Street caused by the scheduled concert event.
3. **Trigger the Real-Time Surge**:
   - In a terminal, run:
     ```bash
     python tools/beacon_simulator.py --zone z3 --start 40 --peak 520 --minutes 2
     ```
   - Watch the dashboard in real time:
     - Within 30 seconds: Rate-of-change bonus triggers `"crowd building rapidly"`.
     - Within 60 seconds: Zone flips to **ELEVATED**, then **HIGH**.
     - The red **Alert Banner** drops down with emergency instructions.
4. **Demonstrate Blind-Spot Defense**:
   - Point out that even if the CCTV camera was pointed the wrong way, Bluetooth caught the surge, and fusion automatically defaulted to the safer, higher count.
5. **Close with the One-Liner**:
   > *"Existing systems react to a crowd that has already formed. CrowdGuard predicts where crowds will form from city event data, then verifies on the ground with camera and Bluetooth signals that cover each other's blind spots."*

### Step 3: Cloud Deployment (Optional / When Ready)
- **Render (1-Click Blueprint)**: Link repo to [Render Blueprints](https://dashboard.render.com/blueprints). It reads `render.yaml` and deploys both backend & frontend for $0.
- **Vercel**: Run `cd frontend && npx vercel --prod`.
- **Railway**: Link repo on Railway to deploy `backend/`.

### Step 4: Answers Ready for Judges' Tough Questions
- **Privacy**: No facial recognition. Bluetooth MAC addresses are hashed via SHA-256 (truncated to 12 chars) in volatile memory and discarded. We count presence, never identity.
- **MAC Randomization**: Modern phones randomize Bluetooth addresses every few minutes. We de-duplicate within each scan window and treat beacon count as a relative trend, not an absolute census.
- **Thermal Cameras**: Too expensive for mass public infrastructure. We reuse existing CCTV cameras + ₹300 BLE beacons.
- **Prior Art**: Camera-only and Bluetooth-only crowd monitoring exist in research. Nobody fuses them with scheduled city events for day-ahead prediction. That combination is our core contribution.
