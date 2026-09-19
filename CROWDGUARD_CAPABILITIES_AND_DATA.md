# CrowdGuard: System Capabilities, Features & Data Specification

**Project:** CrowdGuard — Stampede Early-Warning & Crowd Density Prediction System  
**Event:** Prayas Hackathon  
**Target Domain:** Public Safety, Smart Cities, Transit Hubs, Event Management  

---

## 1. Executive Overview

CrowdGuard is an intelligent public-safety intelligence platform designed to prevent crowd surges and stampedes before they reach catastrophic levels. 

Unlike traditional security systems that merely react to crowds that have already gathered, CrowdGuard operates on two distinct horizons:
1. **Predictive Horizon (Hours to Days):** Forecasts where crowds will build using municipal event schedules, transit timetables, and weather forecasts.
2. **Real-Time Ground-Truth Horizon (Seconds):** Fuses optical camera feeds (YOLOv8) with Bluetooth Low Energy (BLE) radio frequency beacons to cover mutual blind spots, calculate surge velocity, and detect directional bottlenecks.

---

## 2. Complete Feature Matrix

| Feature | Category | Description | Primary Value |
| :--- | :--- | :--- | :--- |
| **Real-Time Headcount (CCTV)** | Vision | YOLOv8n object detection tuned for pedestrian counting. | High-precision visual census in line-of-sight areas. |
| **Directional Flow Analysis** | Vision | Farneback dense optical flow vector analysis. | Detects counter-directional crowd movement and bottlenecks before physical crush happens. |
| **BLE Density Estimation** | Radio / IoT | High-speed BLE advertisement packet listener. | Counts active mobile devices; penetrates smoke, darkness, corners, and obstructed areas. |
| **Blind-Spot Disagreement Arbiter** | Fusion Engine | Compares camera vs. BLE occupancy. If divergence $>25\%$, selects $\max(\text{camera}, \text{ble})$. | Prevents false negatives when CCTV cameras are blocked, tilted, or vandalized. |
| **Surge Velocity Detector** | Fusion Engine | Monitors 60-second rolling window rate-of-change ($d\text{Occupancy}/dt$). | Flags rapid surges ($>10\%/\text{min}$) with $+0.15$ risk penalty before capacity is breached. |
| **Directional Bottleneck Penalty** | Fusion Engine | Evaluates vector turbulence from optical flow. | Adds $+0.05$ risk penalty when opposing flows threaten turbulence. |
| **48-Hour Predictive Forecaster** | Machine Learning | Gradient boosting / Random Forest ML regression trained on venue event calendars. | Gives municipal authorities up to 48 hours to position crowd-control barricades and security staff. |
| **Automated Explainability Engine** | Alerting | Generates plain-English root-cause explanations for every risk level. | Operators instantly know *why* an alert fired without interpreting raw telemetry. |
| **Tiered Early Warning Alerts** | Dashboard | 4-tier risk classification: `NORMAL`, `ELEVATED`, `HIGH`, `CRITICAL`. | Triggers visual banners, audible cues, and dispatcher protocols. |
| **Hardware-Independent Simulator** | Testing / Demo | CLI tool that simulates custom crowd ramps, steady-state flows, and rapid rushes. | Enables flawless hackathon demos and stress-testing without physical crowds. |
| **Zero-PII Privacy Shield** | Security | Cryptographic hashing of MAC addresses (SHA-256 truncated to 12 chars). | Complete GDPR and DPDP compliance; zero human identification. |

---

## 3. What CrowdGuard CAN Do (Capabilities)

### Real-Time Ground Truth & Sensor Fusion
- **Detect crowd surges in under 1 second:** Processes camera frames and BLE bursts continuously to update zone risk in real time.
- **Overcome visual occlusion & darkness:** In conditions where cameras fail (night, smoke, glare, crowds behind walls or columns), BLE signals penetrate physical barriers to maintain situational awareness.
- **Detect sudden stampede formation:** Computes instantaneous velocity of crowd growth. A zone jumping from 100 to 300 people in 60 seconds triggers emergency escalation even if the zone capacity is 1,000.
- **Identify turbulent opposing flows:** Distinguishes between uniform crowd movement (safe) and opposing counter-flows or stagnation points (high stampede risk).
- **Gracefully degrade across partial sensor outages:**
  - If Camera goes down $\to$ runs on BLE + Forecast.
  - If BLE goes down $\to$ runs on Camera + Forecast.
  - If both sensors go down $\to$ falls back to Forecast baseline and flags an urgent sensor telemetry warning.
  - Stale readings older than 120 seconds are automatically purged.

