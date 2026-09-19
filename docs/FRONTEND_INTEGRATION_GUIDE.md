# CrowdGuard: Frontend Integration Guide & API Contract

> **Target Audience:** Frontend Engineers (React / TypeScript / Vite / Mobile)  
> **Status:** Fully Integrated, Tested (53/53 Backend Tests Passing), and Live  
> **Base Branch:** `exp/a-vision` (pushed to `origin/exp/a-vision`)  
> **Local Backend Port:** `http://localhost:8000` (FastAPI)  
> **Local Frontend Port:** `http://localhost:3000` (Vite, proxies `/api` and `/health` to 8000)

---

## 1. Quick Summary of What Has Been Done

1. **Venue Master Registry (`named_places.py`)**:
   - Expanded from 6 temporary stubs to **35 fully categorized venues**:
     - **4 Core Instrumented Zones** (`z1` to `z4`) with live camera and BLE IoT telemetry.
     - **31 Held-Out Named Places** across Chandigarh, Mohali, Panchkula, Delhi, and Gurugram for day-ahead forecasting and event planning feasibility.
   - All 6 venue categories supported: `market`, `transit_hub`, `religious_site`, `campus_ground`, `food_street`, `public_square`.
   - Fully compatible with both Person B's assumed events (`ch01`, `ch02`, `ch04`, `mo03`, `rl01`, `fs01`) and Person D's frontend fixtures (`cd01`–`cd06`, `mo01`–`mo04`).

2. **Event Planner Natural Language Text Parser (`POST /api/v1/planner/parse`)**:
   - Accepts free-text event descriptions up to 1000 characters (e.g., *"Concert with a Bollywood singer at Sector 17 next Saturday 7pm, about 5000 people"*).
   - Extracts structured parameters: `zone_id`, `start_time` (IST `+05:30`), `duration_hours`, `event_type`, `expected_attendance`, `draw_level`.
   - Supports Anthropic Claude LLM extraction with an automated 100% offline rule-based fallback.

3. **Event Feasibility Assessment Engine (`POST /api/v1/planner/assess`)**:
   - Deterministic mathematical model evaluating hourly pedestrian density, diurnal baseline footfall, peak crowd build-up, and scenario stress tests (+30%, +60%).
   - Renders feasibility verdict: `feasible`, `feasible_with_mitigations`, or `not_recommended`.

4. **Vision Occlusion & Blind-Spot Simulation (`POST /api/v1/vision/simulate`)**:
   - Accepts `zone_id`, `count`, `person_count` (backward compatible alias), and `occluded: bool`.
   - `occluded: true` simulates camera blockage, triggering CrowdGuard's multi-signal divergence rule where BLE radio presence rescues the blind spot.

5. **Live Telemetry Feeder Daemon (`tools/telemetry_feeder.py`)**:
   - Background streamer delivering real-time telemetry pulses to `z1` through `z4` every 3 seconds so the dashboard is continuously alive.

---

## 2. Base URLs & Vite Proxy Setup

### Development (Local Vite Proxy)
In `frontend/vite.config.ts`, Vite reverse-proxies `/api` and `/health` to `http://localhost:8000`:
```ts
server: {
  port: 3000,
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true },
    '/health': { target: 'http://localhost:8000', changeOrigin: true },
  },
}
```
In `frontend/.env`:
```env
VITE_API_BASE_URL=/api
VITE_MOCK=0
```
- When `VITE_MOCK=0`, frontend calls the live FastAPI backend.
- When backend is unreachable, the frontend automatically falls back to in-memory fixtures.

---

## 3. Complete Endpoints Reference

