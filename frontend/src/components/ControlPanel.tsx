import React, { useState } from 'react';
import type { VisionAnalyzeResponse } from '../types/crowdguard';
import { analyzeFrame, simulateVision, ingestBeacon, deescalateZone, resetAllZones } from '../services/api';
import { Upload, Radio, Camera, Zap, CheckCircle2, RotateCcw, TrendingDown } from 'lucide-react';

interface ControlPanelProps {
  zonesList: Array<{ id: string; name: string; capacity: number }>;
  onTelemetryUpdated: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  zonesList,
  onTelemetryUpdated,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>(zonesList[0]?.id || 'z1');
  const [visionCount, setVisionCount] = useState<number>(140);
  const [beaconCount, setBeaconCount] = useState<number>(140);
  const [uploading, setUploading] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalyzeResponse | null>(null);

  const showFeedback = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await analyzeFrame(file, selectedZone);
      setAnalysisResult(res);
      showFeedback(`Camera frame analyzed: ${res.person_count} persons detected (${res.model_name})`);
      onTelemetryUpdated();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSimulateVision = async (countToPush: number = visionCount) => {
    try {
      await simulateVision(selectedZone, countToPush);
      showFeedback(`Camera count updated to ${countToPush} for ${zonesList.find(z => z.id === selectedZone)?.name}`);
      onTelemetryUpdated();
    } catch (err) {
      console.error('Vision simulation failed:', err);
    }
  };

  const handleInjectBeacon = async (countToPush: number = beaconCount) => {
    try {
      await ingestBeacon(selectedZone, countToPush);
      showFeedback(`BLE device telemetry set to ${countToPush} for ${zonesList.find(z => z.id === selectedZone)?.name}`);
      onTelemetryUpdated();
    } catch (err) {
      console.error('Beacon ingestion failed:', err);
    }
  };

  const handleDeescalate = async () => {
    try {
      const targetZoneObj = zonesList.find(z => z.id === selectedZone) || zonesList[0];
      const safeCount = Math.round(targetZoneObj.capacity * 0.28);
      await deescalateZone(selectedZone, safeCount);
      setVisionCount(safeCount);
      setBeaconCount(safeCount);
      showFeedback(`De-escalated ${targetZoneObj.name} to NORMAL (${safeCount} occupants)`);
      onTelemetryUpdated();
    } catch (err) {
      console.error('De-escalation failed:', err);
    }
  };

  const handleResetAll = async () => {
    try {
      await resetAllZones();
      showFeedback(`Reset all zones to NORMAL nominal baselines`);
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

        {actionSuccess && (
          <div
            style={{
              backgroundColor: 'var(--tier-normal-bg)',
              border: '1px solid var(--tier-normal-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.82rem',
              color: 'var(--tier-normal)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}
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

        {/* Global De-escalate & Reset controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleDeescalate}
            title="De-escalate current zone to Normal status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--tier-normal-bg)',
              border: '1px solid var(--tier-normal-border)',
              color: 'var(--tier-normal)',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            <TrendingDown size={14} />
            <span>De-escalate Zone</span>
          </button>
          <button
            onClick={handleResetAll}
            title="Reset all zones to baseline Normal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={14} />
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
                cursor: uploading ? 'not-allowed' : 'pointer',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <Upload size={16} />
              <span>{uploading ? 'Processing with YOLO...' : 'Choose Camera Frame'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
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
                }}
              />
              <button
                onClick={() => handleSimulateVision(visionCount)}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-active)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Apply Count
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-normal-bg)',
                border: '1px solid var(--tier-normal-border)',
                color: 'var(--tier-normal)',
                cursor: 'pointer',
                fontWeight: 600,
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-elevated-bg)',
                border: '1px solid var(--tier-elevated-border)',
                color: 'var(--tier-elevated)',
                cursor: 'pointer',
                fontWeight: 600,
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-high-bg)',
                border: '1px solid var(--tier-high-border)',
                color: 'var(--tier-high)',
                cursor: 'pointer',
                fontWeight: 600,
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
                }}
              />
              <button
                onClick={() => handleInjectBeacon(beaconCount)}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--tier-elevated-border)',
                  color: 'var(--tier-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                Apply BLE
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-normal-bg)',
                border: '1px solid var(--tier-normal-border)',
                color: 'var(--tier-normal)',
                cursor: 'pointer',
                fontWeight: 600,
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-high-bg)',
                border: '1px solid var(--tier-high-border)',
                color: 'var(--tier-high)',
                cursor: 'pointer',
                fontWeight: 600,
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
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tier-critical-bg)',
                border: '1px solid var(--tier-critical-border)',
                color: 'var(--tier-critical)',
                cursor: 'pointer',
                fontWeight: 700,
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
