# CrowdGuard Tools & Demo Instruments

This directory contains live instruments for testing and demonstrating the **CrowdGuard** multi-signal early warning system.

---

## 1. Demo Beacon Simulator (`beacon_simulator.py`)

Used during live judging and rehearsals to simulate crowd density surges.

### Scenario A: Rapid Crowd Surge in Market Street (Zone z3)
Ramps device count from 40 to 520 over 2 minutes, posting every 3 seconds:
```bash
python tools/beacon_simulator.py --zone z3 --start 40 --peak 520 --minutes 2
```
*Result on Dashboard:* Within 30–60 seconds, Market Street (z3) triggers rate-of-change warnings (`crowd building rapidly`), moves from **NORMAL** -> **ELEVATED** -> **HIGH**, and generates an active alert.

### Scenario B: Steady Background Crowd
Holds a steady device count on another zone (e.g., Food Court):
```bash
python tools/beacon_simulator.py --zone z4 --steady 80 --interval 5
```

### Scenario C: Camera Disagreement Demonstration
If Person A's camera feed is obstructed or in a blind spot (showing low headcount, e.g. 50), run a high beacon count (e.g. 450):
```bash
python tools/beacon_simulator.py --zone z2 --steady 450
```
*Result:* Fusion catches the blind spot! The higher count wins, and the reason appears:
> *"camera and Bluetooth counts disagree, using the higher estimate"*

---

## 2. Live Hardware BLE Scanner (`ble_scanner.py`)

For live hardware demos using the computer's internal or USB Bluetooth adapter:
```bash
python tools/ble_scanner.py --zone z1 --interval 10
```

### Privacy & Ethics Guarantee:
- **Zero PII**: Hardware MAC addresses are immediately hashed using SHA-256 (truncated to 12 characters) in volatile memory and discarded.
- **Trend Detection**: Addresses are de-duplicated per scan window. Only aggregate device counts are transmitted.