### 3.1. System Health Check
- **Endpoint:** `GET /health` or `GET /api/v1/health`
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "PokeCode API",
  "version": "1.0.0",
  "environment": "development"
}
```

---

### 3.2. List All Monitored Zones & Named Places
- **Endpoint:** `GET /api/v1/zones`
- **Description:** Returns all 4 instrumented zones and 31 held-out named places. Synthetic training venues (`syn*`) are excluded.
- **Response `200 OK`:**
```json
{
  "count": 35,
  "zones": [
    {
      "id": "z1",
      "name": "Main Gate Plaza",
      "capacity": 400,
      "area_sqm": 500.0,
      "lat": 28.4595,
      "lon": 77.0266,
      "category": "public_square",
      "city": "Gurugram"
    },
    {
      "id": "z2",
      "name": "Metro Concourse",
      "capacity": 600,
      "area_sqm": 450.0,
      "lat": 28.4598,
      "lon": 77.0275,
      "category": "transit_hub",
      "city": "Gurugram"
    },
    {
      "id": "z3",
      "name": "Market Street",
      "capacity": 900,
      "area_sqm": 1200.0,
      "lat": 28.4605,
      "lon": 77.0282,
      "category": "market",
      "city": "Gurugram"
    },
    {
      "id": "z4",
      "name": "Food Court",
      "capacity": 300,
      "area_sqm": 350.0,
      "lat": 28.4612,
      "lon": 77.029,
      "category": "food_street",
      "city": "Gurugram"
    },
    {
      "id": "cd01",
      "name": "Sector 17 Commercial Market",
      "capacity": 6000,
      "area_sqm": 12500.0,
      "lat": 30.7408,
      "lon": 76.7825,
      "category": "market",
      "city": "Chandigarh"
    }
  ]
}
```

---

### 3.3. Get Single Zone Details
- **Endpoint:** `GET /api/v1/zones/{zone_id}`
- **Parameters:** `zone_id` (e.g. `z1`, `z3`, `cd01`, `ch04`, `mo01`)
- **Response `200 OK`:** Single `Zone` object.
- **Error `404 Not Found`:** If `zone_id` does not exist.

---

### 3.4. Live Ground-Truth Crowd Risk (Primary Dashboard Endpoint)
- **Endpoint:** `GET /api/v1/risk/live`
- **Description:** Returns fused real-time risk scores for all zones. Frontend should poll this every 3 seconds.
- **Response `200 OK`:**
```json
{
  "generated_at": "2026-09-19T16:15:19.786212Z",
  "zones": [
    {
      "zone_id": "z3",
      "zone_name": "Market Street",
      "timestamp": "2026-09-19T16:15:19.000Z",
      "risk_score": 0.48,
      "risk_tier": "ELEVATED",
      "level": "ELEVATED",
      "fused_estimate": 486,
      "occupancy": 0.54,
      "capacity": 900,
      "vision": {
        "zone_id": "z3",
        "timestamp": "2026-09-19T16:15:18.000Z",
        "person_count": 488,
        "density_per_sqm": 0.406,
        "flow": { "dx": 0.0, "dy": 0.0, "magnitude": 0.0 },
        "confidence": 0.95
      },
      "beacon": {
        "zone_id": "z3",
        "timestamp": "2026-09-19T16:15:18.000Z",
        "unique_devices": 251,
        "scanner_id": "scanner-z3-auto"
      },
      "forecast_pressure": 0.25,
      "reasons": [
        "crowd building rapidly"
      ],
      "has_live_signals": true,
      "signal_status": "ok"
    },
    {
      "zone_id": "cd01",
      "zone_name": "Sector 17 Commercial Market",
      "timestamp": "2026-09-19T16:15:19.000Z",
      "risk_score": 0.0,
      "risk_tier": "no_data",
      "level": "no_data",
      "fused_estimate": 0,
      "occupancy": 0.0,
      "capacity": 6000,
      "vision": null,
      "beacon": null,
      "forecast_pressure": 0.35,
      "reasons": [
        "uninstrumented venue (forecast only)"
      ],
      "has_live_signals": false,
      "signal_status": "none"
    }
  ]
}
```

> **Important Signal Status Rules for UI:**
> - `signal_status: "ok"`: Active physical sensors reporting fresh ground truth (< 120s old).
> - `signal_status: "stale"`: Physical zone sensors haven't reported in > 120s. Render **amber warning badge**.
> - `signal_status: "none"`: Named place without physical IoT sensors (forecast-only). Render **purple Forecast-Only badge**.

---

### 3.5. Active Early Warning Alerts
- **Endpoint:** `GET /api/v1/risk/alerts`
- **Description:** Returns sorted list of active alerts for zones with risk `ELEVATED`, `HIGH`, `CRITICAL`, or `no_data` (sensor stale).
- **Response `200 OK`:**
```json
{
  "generated_at": "2026-09-19T16:15:30.000Z",
  "alerts": [
    {
      "id": "alert-z3-1774113330",
      "zone_id": "z3",
      "zone_name": "Market Street",
      "tier": "CRITICAL",
      "message": "Market Street at CRITICAL risk — 900 people estimated against a 900 capacity. camera and Bluetooth counts disagree, using the higher estimate. crowd building rapidly.",
      "raised_at": "2026-09-19T16:15:30.000Z",
      "risk_score": 0.85
    }
  ]
}
```

---

### 3.6. Event Planner Natural Language Text Parser
- **Endpoint:** `POST /api/v1/planner/parse` (also responds on `POST /api/v1/parse`)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "text": "Concert with a Bollywood singer at Sector 17 next Saturday 7pm, about 5000 people"
}
```
- **Constraints:** Max 1000 characters. Rejects > 1000 with `422 Unprocessable Entity`.
- **Response `200 OK`:**
```json
{
  "fields": {
    "zone_id": "cd01",
    "start_time": "2026-09-26T19:00:00+05:30",
    "duration_hours": null,
    "event_type": "concert",
    "expected_attendance": 5000,
    "draw_level": "high"
  },
  "missing": [
    "duration_hours"
  ],
  "matched_by": "rules",
  "note": "Review and confirm every field before assessing."
}
```

