# CrowdGuard: Presentation Facts, Claims & Limitations

> **Document Status:** Authoritative facts and corrected claims guide for the CrowdGuard presentation and judge Q&A.  
> **Core Principle:** Total technical honesty. Real systems win on defensibility, accurate error bounds, and transparent trade-offs.

---

## 1. The One-Liner (Corrected)

> *"Existing crowd monitoring systems react only after a dangerous crowd has already formed. CrowdGuard predicts crowd build-up up to 48 hours in advance using scheduled city events and synthetic baseline models, then verifies conditions on the ground by fusing camera vision and Bluetooth beacon signals that compensate for each other's blind spots."*

---

## 2. Corrected Technical Claims (What to Say vs. What Not to Say)

| Dimension | ❌ Unsubstantiated / Inflated Claim | ✅ Defensible, Accurate Claim |
|---|---|---|
| **Fusion Architecture** | "Core intellectual property … deterministic proprietary equation" | **A transparent, tunable rule-based fusion model; weights are hand-chosen defaults with sensitivity backtesting.** |
| **Detection Speed** | "Sub-second detection / < 1 second response" | **Seconds to about 30 seconds in live operation (measured in benchmark: 5s to ELEVATED, ~30–55s to HIGH on full ramp).** |
| **Sensor Reliability** | "Blind-spot resistance: Excellent / Complete immunity" | **Reduces single-sensor blind spots by cross-verifying camera FOV against omnidirectional BLE radio packets.** |
| **Privacy & Compliance** | "Zero PII (SHA-256) / Fully compliant with global privacy directives" | **No facial recognition and no biometric storage. MAC addresses are salted and hashed on the local scanner, salt is rotated and never persisted. Hashed IDs are pseudonymous; no legal-compliance claims made without DPIA.** |
| **Forecasting Horizon** | "Predicts real-world stampedes 48 hours ahead" | **48-hour day-ahead occupancy trajectory, trained on synthetic baseline footfall data and scheduled city events.** |
| **Novelty Claim** | "Nobody fuses them / entirely unprecedented" | **We are not aware of an existing open system that fuses day-ahead event calendars with real-time camera and Bluetooth signals.** |
| **Cost & Deployment** | "₹50k+/unit commercial retrofit vs ₹300 BLE" | **Reuses existing CCTV infrastructure and low-cost off-the-shelf BLE beacons (~₹300–500/unit), avoiding specialized thermal hardware.** |

---

## 3. Benchmark Verification & Measured Demo Timings

Measured using `tools/demo_run.py` on Zone `z3` (Market Street, capacity: 900):

- **Blind-spot scenario:** Occluded camera vision reporting only 35 people (blind spot).
- **Bluetooth ramp:** Ingestion ramping from 40 to 600 devices over 60 seconds.
- **Time to first ELEVATED:** **~30.5 seconds** (Score $\ge 0.40$).
- **Time to first HIGH:** **~54.8 seconds** (Score $\ge 0.65$).
- **Rule trigger:** `camera and Bluetooth counts diverge (blind spot recovery)`.
- **System Alert Triggered:** **YES** (`/api/v1/risk/alerts` actively flags zone `z3`).

---

## 4. Fair Comparison with Industry Alternatives

| Approach | Where They Beat CrowdGuard | Where CrowdGuard Wins |
|---|---|---|
| **Commercial Wi-Fi / BLE Analytics** (e.g., Cisco Spaces, Purple WiFi) | Enterprise-grade hardware, proven MAC de-randomization heuristics, massive scale. | They do not integrate real-time computer vision or day-ahead municipal event calendars; primarily designed for marketing, not stampede safety. |
| **Google Popular Times / Telco Data** | Millions of live devices, city-scale coverage without deploying sensors. | Aggregated, delayed by 10–30 minutes, coarse spatial resolution (cannot detect a blocked doorway or bottleneck in a 20m corridor). |
| **Thermal CCTV / Stereo Vision** | Works in complete darkness, exact 3D spatial separation of overlapping individuals. | Prohibitive hardware and retrofit costs (often ₹50,000–₹2,00,000 per camera); cannot predict crowds before they arrive. |
| **CrowdGuard (Our System)** | Transparent open architecture, reuses standard RTSP/CCTV + inexpensive BLE, multi-horizon fusion (48h $\to$ seconds). | Relies on synthetic baseline data for new venues; BLE requires local device density calibration. |

---

## 5. Known Limitations (Honesty Section)

1. **Synthetic Training Data:**
   - The machine-learning forecast model is trained on procedurally generated synthetic footfall datasets (`footfall_train.csv`). It recovers synthetic generation rules and proves the multi-horizon pipeline architecture, but has not yet been fitted on multi-year municipal sensor archives.
2. **Camera Occlusion in Crushes:**
   - In extremely dense crowds ($>4\text{ people/m}^2$), optical detection degrades due to head/shoulder occlusion. This is specifically why Bluetooth radio presence is integrated as a secondary signal.
3. **Bluetooth MAC Randomization & BLE Ratio:**
   - Modern iOS and Android handsets rotate random BLE MAC addresses every 15 minutes. BLE device counts are treated as a relative surge indicator and directional trend proxy rather than an absolute head count.
4. **Held-Out Named Places:**
   - The 28 named venues across Delhi, Gurugram, Chandigarh, and Mohali (`ch01`–`ch03`, `dl04`–`dl08`, `gg01`–`gg06`, `cd01`–`cd06`, `mo01`–`mo04`, `rl01`–`rl02`, `fs01`–`fs02`) are forecast-only decision-support locations without live IoT sensors. Only `z1`–`z4` have live multi-modal sensor inputs.

---

## 6. The Event Planner (`POST /api/v1/planner/parse` & `/assess`)

- **Purpose:** Enables municipal authorities and event organizers to test: *"Is this proposed event feasible at this specific venue at this date and time?"*
- **Architecture:**
  1. **Free-Text Parser (`/planner/parse`):** Uses an LLM (Claude Haiku) or deterministic rule-based extractor to parse messy event descriptions into structured parameters (`zone_id`, `start_time`, `expected_attendance`, `event_type`, `draw_level`).
  2. **Feasibility Assessment (`/planner/assess`):** **100% deterministic and rule-based.** Evaluates baseline expected occupancy from historical patterns + event surge model, testing scenarios ($+0\%$, $+30\%$, $+60\%$).
- **Legal & Safety Disclaimer:**
  > *This tool provides computational decision support only. It is not an official municipal or fire safety clearance. Real-world events require formal police, disaster management, and local authority permits.*