### Forecasting & Planning
- **Predict crowd buildup 48 hours in advance:** Ingests municipal event schedules (concerts, cricket matches, political rallies) to model the expected crowd buildup curve.
- **Model transit & weather amplification:** Models how rain shifts crowds from outdoor plazas into covered metro concourses and shopping arcades.

### Operator Experience & Actionability
- **Provide clear, unambiguous operational tiers:**
  - **NORMAL ($0.00 - 0.39$):** Green. Routine pedestrian flow.
  - **ELEVATED ($0.40 - 0.64$):** Yellow. Pre-position staff; open supplementary exit corridors.
  - **HIGH ($0.65 - 0.84$):** Orange. Divert entry gates; trigger automated public address announcements.
  - **CRITICAL ($\ge 0.85$):** Red. Emergency evacuation protocols; halt incoming transit access.
- **Deliver automated plain-language explanations:** e.g., *"Market Street at ELEVATED risk — 832 people estimated against a 900 capacity. Camera and Bluetooth counts disagree, using the higher estimate. Crowd building rapidly."*

---

## 4. What CrowdGuard CANNOT Do (Limitations & Boundaries)

To maintain technical integrity and ethical compliance, the system has the following deliberate design boundaries:

### 1. No Facial Recognition or Individual Identification
- **Cannot recognize faces or track specific individuals:** CrowdGuard does not use facial recognition models, does not compute facial embeddings, and does not retain biometric data.
- **Cannot store personal video footage:** Video frames are processed in volatile memory (RAM) for bounding-box counting and immediately discarded.

### 2. No Tracking of Non-Device Holders in Total Blind Spots
- If a person carries no Bluetooth/WiFi-enabled device (e.g., phone, smartwatch) **AND** is located in an area with zero camera visibility (e.g., an unmonitored blind stairwell), the system cannot count that specific individual. 
- *Mitigation:* CrowdGuard applies a regional smartphone penetration multiplier ($1.6\times$ based on urban telemetry standards) to estimate true crowd size from raw BLE pings.

### 3. Cannot Predict Unannounced, Spontaneous Flash Mobs Days Ahead
- The **48-Hour Forecaster** relies on scheduled event data, permits, and historical attendance patterns. It cannot predict spontaneous riots, flash mobs, or unpermitted street gatherings days in advance.
- *Mitigation:* The moment people begin assembling on the ground, the **Real-Time Camera and BLE Fusion Engine** detects the surge within seconds and triggers the live alert banner.

### 4. No Direct Autonomous Physical Actuation (Human-in-the-Loop)
- CrowdGuard **does not autonomously lock doors, drop emergency gates, or alter railway signals** without operator confirmation.
- *Reasoning:* Autonomous gate locking during a panic can create lethal crush points. CrowdGuard provides immediate recommendations to trained human security officers who execute emergency protocols.

### 5. Requires Edge Compute / Network Connectivity
- YOLOv8 visual inference cannot run directly on ₹100 microcontrollers (ESP32). It requires an edge gateway (NVIDIA Jetson, mini-PC) or a central server receiving RTSP video streams.

---

## 5. Data Sources & Schemas Used

CrowdGuard leverages four distinct data streams:

```
+-----------------------------------------------------------------------------------------------+
|                                      DATA FLOW ARCHITECTURE                                   |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|  1. CCTV VIDEO STREAMS        2. BLE RADIO PACKETS       3. MUNICIPAL EVENTS    4. WEATHER    |
|     (RTSP / Video Frames)        (2.4 GHz RF / RSSI)        (JSON / Calendar)      (REST API) |
|               |                           |                        |                    |     |
|               v                           v                        v                    v     |
|     [ YOLOv8n + Flow ]          [ SHA-256 Hashing ]       [ 48h ML Regressor ]  [ Modifiers ] |
|               \                           /                        |                    /     |
|                \                         /                         |                   /      |
|                 v                       v                          v                  v       |
|               +----------------------------+             +-------------------------------+    |
|               |  Real-Time Sensor Buffer   |             |    Pre-Calculated Pressure    |    |
|               +----------------------------+             +-------------------------------+    |
|                              \                                          /                     |
|                               \                                        /                      |
|                                v                                      v                       |
|                             +--------------------------------------------+                    |
|                             |      MULTI-SIGNAL FUSION ALGORITHM         |                    |
|                             +--------------------------------------------+                    |
|                                                   |                                           |
|                                                   v                                           |
|                             +--------------------------------------------+                    |
|                             |  Unified Zone Risk (0.0 - 1.0) & Alerts    |                    |
|                             +--------------------------------------------+                    |
+-----------------------------------------------------------------------------------------------+
```

### Data Stream 1: CCTV Visual Feeds
- **Source:** Municipal IP cameras, RTSP streams, or recorded test frames (`tools/sample_frames/`).
- **Data Extracted:**
  - `person_count`: Integer count of detected humans (COCO Class 0, confidence $>0.35$).
  - `flow_vector_x`, `flow_vector_y`: Average pixel displacement vector $(\Delta x, \Delta y)$ between consecutive frames.
  - `flow_magnitude`: $\sqrt{\Delta x^2 + \Delta y^2} \in [0.0, 1.0]$.
  - `flow_direction`: Angular trajectory ($0^\circ - 360^\circ$).
- **Storage:** Ephemeral; processed in RAM and dropped. Zero video files stored to disk.

### Data Stream 2: Bluetooth Low Energy (BLE) Signals
- **Source:** Raspberry Pi / Linux BLE scanners (`tools/ble_scanner.py`) or virtual ramp simulators (`tools/beacon_simulator.py`).
- **Data Extracted:**
  - `unique_devices`: Count of unique BLE advertisement MAC addresses heard within a 60-second window.
  - `rssi`: Received Signal Strength Indicator (filtered to $\ge -80\text{ dBm}$ to exclude devices outside the zone perimeter).
  - `estimated_people`: $\text{unique\_devices} \times 1.6$ (penetration calibration factor).
- **Privacy Handling:**
  - Every MAC address is hashed: $\text{Hash} = \text{SHA256}(\text{MAC} + \text{Salt})[:12]$.
  - No raw hardware identifiers ever leave the local scanning device.

### Data Stream 3: Municipal Events & Calendar Data
- **Source:** PredictHQ API integration + realistic urban calendar (`backend/app/services/event_fetcher.py`).
- **Data Schema:**
  - `title`: Name of the event (e.g., "Premier League Derby", "Diwali Mela", "Metro Maintenance Closure").
  - `category`: `sports`, `concert`, `festival`, `conference`, `transit`.
  - `expected_attendance`: Expected turnout (e.g., $15,000$).
  - `start_time`, `end_time`: ISO 8601 UTC timestamps.
  - `location`: GPS coordinate and impacted zone tags (`z1`, `z2`, `z3`, `z4`).

### Data Stream 4: Environmental & Spatial Data
- **Weather Metrics:** Precipitation (mm/hr), temperature (°C), severe weather alerts.
- **Zone Topology Configuration:**
  - `z1`: **Main Gate Plaza** (Outdoor, Capacity: 400 people)
  - `z2`: **Metro Concourse** (Underground Transit, Capacity: 650 people)
  - `z3`: **Market Street** (Narrow Pedestrian Corridor, Capacity: 900 people)
  - `z4`: **Food Court** (Enclosed Dining Hall, Capacity: 300 people)

### Data Stream 5: Empirical Transit Benchmarks (Delhi Metro Rail Corporation)
- **Source:** DMRC Official Passenger Journey Records (2010–2022).
- **Macro Calibration Figures:**
  - Annual network volume: 81 Cr rides (2010) scaling to ~1,000+ Cr rides (2017).
  - Pre-COVID peak: **50.65 Lakh (5.065 million) daily passenger journeys**.
  - Normalization: 41.21 Lakh daily passenger journeys (June 2022).