---

### 3.7. Event Feasibility Assessment Engine
- **Endpoint:** `POST /api/v1/planner/assess`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "zone_id": "ch04",
  "start_time": "2026-09-26T18:00:00+05:30",
  "duration_hours": 4,
  "event_type": "concert",
  "expected_attendance": 5000,
  "draw_level": "high"
}
```
- **Allowed Values:**
  - `event_type`: `concert` | `sports_match` | `rally` | `festival` | `religious_gathering` | `other`
  - `draw_level`: `normal` | `high` | `very_high`
- **Response `200 OK`:**
```json
{
  "zone": {
    "id": "ch04",
    "name": "Sector 17 Central Plaza",
    "city": "Chandigarh",
    "category": "public_square",
    "capacity": 8000,
    "area_sqm": 10000.0
  },
  "verdict": "feasible_with_mitigations",
  "peak": {
    "time": "2026-09-26T20:00:00+05:30",
    "total_present": 6120,
    "occupancy_ratio": 0.765,
    "density_per_sqm": 0.612
  },
  "scenarios": [
    { "label": "expected", "attendance": 5000, "peak_ratio": 0.765, "verdict": "feasible_with_mitigations" },
    { "label": "+30%", "attendance": 6500, "peak_ratio": 0.945, "verdict": "not_recommended" },
    { "label": "+60%", "attendance": 8000, "peak_ratio": 1.125, "verdict": "not_recommended" }
  ],
  "timeline": [
    { "time": "2026-09-26T18:00:00+05:30", "baseline": 850, "event": 1200, "total": 2050, "ratio": 0.256 },
    { "time": "2026-09-26T19:00:00+05:30", "baseline": 1100, "event": 3800, "total": 4900, "ratio": 0.613 },
    { "time": "2026-09-26T20:00:00+05:30", "baseline": 1120, "event": 5000, "total": 6120, "ratio": 0.765 },
    { "time": "2026-09-26T21:00:00+05:30", "baseline": 950, "event": 3500, "total": 4450, "ratio": 0.556 }
  ],
  "reasons": [
    "Peak occupancy ratio reaches 76.5% of safe venue capacity.",
    "Draw level 'high' increases arrival rate concentration in hour 2."
  ],
  "mitigations": [
    "Establish one-way pedestrian circulation routes across Plaza corridors.",
    "Pre-position crowd control barriers along North sector access points."
  ],
  "alternatives": [
    { "zone_id": "mo01", "name": "PCA Cricket Stadium Concourse", "peak_ratio": 0.408, "verdict": "feasible" }
  ],
  "assumptions": [
    "Diurnal baseline computed via statistical pedestrian model.",
    "Draw multiplier reflects assumed publicity pull."
  ],
  "disclaimer": "Decision support only. Not a safety approval; real events need police, fire and local-authority clearance."
}
```

---

### 3.8. 48-Hour ML Footfall Forecast
- **Endpoint:** `GET /api/v1/forecast/{zone_id}?hours=48`
- **Response `200 OK`:**
```json
{
  "zone_id": "z3",
  "zone_name": "Market Street",
  "generated_at": "2026-09-19T16:15:00.000Z",
  "points": [
    {
      "timestamp": "2026-09-19T17:00:00.000Z",
      "predicted_count": 520,
      "density_per_sqm": 0.43,
      "ratio": 0.58,
      "risk_tier": "ELEVATED",
      "drivers": ["Evening shopping influx", "IPL screening scheduled tomorrow"]
    }
  ]
}
```

---

### 3.9. Vision Headcount & Occlusion Simulation (Demo Trigger)
- **Endpoint:** `POST /api/v1/vision/simulate`
- **Request Body:**
```json
{
  "zone_id": "z3",
  "count": 35,
  "occluded": true
}
```
- **Note:** Accepts either `count` or `person_count`. `occluded: true` sets an explicit camera blind spot.

---

### 3.10. BLE Beacon Device Ingestion (Hardware / Simulator Feed)
- **Endpoint:** `POST /api/v1/beacons/ingest`
- **Request Body:**
```json
{
  "zone_id": "z3",
  "unique_devices": 750,
  "scanner_id": "scanner-z3-01",
  "timestamp": "2026-09-19T16:15:30Z"
}
```
- **Privacy Enforcement:** Raw hardware MAC addresses (e.g. `AA:BB:CC:DD:EE:FF`) are rejected with `HTTP 422`. Pass aggregate integer counts or salted SHA-256 12-char hashes only.

---

## 4. TypeScript Interface Definitions

Copy-pasteable types for frontend `src/types/crowdguard.ts`:

```typescript
export type VenueCategory = 
  | 'market' 
  | 'transit_hub' 
  | 'religious_site' 
  | 'campus_ground' 
  | 'food_street' 
  | 'public_square';

