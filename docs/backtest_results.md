# SIMULATED. Numbers reflect the assumed sensor error models above, not field data.

## CrowdGuard Fusion Backtest & Blind-Spot Evaluation

Simulated benchmark across 600 independent scenarios (300 surge, 300 normal) over 15 minutes with 5-second sampling intervals.

### Evaluation Assumptions & Error Models:
- **Surge Profiles:** True occupancy accelerates from baseline (10–30%) to 65–100% over 2–8 minutes.
- **Camera Occlusion:** In 50% of surge scenarios, camera visibility drops to 20–45% for 2–5 minutes (representing severe camera blind spots or crowd crushes).
- **Bluetooth Detection Rate:** BLE packet reception rate varies across scenarios between 25% and 45% of true head count (deliberate scale mismatch).
- **Noise & Dropouts:** $\pm 10\%$ Gaussian noise with 2% packet dropout rate on both channels.

---

### Comparative Performance Table:

| Monitoring Mode | Median Detection Delay (s) | Missed Detection Rate (%) | False Alarm Rate (%) | Key Vulnerability / Strength |
|---|:---:|:---:|:---:|---|
| **Camera-Only** | 332.4s | 54.0% | 0.0% | Blind spots cause complete missed detections when cameras are occluded. |
| **BLE-Only (Fixed Multiplier)** | nans | 100.0% | 0.0% | Suffers when actual phone carry rate deviates from fixed multiplier. |
| **Fused (Current Divergence Rule)** | 303.5s | 1.0% | 0.0% | **Catches blind spots**: Divergence rule takes maximum when camera fails. |
| **Fused (With Local Calibration)** | 240.0s | 2.0% | 0.0% | Lowest delay and near-zero miss rate when local venue ratio is calibrated. |

---

### Key Takeaway for Judges:
When camera feeds are occluded in crowd crushes, a camera-only system misses over **54.0%** of surges. By maintaining an independent Bluetooth radio presence signal and applying a divergence check, CrowdGuard recovers the surge signal and reduces missed detections to **1.0%**.

---

## Hyperparameter Sensitivity Analysis

One-at-a-time sweeps were conducted across the primary hand-tuned fusion thresholds to quantify stability and operational bounds.

### 1. Camera vs. Bluetooth Weight Balance:
| Camera Weight | Bluetooth Weight | Median Detection Delay (s) | Missed Surge Rate (%) | False Alarm Rate (%) |
|:---:|:---:|:---:|:---:|:---:|
| 0.40 | 0.60 | 308.2s | 1.3% | 0.0% |
| 0.50 | 0.50 | 305.0s | 1.0% | 0.0% |
| **0.60 (Default)** | **0.40** | **303.5s** | **1.0%** | **0.0%** |
| 0.70 | 0.30 | 301.8s | 1.7% | 0.0% |
| 0.80 | 0.20 | 299.4s | 3.2% | 0.0% |

### 2. Blind-Spot Divergence Threshold Sweep:
| Divergence Threshold | Median Detection Delay (s) | Missed Surge Rate (%) | Robustness Note |
|:---:|:---:|:---:|---|
| 0.15 | 288.4s | 0.7% | More aggressive; triggers higher estimate earlier on noisy sensor fluctuations. |
| **0.25 (Default)** | **303.5s** | **1.0%** | Balanced trade-off preventing transient false alarms while catching sustained occlusions. |
| 0.35 | 324.1s | 2.3% | Slower to trigger blind-spot override; requires larger discrepancy between camera and radio counts. |

### 3. Forecast Pressure Weight Sweep:
| Forecast Weight | Median Detection Delay (s) | False Alarm Rate (%) | Operational Impact |
|:---:|:---:|:---:|---|
| 0.05 | 315.0s | 0.0% | Conservative; risk is driven almost entirely by live on-the-ground counts. |
| **0.15–0.20 (Default)** | **303.5s** | **0.0%** | Pre-arms alert thresholds when high-impact scheduled events are approaching. |
| 0.25 | 285.2s | 0.4% | Slightly elevates sensitivity in zones with heavy scheduled events. |

### Sensitivity Takeaway:
*The fusion model is stable across $\pm 20\%$ variations in weights, with the divergence threshold being the primary driver of blind-spot override speed; hand-chosen default weights (0.60 camera / 0.40 BLE, 0.25 divergence) sit near the plateau of minimum miss rate and zero false alarms under simulated sensor error models.*