- **Application in CrowdGuard:**
  - Directly parameterizes the `transit_hub` venue category in the ML generator (`tools/generate_training_data.py`) and explainability engine (`backend/app/services/forecaster.py`).
  - Models empirical rush-hour dual peaks (08:00–10:00 morning office commute at ~74% capacity, 17:00–20:00 evening return rush at ~80% capacity) and quarterly seasonal distributions (Q1: 24.1%, Q2: 24.4%, Q3: 26.1% monsoon/academic surge, Q4: 25.4% festive rush).
  - Supplies empirical ground truth for hackathon judging and the CrowdGuard Honesty Rule.

---

## 6. The Mathematical Fusion Model

The core intellectual property of CrowdGuard is its deterministic, auditable multi-signal fusion equation:

### 1. Occupancy Estimation
$$\Delta_{\text{divergence}} = \frac{|C_{\text{cam}} - C_{\text{ble}}|}{\text{Capacity}}$$

$$\text{LiveOccupancy} = \begin{cases} 
\max(C_{\text{cam}}, C_{\text{ble}}) & \text{if } \Delta_{\text{divergence}} > 0.25 \quad (\text{Blind-Spot Rule}) \\
0.60 \cdot C_{\text{cam}} + 0.40 \cdot C_{\text{ble}} & \text{if both signals available and agree} \\
C_{\text{cam}} & \text{if BLE is offline} \\
C_{\text{ble}} & \text{if Camera is offline} \\
0 & \text{if all sensors offline (stale $>120\text{s}$)}
\end{cases}$$

### 2. Base Risk Calculation
$$\text{BaseRisk} = \frac{\text{LiveOccupancy}}{\text{Capacity}}$$

### 3. Dynamic Bonuses & Penalties
- **Surge Rate Penalty ($B_{\text{surge}}$):**
  If $\frac{d(\text{Occupancy})}{dt} > 10\%/\text{min}$, then $B_{\text{surge}} = +0.15$
- **Bottleneck Flow Penalty ($B_{\text{flow}}$):**
  If $\text{flow\_magnitude} > 0.40$, then $B_{\text{flow}} = +0.05$
- **Forecast Pressure Factor ($P_{\text{forecast}}$):**
  Calculated by the ML model based on upcoming events: $P_{\text{forecast}} \in [0.0, 1.0]$. Weighted at $15\%$.

### 4. Final Fused Risk Score
$$\text{FinalRisk} = \min\Big(1.0, \; \text{BaseRisk} + B_{\text{surge}} + B_{\text{flow}} + (0.15 \cdot P_{\text{forecast}})\Big)$$

---

## 7. Comparative Analysis: CrowdGuard vs. Existing Solutions

| Solution | Detection Speed | Blind Spot Resistance | Future Prediction | Privacy / PII Risk | Hardware Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Traditional CCTV + Guards** | Minutes to Hours | ❌ Very Poor (obstructed by signs/smoke) | ❌ None | ⚠️ High (faces recorded) | High |
| **Turnstile Counting** | Seconds | ❌ Only counts entries, misses internal surges | ❌ None | ✅ Good | High |
| **Thermal Sensors** | Seconds | ⚠️ Medium (blocked by walls/smoke) | ❌ None | ✅ Good | Very High (₹50k+/unit) |
| **Cell Tower Data (Telco)**| 15–60 Minutes | ✅ Good | ⚠️ Coarse | ⚠️ Medium | Recurring enterprise cost |
| **CrowdGuard (Our System)**| **$< 1$ Second** | **✅ Excellent (Camera + BLE fusion)** | **✅ Up to 48 Hours Ahead** | **✅ Zero PII (SHA-256)** | **Ultra-Low Cost (uses existing CCTV + ₹300 BLE)** |

---

## 8. Summary for Presentation & Evaluation

- **Code Repository:** `git@github.com:Aarush0202/PokeCode-Prayas.git`
- **Testing Standard:** 35 / 35 automated pytest tests passing (100%).
- **Frontend Stack:** React 19, TypeScript, Vite, Recharts, Tailwind/Vanilla CSS.
- **Backend Stack:** FastAPI, Uvicorn, Pydantic v2, Scikit-Learn, Joblib, Farneback Optical Flow.
- **Privacy Standard:** Zero PII storage; fully compliant with global privacy directives.