export type RiskTier = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'no_data';
export type SignalStatus = 'ok' | 'stale' | 'none';

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  area_sqm: number;
  lat: number;
  lon: number;
  category: VenueCategory;
  city: string;
}

export interface VisionSignal {
  zone_id: string;
  timestamp: string;
  person_count: number;
  density_per_sqm: number;
  flow: { dx: number; dy: number; magnitude: number };
  confidence: number;
}

export interface BeaconSignal {
  zone_id: string;
  timestamp: string;
  unique_devices: number;
  scanner_id: string;
}

export interface ZoneRisk {
  zone_id: string;
  zone_name: string;
  timestamp: string;
  risk_score: number;
  risk_tier: RiskTier;
  level: RiskTier;
  fused_estimate: number;
  occupancy: number;
  capacity: number;
  vision: VisionSignal | null;
  beacon: BeaconSignal | null;
  forecast_pressure: number;
  reasons: string[];
  has_live_signals: boolean;
  signal_status: SignalStatus;
}

export interface Alert {
  id: string;
  zone_id: string;
  zone_name: string;
  tier: RiskTier;
  message: string;
  raised_at: string;
  risk_score: number;
}

export interface PlannerParseResponse {
  fields: {
    zone_id: string | null;
    start_time: string | null;
    duration_hours: number | null;
    event_type: 'concert' | 'sports_match' | 'rally' | 'festival' | 'religious_gathering' | 'other' | null;
    expected_attendance: number | null;
    draw_level: 'normal' | 'high' | 'very_high' | null;
  };
  missing: string[];
  matched_by: 'llm' | 'rules';
  note: string;
}

