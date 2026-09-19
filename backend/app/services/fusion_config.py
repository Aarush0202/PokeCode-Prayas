"""CrowdGuard fusion tuning constants and configuration.
All parameters represent tunable heuristics (defaults hand-chosen and calibrated).
A's sensitivity and backtest scripts import these constants directly.
"""
import os

# Signal blending weights
WEIGHT_CAMERA: float = float(os.getenv("WEIGHT_CAMERA", "0.60"))  # tunable heuristic, default hand-chosen
WEIGHT_BEACON: float = float(os.getenv("WEIGHT_BEACON", "0.40"))  # tunable heuristic, default hand-chosen

# Blind spot divergence threshold between camera and BLE occupancy ratios
DIVERGENCE_THRESHOLD: float = float(os.getenv("DIVERGENCE_THRESHOLD", "0.25"))  # tunable heuristic, default hand-chosen

# Surge rate-of-change bonus
RATE_WINDOW_SECONDS: float = 60.0  # tunable heuristic, default hand-chosen
RATE_RISING_THRESHOLD: float = 0.10  # 10% occupancy increase per minute
RATE_BONUS: float = 0.15  # tunable heuristic, default hand-chosen

# Directional flow bottleneck bonus
FLOW_THRESHOLD: float = 0.40  # optical flow magnitude threshold, tunable heuristic
FLOW_BONUS: float = 0.05  # flow penalty bonus, tunable heuristic

# Final score component weights
WEIGHT_OCCUPANCY: float = 0.70  # tunable heuristic, default hand-chosen
WEIGHT_FORECAST: float = 0.15  # 15% weight per specification, tunable heuristic

# Staleness horizon
STALENESS_SECONDS: float = 120.0  # signals older than 2 minutes are marked stale

# Risk tier thresholds
THRESHOLD_ELEVATED: float = 0.40  # tunable heuristic, default hand-chosen
THRESHOLD_HIGH: float = 0.65  # tunable heuristic, default hand-chosen
THRESHOLD_CRITICAL: float = 0.85  # tunable heuristic, default hand-chosen

# IoT beacon penetration multiplier
BEACON_MULTIPLIER: float = float(os.getenv("BEACON_MULTIPLIER", "1.6"))  # regional mobile penetration factor

# BLE Dynamic Calibration parameters (EWMA)
CALIBRATION_ALPHA: float = 0.1  # smoothing factor for EWMA
CALIBRATION_MIN_SCALE: float = 0.3  # minimum clamped scale
CALIBRATION_MAX_SCALE: float = 5.0  # maximum clamped scale
CALIBRATION_MIN_COUNT: int = 20  # minimum sample count for valid calibration update
