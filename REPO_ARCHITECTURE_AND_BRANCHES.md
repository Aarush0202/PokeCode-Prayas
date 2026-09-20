# CrowdGuard: Repository Architecture & Branch Guide

> **Core Question:** *Can we host everything just using the `main` branch, and what branches do we need?*  
> **Direct Answer:** **YES, ABSOLUTELY.** Everything is already consolidated into `main`. You can host the entire full-stack system (FastAPI backend + React 19 frontend + ML forecast models + YOLO detector + BLE beacons) exclusively using the `main` branch.

---

## 1. Branch Strategy & Status

### The Golden Rule: `main` is the Single Source of Truth
All team branches have been tested, validated, and merged into `main` (current HEAD: `12f4e05`).

| Branch Name | Role / Subsystem | Merged Status | Can It Be Hosted Solo? |
| :--- | :--- | :--- | :--- |
| **`main`** ⭐ | **Unified Production System** (All 4 team members) | **Active / Current** | **YES — Contains 100% of all features** |
| `exp/a-vision` | Person A: YOLOv8n vision detector & HUD | Merged into `main` (PR #2) | No need — already inside `main` |
| `exp/b-forecast`| Person B: 48h ML model, 100+ venues, week-pattern | Merged into `main` (PR #3) | No need — already inside `main` |
| `exp/c-fusion` | Person C: Mathematical fusion engine & BLE beacons | Merged into `main` (PR #1) | No need — already inside `main` |
| `exp/d-frontend`| Person D: PlacePicker, Event Planner, 3 tabs, modals | Merged into `main` | No need — already inside `main` |

### What Branches Do We Need Going Forward?
* **For Hosting / Presentation / Demo:** You **ONLY need `main`**. Checkout `main`, pull the latest commit, and launch.
* **For New Experiments or Additions:** Never push directly to `main`. Create short-lived branches:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b feat/<feature-name>
  # Work, test, push, and create a PR into main
  ```

---

## 2. Complete Repository Architecture

```
PokeCode-Prayas/
├── AGENTS.md                         # Antigravity & AI Agent collaboration rules and guardrails
├── docker-compose.yml                # Production multi-container orchestration (ports 3000 & 8000)
├── Makefile                          # Developer shortcuts (make dev, make test, make docker-up)
├── package.json                      # Root workspace scripts (pnpm dev, pnpm build)
├── render.yaml                       # 1-Click cloud deployment blueprint for Render
├── railway.json                      # Cloud deployment configuration for Railway
│
├── backend/                          # Python FastAPI Backend (Port 8000)
│   ├── Dockerfile                    # Production Python 3.12 slim container
│   ├── requirements.txt              # Production Python dependencies
│   ├── requirements-crowdguard.txt   # ML & data science dependencies (numpy, pandas, sklearn, joblib)
│   ├── app/
│   │   ├── main.py                   # FastAPI factory, lifespan startup seeding, CORS setup
│   │   ├── api/v1/
│   │   │   ├── router.py             # Defensive v1 route registration
│   │   │   └── endpoints/
│   │   │       ├── zones.py          # GET /api/v1/zones (lists live sensors & named places)
│   │   │       ├── risk.py           # GET /api/v1/risk/live & alerts (multimodal risk score)
│   │   │       ├── forecast.py       # GET /api/v1/forecast/{id} & week-pattern baseline
│   │   │       ├── events.py         # GET /api/v1/events/nearby & POST refresh
│   │   │       ├── beacons.py        # POST /api/v1/beacons/ingest & history
│   │   │       ├── vision.py         # POST /api/v1/vision/analyze & simulate
│   │   │       ├── planner.py        # POST /api/v1/planner/assess & parse
│   │   │       └── health.py         # GET /health & /api/v1/health
│   │   ├── core/
│   │   │   └── config.py             # App environment variables, CORS origins, debug flags
│   │   ├── data/
│   │   │   ├── named_places.py       # 100+ Indian venues categorized into 6 types
│   │   │   └── assumed_events.py     # Calendar events anchored to real IST time
│   │   ├── schemas/
│   │   │   └── shared.py             # Immutable shared Pydantic v2 schemas across backend & frontend
│   │   └── services/
│   │       ├── forecaster.py         # 48-hour ML crowd horizon predictor + baseline calculations
│   │       ├── fusion.py             # Multimodal sensor fusion math (Camera + Bluetooth + Rate)
│   │       ├── detector.py           # YOLOv8n object & person crowd density detector
│   │       ├── event_fetcher.py      # Scheduled city events ingestion with offline fallback
│   │       └── store.py              # In-memory high-speed ring buffer for live telemetry
│   ├── data/
│   │   ├── forecast_model.joblib     # Pre-trained ML model artifact for crowd occupancy
│   │   ├── model_metrics.json        # Evaluation metrics across 100 venues & categories
│   │   ├── feature_columns.json      # Model input feature column mappings
│   │   └── footfall_train.csv        # Historical footfall training calibration dataset
│   └── tests/                        # 78 passing unit & integration tests (100% green)
│
├── frontend/                         # React 19 + TypeScript + Vite Frontend (Port 3000)
│   ├── Dockerfile                    # Multi-stage Dockerfile (Vite build -> Nginx Alpine)
│   ├── nginx.conf                    # Production Nginx reverse proxy configuration
│   ├── src/
│   │   ├── App.tsx                   # Master layout with 3 tabs, header status, audio alarm, RBAC
│   │   ├── App.css                   # Layout styles, panels, grid cards, header navigation
│   │   ├── index.css                 # Design tokens, CSS custom properties, light & dark theme
│   │   ├── types/
│   │   │   └── crowdguard.ts         # TypeScript interfaces matching backend schemas
│   │   ├── services/
│   │   │   └── api.ts                # API client with timeout, error handling, and fixture fallbacks
│   │   ├── mocks/
│   │   │   └── fixtures.ts           # Offline safety fixtures ensuring zero-crash presentation
│   │   ├── hooks/
│   │   │   └── useLiveRisk.ts        # Dynamic 3-second live telemetry polling hook
│   │   ├── utils/
│   │   │   └── audioAlerts.ts        # Web Audio synthesizer for tactical chimes & siren alarms
│   │   └── components/
│   │       ├── ZoneGrid.tsx          # 4-zone telemetry grid cards & spatial status
│   │       ├── VenueMap.tsx          # 2D interactive spatial floorplan with choke points
│   │       ├── ForecastChart.tsx     # 48-hour Recharts predictive curve with threshold bands
│   │       ├── PlacePicker.tsx       # Venue combobox supporting 35+ to 100+ places with city groups
│   │       ├── EventTimeline.tsx     # Municipal schedule & mass-transit peaks timeline
│   │       ├── EventPlanner.tsx      # Natural language event assessor with feasibility gauge
│   │       ├── SignalBreakdown.tsx   # Camera vs Bluetooth fusion discrepancy breakdown
│   │       ├── CameraFeedModal.tsx   # Simulated optical CCTV feed with YOLOv8 HUD overlays
│   │       ├── ControlPanel.tsx      # Presenter controls (inject surge, reset, de-escalate)
│   │       ├── IncidentLog.tsx       # Timestamped audit timeline of security incidents
│   │       ├── LoginPage.tsx         # RBAC operator selector (Security Lead, Commissioner, etc.)
│   │       └── AboutForecastModal.tsx# Machine learning validation and model metrics modal
│   └── vite.config.ts                # Vite config proxying /api to http://localhost:8000
│
└── tools/                            # Hardware simulation & demo utility scripts
    ├── telemetry_feeder.py           # Sends 3-second synthetic camera & BLE signals
    ├── beacon_simulator.py           # Interactive Bluetooth scanner traffic injector
    ├── ble_scanner.py                # Hardware Bluetooth Low Energy scanner with SHA-256 MAC hashing
    └── generate_training_data.py     # Script to retrain and regenerate model artifacts
```

---

## 3. How to Host Everything from the `main` Branch

### Option A: Docker Compose (Recommended for Judges & Live Demos)
Runs both the backend API and frontend Nginx SPA as isolated, self-healing containers:

```bash
# 1. Ensure you are on the main branch
git checkout main
git pull origin main

# 2. Build and start containers in the background
docker compose up --build -d

# 3. Check container health
docker compose ps
```

* **Frontend Web App:** Open `http://localhost:3000`
* **Backend API Docs:** Open `http://localhost:8000/docs`
* **Stop containers:** `docker compose down`

---

### Option B: Local Native Mode (Best for Live Code Editing)
Runs FastAPI directly via Uvicorn and the frontend via Vite dev server:

1. **Terminal 1 — Backend:**
   ```bash
   cd backend
   python3 -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
   ```
2. **Terminal 2 — Frontend:**
   ```bash
   cd frontend
   pnpm install
   pnpm dev --host
   ```
3. **Terminal 3 (Optional) — Live Telemetry Feeder:**
   ```bash
   python3 tools/telemetry_feeder.py
   ```

---

## 4. Verification Checklist

Before presenting or deploying from `main`, verify both validation gates:

1. **Backend Tests:**
   ```bash
   pytest backend/tests/
   # Expected: 78 passed, 100% green
   ```
2. **Frontend Typecheck & Build:**
   ```bash
   cd frontend && pnpm build
   # Expected: built in ~350ms, 0 errors
   ```
3. **Live Healthcheck:**
   ```bash
   curl http://localhost:8000/health
   # Expected: {"status":"healthy","service":"PokeCode API","version":"1.0.0"}
   ```

---

## 5. Summary

* **Do you need multiple branches?** **No.** All features from Person A, B, C, and D are fully merged into `main`.
* **Can you host everything just using `main`?** **Yes.** Running `docker compose up --build -d` on `main` launches the entire full-stack system with 100% capabilities.
