import React, { useState, useRef, useEffect } from 'react';
import type { VisionAnalyzeResponse, IncidentLogEntry } from '../types/crowdguard';
import type { UserProfile } from './LoginPage';
import { analyzeFrame, simulateVision, ingestBeacon, deescalateZone, resetAllZones } from '../services/api';
import { Upload, Radio, Camera, Zap, CheckCircle2, RotateCcw, TrendingDown, Lock, ShieldCheck } from 'lucide-react';

interface ControlPanelProps {
  zonesList: Array<{ id: string; name: string; capacity: number }>;
  onTelemetryUpdated: () => void;
  currentUser?: UserProfile | null;
  onLogIncident?: (entry: IncidentLogEntry) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  zonesList,
  onTelemetryUpdated,
  currentUser,
  onLogIncident,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>(zonesList[0]?.id || 'z1');
  const [visionCount, setVisionCount] = useState<number>(140);
  const [beaconCount, setBeaconCount] = useState<number>(140);
  const [uploading, setUploading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalyzeResponse | null>(null);

  const canOverride = currentUser ? currentUser.permissions.canOverrideSensors : true;
  const canDeescalate = currentUser ? currentUser.permissions.canDeescalate : true;

  const showFeedback = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const [demoStep, setDemoStep] = useState<number | null>(null);
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopPitchDemo = () => {
    demoTimersRef.current.forEach(clearTimeout);
    demoTimersRef.current = [];
    setDemoStep(null);
  };

  const runPitchDemo = async () => {
    stopPitchDemo();
    setSelectedZone('z3');

    // Step 1: Nominal Baseline
    setDemoStep(1);
    await deescalateZone('z3', 225);
    setVisionCount(225);
    setBeaconCount(225);
    onTelemetryUpdated();
    onLogIncident?.({
      id: `demo-${Date.now()}-1`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      zone_id: 'z3',
      zone_name: 'Market Street Corridor',
      tier: 'NORMAL',
      driver: 'Demo Script Step 1: Baseline nominal established (225 occupants)',
      risk_score: 0.25,
    });

    // Step 2: BLE Device Surge at 2.5s
    const t2 = setTimeout(async () => {
      setDemoStep(2);
      await ingestBeacon('z3', 720);
      setBeaconCount(720);
      onTelemetryUpdated();
      onLogIncident?.({
        id: `demo-${Date.now()}-2`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        zone_id: 'z3',
        zone_name: 'Market Street Corridor',
        tier: 'ELEVATED',
        previous_tier: 'NORMAL',
        driver: 'Demo Script Step 2: Transit ingress surge detected via BLE (+80% phones in arcade)',
        risk_score: 0.65,
      });
    }, 2500);

    // Step 3: Vision Confirms Choke Point Compression at 5.5s
    const t3 = setTimeout(async () => {
      setDemoStep(3);
      await simulateVision('z3', 780);
      setVisionCount(780);
      onTelemetryUpdated();
      onLogIncident?.({
        id: `demo-${Date.now()}-3`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        zone_id: 'z3',
        zone_name: 'Market Street Corridor',
        tier: 'HIGH',
        previous_tier: 'ELEVATED',
        driver: 'Demo Script Step 3: Optical Camera confirms high density at bottleneck choke point (86% cap)',
        risk_score: 0.84,
      });
    }, 5500);

    // Step 4: Tactical De-escalation & Resolution at 9.0s
    const t4 = setTimeout(async () => {
      setDemoStep(4);
      await deescalateZone('z3', 250);
      setVisionCount(250);
      setBeaconCount(250);
      onTelemetryUpdated();
      onLogIncident?.({
        id: `demo-${Date.now()}-4`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        zone_id: 'z3',
        zone_name: 'Market Street Corridor',
        tier: 'NORMAL',
        previous_tier: 'HIGH',
        driver: 'Demo Script Step 4: Commander ordered evacuation corridor opened; crowd dispersed safely',
        risk_score: 0.28,
      });
    }, 9000);

    // Finish script at 12.0s
    const t5 = setTimeout(() => {
      setDemoStep(null);
    }, 12000);

    demoTimersRef.current = [t2, t3, t4, t5];
  };

  useEffect(() => {
    return () => {
      demoTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canOverride) {
      showFeedback('Permission Denied: Your role does not have Sensor Override clearance');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await analyzeFrame(file, selectedZone);
      setAnalysisResult(res);
      showFeedback(`Camera frame analyzed: ${res.person_count} persons detected (${res.model_name})`);
      const targetZoneObj = zonesList.find(z => z.id === selectedZone) || zonesList[0];
      const ratio = res.person_count / targetZoneObj.capacity;
      const tier = ratio > 0.8 ? 'HIGH' : ratio > 0.5 ? 'ELEVATED' : 'NORMAL';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      onLogIncident?.({
        id: `inc-${Date.now()}`,
        timestamp: timeStr,
        zone_id: selectedZone,
        zone_name: targetZoneObj.name,
        tier,
        driver: `CCTV Optical Frame Ingest: ${res.person_count} persons detected via ${res.model_name} (Operator: ${currentUser?.name || 'Commander'})`,
        risk_score: Number((ratio * 0.9).toFixed(2)),
      });
      onTelemetryUpdated();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSimulateVision = async (countToPush: number = visionCount) => {
    if (!canOverride) {
      showFeedback('Permission Denied: Your role does not have Sensor Override clearance');
      return;
    }
    try {
      await simulateVision(selectedZone, countToPush);
      const targetZoneObj = zonesList.find(z => z.id === selectedZone) || zonesList[0];
      showFeedback(`Camera count updated to ${countToPush} for ${targetZoneObj.name}`);
      const ratio = countToPush / targetZoneObj.capacity;
      const tier = ratio > 0.8 ? 'HIGH' : ratio > 0.5 ? 'ELEVATED' : 'NORMAL';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      onLogIncident?.({
        id: `inc-${Date.now()}`,
        timestamp: timeStr,
        zone_id: selectedZone,
        zone_name: targetZoneObj.name,
        tier,
        driver: `Optical camera count adjusted to ${countToPush} (${Math.round(ratio * 100)}% capacity) by ${currentUser?.name || 'Commander'}`,
        risk_score: Math.min(0.99, Number((ratio * 0.9).toFixed(2))),
      });
      onTelemetryUpdated();
    } catch (err) {
      console.error('Vision simulation failed:', err);
    }
  };

  const handleInjectBeacon = async (countToPush: number = beaconCount) => {
    if (!canOverride) {
      showFeedback('Permission Denied: Your role does not have Sensor Override clearance');
      return;
    }
    try {
      await ingestBeacon(selectedZone, countToPush);
      const targetZoneObj = zonesList.find(z => z.id === selectedZone) || zonesList[0];
      showFeedback(`BLE device telemetry set to ${countToPush} for ${targetZoneObj.name}`);
      const ratio = countToPush / targetZoneObj.capacity;
      const tier = ratio > 0.85 ? 'CRITICAL' : ratio > 0.7 ? 'HIGH' : ratio > 0.45 ? 'ELEVATED' : 'NORMAL';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      onLogIncident?.({
        id: `inc-${Date.now()}`,
        timestamp: timeStr,
        zone_id: selectedZone,
        zone_name: targetZoneObj.name,
        tier,
        driver: `BLE RF surge telemetry: ${countToPush} devices detected (${Math.round(ratio * 100)}% density) by ${currentUser?.name || 'Commander'}`,
        risk_score: Math.min(0.99, Number((ratio * 0.95).toFixed(2))),
      });
      onTelemetryUpdated();
    } catch (err) {
      console.error('Beacon ingestion failed:', err);
    }
  };

  const handleDeescalate = async () => {
    if (!canDeescalate) {
      showFeedback('Permission Denied: Only Lead Incident Commanders can de-escalate zones');
      return;
    }
    try {
      const targetZoneObj = zonesList.find(z => z.id === selectedZone) || zonesList[0];
      const safeCount = Math.round(targetZoneObj.capacity * 0.28);
      await deescalateZone(selectedZone, safeCount);
      setVisionCount(safeCount);
      setBeaconCount(safeCount);
      showFeedback(`De-escalated ${targetZoneObj.name} to NORMAL (${safeCount} occupants)`);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      onLogIncident?.({
        id: `inc-${Date.now()}`,
        timestamp: timeStr,
        zone_id: selectedZone,
        zone_name: targetZoneObj.name,
        tier: 'NORMAL',
        previous_tier: 'HIGH',
        driver: `Tactical de-escalation ordered by ${currentUser?.name || 'Commander'} (egress corridors stabilized)`,
        risk_score: 0.28,
      });
      onTelemetryUpdated();
    } catch (err) {
      console.error('De-escalation failed:', err);
    }
  };

  const handleResetAll = async () => {
    if (!canDeescalate) {
      showFeedback('Permission Denied: Only Lead Incident Commanders can reset all zones');
      return;
    }
    try {
      await resetAllZones();
      showFeedback(`Reset all zones to NORMAL nominal baselines`);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      onLogIncident?.({
        id: `inc-${Date.now()}`,
        timestamp: timeStr,
        zone_id: 'all',
        zone_name: 'All Sectors',
        tier: 'NORMAL',
        driver: `Global baseline reset to NOMINAL by ${currentUser?.name || 'Commander'}`,
        risk_score: 0.24,
      });
      onTelemetryUpdated();
    } catch (err) {
      console.error('Reset all failed:', err);
    }
  };

  const currentZoneObj = zonesList.find((z) => z.id === selectedZone) || zonesList[0];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="var(--tier-elevated)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Live Telemetry & Demo Ingestion Panel
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Presenter controls to test escalation, de-escalation, and sensor discrepancy in real time.
          </p>
        </div>

        {/* RBAC Operator Clearance Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: canDeescalate ? 'var(--tier-normal-bg)' : 'var(--tier-elevated-bg)',
              border: `1px solid ${canDeescalate ? 'var(--tier-normal-border)' : 'var(--tier-elevated-border)'}`,
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: canDeescalate ? 'var(--tier-normal)' : 'var(--tier-elevated)',
              fontWeight: 600,
            }}
          >
            {canDeescalate ? <ShieldCheck size={14} /> : <Lock size={14} />}
            <span>
              {currentUser ? currentUser.name : 'Commander Session'} •{' '}
              <strong>{canDeescalate ? 'Tactical Actuators Unlocked' : canOverride ? 'Sensor Override Only (De-escalation Gated)' : 'Read-Only Mode'}</strong>
            </span>
          </div>

          {actionSuccess && (
            <div
              style={{
                backgroundColor: 'var(--tier-normal-bg)',
                border: '1px solid var(--tier-normal-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
                fontSize: '0.8rem',
                color: 'var(--tier-normal)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={15} />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>
      </div>

      {/* 1-Click Pitch Demo Scenario Runner */}
      <div
        style={{
          marginBottom: '18px',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: demoStep ? 'rgba(234, 88, 12, 0.08)' : 'var(--bg-surface-elevated)',
          border: `1.5px solid ${demoStep ? 'var(--tier-high)' : 'var(--border-subtle)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: demoStep ? 'var(--tier-high)' : 'var(--bg-surface)',
              color: demoStep ? '#ffffff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '0.88rem' }}>1-Click Pitch Demonstration Script</strong>
              {demoStep && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    backgroundColor: 'var(--tier-high-bg)',
                    color: 'var(--tier-high)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  STEP {demoStep} OF 4 ACTIVE
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {demoStep === 1 && 'Step 1/4: Reset to nominal calm baseline (Market Street, 25% capacity)'}
              {demoStep === 2 && 'Step 2/4: Bluetooth BLE device surge detected (+80% phones in transit arcade)'}
              {demoStep === 3 && 'Step 3/4: Optical Camera verifies dangerous compression at north bottleneck (HIGH)'}
              {demoStep === 4 && 'Step 4/4: Tactical de-escalation ordered by Commander; egress corridor cleared'}
              {!demoStep && 'Rehearsed automated demo sequence showcasing escalation, sensor discrepancy, and tactical resolution.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {demoStep ? (
            <button
              onClick={stopPitchDemo}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              Cancel Script
            </button>
          ) : (
            <button
              onClick={runPitchDemo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--tier-elevated-bg)',
                border: '1.5px solid var(--tier-elevated)',
                color: 'var(--tier-elevated)',
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 800,
                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.15)',
              }}
            >
              <Zap size={14} />
              <span>⚡ RUN 60-SEC PITCH DEMO SCENARIO</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Zone Selector & Reset Actions */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
            TARGET SECTOR FOR TELEMETRY INJECTION:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {zonesList.map((z) => (
              <button
                key={z.id}
                onClick={() => {
                  setSelectedZone(z.id);
                  setVisionCount(Math.round(z.capacity * 0.35));
                  setBeaconCount(Math.round(z.capacity * 0.35));
                }}
                style={{
                  backgroundColor: selectedZone === z.id ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: `1.5px solid ${selectedZone === z.id ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                  color: selectedZone === z.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: selectedZone === z.id ? 700 : 500,
                  transition: 'all var(--transition-fast)',
                }}
              >
                {z.name} (Cap: {z.capacity})
              </button>
            ))}
          </div>
        </div>

        {/* Global De-escalate & Reset controls (Gated by canDeescalate) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleDeescalate}
            disabled={!canDeescalate}
            title={canDeescalate ? 'De-escalate current zone to Normal status' : 'Requires Incident Commander Clearance (Locked for Analyst)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: canDeescalate ? 'var(--tier-normal-bg)' : 'var(--bg-surface)',
              border: `1px solid ${canDeescalate ? 'var(--tier-normal-border)' : 'var(--border-subtle)'}`,
              color: canDeescalate ? 'var(--tier-normal)' : 'var(--text-muted)',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: canDeescalate ? 'pointer' : 'not-allowed',
              fontSize: '0.82rem',
              fontWeight: 700,
              opacity: canDeescalate ? 1 : 0.6,
            }}
          >
            {canDeescalate ? <TrendingDown size={14} /> : <Lock size={14} />}
            <span>De-escalate Zone</span>
          </button>
          <button
            onClick={handleResetAll}
            disabled={!canDeescalate}
            title={canDeescalate ? 'Reset all zones to baseline Normal' : 'Requires Incident Commander Clearance'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: canDeescalate ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: canDeescalate ? 'var(--text-secondary)' : 'var(--text-muted)',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: canDeescalate ? 'pointer' : 'not-allowed',
              fontSize: '0.82rem',
              fontWeight: 600,
              opacity: canDeescalate ? 1 : 0.6,
            }}
          >
            {canDeescalate ? <RotateCcw size={14} /> : <Lock size={14} />}
            <span>Reset All Zones</span>
          </button>
        </div>
      </div>

      {/* 3 Main Action Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Panel 1: Image / Video Frame Upload */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Upload size={16} color="var(--text-primary)" />
              <strong style={{ fontSize: '0.9rem' }}>Upload CCTV Frame</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Upload an image to trigger optical density extraction via PyTorch / YOLO.
            </p>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                border: '1px dashed var(--border-active)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface)',
                cursor: !canOverride || uploading ? 'not-allowed' : 'pointer',
                color: canOverride ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
              title={canOverride ? undefined : 'Requires Tactical Sensor Override clearance'}
            >
              {!canOverride ? <Lock size={16} /> : <Upload size={16} />}
              <span>
                {!canOverride
                  ? 'Sensor Override Gated'
                  : uploading
                  ? 'Processing with YOLO...'
                  : 'Choose Camera Frame'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading || !canOverride}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {analysisResult && (
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <div>Detected: <strong className="num-tabular" style={{ color: 'var(--text-primary)' }}>{analysisResult.person_count}</strong> people</div>
              <div>Density: <span className="num-tabular">{analysisResult.density_per_sqm}</span> / m²</div>
              <div>Model: {analysisResult.model_name}</div>
            </div>
          )}
        </div>

        {/* Panel 2: Simulate Camera Vision Count (Up or Down) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Camera size={16} color="var(--text-primary)" />
              <strong style={{ fontSize: '0.9rem' }}>Set Optical Camera Count</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Manually set or decrease visual headcount for {currentZoneObj.name}.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                value={visionCount}
                onChange={(e) => setVisionCount(Number(e.target.value))}
                min={0}
                max={2000}
                disabled={!canOverride}
                className="num-tabular"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  width: '90px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  opacity: canOverride ? 1 : 0.6,
                }}
              />
              <button
                onClick={() => handleSimulateVision(visionCount)}
                disabled={!canOverride}
                title={canOverride ? undefined : 'Requires Sensor Override clearance'}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-active)',
                  color: canOverride ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  cursor: canOverride ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  opacity: canOverride ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {!canOverride && <Lock size={13} />}
                <span>Apply Count</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.25);
                setVisionCount(count);
                handleSimulateVision(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-normal-bg)',
                border: '1px solid var(--tier-normal-border)',
                color: 'var(--tier-normal)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Normal (25%)
            </button>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.6);
                setVisionCount(count);
                handleSimulateVision(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-elevated-bg)',
                border: '1px solid var(--tier-elevated-border)',
                color: 'var(--tier-elevated)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Elevated (60%)
            </button>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.85);
                setVisionCount(count);
                handleSimulateVision(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-high-bg)',
                border: '1px solid var(--tier-high-border)',
                color: 'var(--tier-high)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Surge (85%)
            </button>
          </div>
        </div>

        {/* Panel 3: Ingest Bluetooth BLE Device Count (Up or Down) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Radio size={16} color="var(--tier-elevated)" />
              <strong style={{ fontSize: '0.9rem' }}>Set Bluetooth BLE Count</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Test blind-spot surges or de-escalate RF phone presence.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                value={beaconCount}
                onChange={(e) => setBeaconCount(Number(e.target.value))}
                min={0}
                max={2000}
                disabled={!canOverride}
                className="num-tabular"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  width: '90px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  opacity: canOverride ? 1 : 0.6,
                }}
              />
              <button
                onClick={() => handleInjectBeacon(beaconCount)}
                disabled={!canOverride}
                title={canOverride ? undefined : 'Requires Sensor Override clearance'}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--tier-elevated-border)',
                  color: canOverride ? 'var(--tier-elevated)' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  cursor: canOverride ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  opacity: canOverride ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {!canOverride && <Lock size={13} />}
                <span>Apply BLE</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.25);
                setBeaconCount(count);
                handleInjectBeacon(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-normal-bg)',
                border: '1px solid var(--tier-normal-border)',
                color: 'var(--tier-normal)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Normal (25%)
            </button>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.78);
                setBeaconCount(count);
                handleInjectBeacon(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-high-bg)',
                border: '1px solid var(--tier-high-border)',
                color: 'var(--tier-high)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Surge (+78%)
            </button>
            <button
              onClick={() => {
                const count = Math.round(currentZoneObj.capacity * 0.95);
                setBeaconCount(count);
                handleInjectBeacon(count);
              }}
              disabled={!canOverride}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-critical-bg)',
                border: '1px solid var(--tier-critical-border)',
                color: 'var(--tier-critical)',
                cursor: canOverride ? 'pointer' : 'not-allowed',
                fontWeight: 700,
                opacity: canOverride ? 1 : 0.6,
              }}
            >
              Critical (95%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