export interface PlannerAssessResponse {
  zone: {
    id: string;
    name: string;
    city: string;
    category: string;
    capacity: number;
    area_sqm: number;
  };
  verdict: 'feasible' | 'feasible_with_mitigations' | 'not_recommended';
  peak: {
    time: string;
    total_present: number;
    occupancy_ratio: number;
    density_per_sqm: number;
  };
  scenarios: Array<{
    label: string;
    attendance: number;
    peak_ratio: number;
    verdict: string;
  }>;
  timeline: Array<{
    time: string;
    baseline: number;
    event: number;
    total: number;
    ratio: number;
  }>;
  reasons: string[];
  mitigations: string[];
  alternatives: Array<{
    zone_id: string;
    name: string;
    peak_ratio: number;
    verdict: string;
  }>;
  assumptions: string[];
  disclaimer: string;
}
```

---

## 5. Master Venue IDs Reference Table

Use these exact IDs when calling `/zones/{id}`, `/forecast/{id}`, or `/planner/assess`:

| ID | Venue Name | Category | City | Status |
| :--- | :--- | :--- | :--- | :---: |
| `z1` | Main Gate Plaza | `public_square` | Gurugram | Live IoT Sensors |
| `z2` | Metro Concourse | `transit_hub` | Gurugram | Live IoT Sensors |
| `z3` | Market Street | `market` | Gurugram | Live IoT Sensors |
| `z4` | Food Court | `food_street` | Gurugram | Live IoT Sensors |
| `cd01` / `ch01` | Sector 17 Commercial Market | `market` | Chandigarh | Forecast Only |
| `cd02` / `ch02` | ISBT Sector 43 Concourse | `transit_hub` | Chandigarh | Forecast Only |
| `cd03` / `ch03` | Elante Mall Courtyard | `market` | Chandigarh | Forecast Only |
| `cd04` / `ch04` | Sector 17 Central Plaza | `public_square` | Chandigarh | Forecast Only |
| `cd05` / `ch05` | Sukhna Lake Promenade | `public_square` | Chandigarh | Forecast Only |
| `cd06` / `ch06` | Rock Garden Amphitheatre | `campus_ground` | Chandigarh | Forecast Only |
| `mo01` | Phase 3B2 Commercial Market | `market` | Mohali | Forecast Only |
| `mo02` | Phase 7 Market Plaza | `market` | Mohali | Forecast Only |
| `mo03` | PCA Cricket Stadium Forecourt | `campus_ground` | Mohali | Forecast Only |
| `mo04` | Phase 6 Civic Concourse | `transit_hub` | Mohali | Forecast Only |
| `rl01` | Gurudwara Nada Sahib Courtyard | `religious_site` | Panchkula | Forecast Only |
| `rl02` | ISKCON Temple Hare Krishna Complex | `religious_site` | Chandigarh | Forecast Only |
| `fs01` | Sector 8 Inner Food Street | `food_street` | Chandigarh | Forecast Only |
| `fs02` | Phase 5 Khau Gali Food Street | `food_street` | Mohali | Forecast Only |
| `gg01` | Cyber Hub Amphitheatre | `campus_ground` | Gurugram | Forecast Only |
| `gg02` | Leisure Valley Park Ground | `public_square` | Gurugram | Forecast Only |
| `gg03` | Sheetla Mata Mandir Complex | `religious_site` | Gurugram | Forecast Only |

