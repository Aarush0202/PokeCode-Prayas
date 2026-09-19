import React from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { Camera, Radio, Cpu, ArrowRight, ShieldCheck, AlertTriangle, TrendingUp, AlertCircle } from 'lucide-react';

interface SignalBreakdownProps {
  zone: ZoneRisk | null;
}

export const SignalBreakdown: React.FC<SignalBreakdownProps> = ({ zone }) => {
  if (!zone) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)',
        }}
      >
        Select a zone above to inspect live sensor fusion and signal correlation.
      </div>
    );
  }

  const isForecastOnly =
    zone.has_live_signals === false ||
    zone.signal_status === 'none' ||
    !['z1', 'z2', 'z3', 'z4'].includes(zone.zone_id);

  const isNoData =
    !isForecastOnly &&
    (zone.signal_status === 'stale' ||
      zone.level === 'no_data' ||
      zone.level === 'NO_DATA' ||
      zone.risk_tier === 'no_data' ||
      zone.risk_tier === 'NO_DATA');

  const cameraCount = zone.vision?.person_count ?? 0;
  const bleCount = zone.beacon?.unique_devices ?? 0;
  const countDiff = Math.abs(cameraCount - bleCount);
  const significantDisagreement =
    !isForecastOnly &&
    !isNoData &&
    countDiff > 25 &&
    countDiff / Math.max(1, cameraCount) > 0.15;
  const bleIsHigher = bleCount > cameraCount;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--text-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Multimodal Sensor Fusion: {zone.zone_name}
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Cross-verifying optical computer vision against RF beacon telemetry to eliminate blind spots.
          </p>
        </div>

        {isForecastOnly ? (
          <span
            className="tier-badge tier-no_data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <TrendingUp size={12} />
            FORECAST ONLY
          </span>
        ) : isNoData ? (
          <span
            className="tier-badge tier-no_data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Radio size={12} />
            SENSORS OFFLINE
          </span>
        ) : (
          <span className={`tier-badge tier-${zone.risk_tier}`}>
            {zone.risk_tier} (Score: {(zone.risk_score * 100).toFixed(0)})
          </span>
        )}
      </div>

      {/* Forecast Only Notice Banner */}
      {isForecastOnly && (
        <div
          role="note"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1.5px dashed var(--border-active)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <TrendingUp size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Forecast only. No live sensors at this location.
            </strong>
            This held-out venue is uninstrumented (no optical CCTV or BLE hardware). Ground-truth occupancy and live risk scores are not computed for named places. Refer to the <strong>Predictive Forecast (48h)</strong> or <strong>Event Planner</strong> tab for crowd projections.
          </div>
        </div>
      )}

      {/* Sensor Offline Notice Banner */}
      {isNoData && (
        <div
          role="note"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1.5px dashed var(--border-active)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <AlertCircle size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Sensors Offline (&gt;120s Stale Telemetry)
            </strong>
            Camera and Bluetooth sensor feeds have timed out. Per safety doctrine, stale feeds never default to green NORMAL or zero risk. Occupancy numbers are suppressed until the sensor gateway reconnects.
          </div>
        </div>
      )}

      {/* Disagreement Callout Banner (only for active live zones) */}
      {significantDisagreement && (
        <div
          role="note"
          style={{
            backgroundColor: 'var(--tier-elevated-bg)',
            border: '1px solid var(--tier-elevated-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} color="var(--tier-elevated)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.86rem', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--tier-elevated)', display: 'block', marginBottom: '2px' }}>
              Sensor Discrepancy Detected ({countDiff} person differential)
            </strong>
            {bleIsHigher ? (
              <span>
                Bluetooth detects <strong>{bleCount}</strong> active devices while camera vision registers only <strong>{cameraCount}</strong>.
                The fusion engine determined a probable <strong>camera blind spot or obstruction</strong> and trusted the higher count of <strong>{zone.fused_estimate}</strong> to prevent unmonitored stampede risks.
              </span>
            ) : (
              <span>
                Camera optical count (<strong>{cameraCount}</strong>) exceeds Bluetooth beacon detections (<strong>{bleCount}</strong>).
                Using optical verification upper bound of <strong>{zone.fused_estimate}</strong>.
              </span>
            )}
          </div>
        </div>
      )}

      {/* The 3 Columns: Camera, Bluetooth, Fused Verdict */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          alignItems: 'stretch',
        }}
      >
        {/* Column 1: Camera Vision */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            opacity: isForecastOnly ? 0.45 : isNoData ? 0.65 : 1.0,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Camera size={16} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Optical Vision (CCTV)</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {isForecastOnly ? 'No camera installed' : isNoData ? 'Stream timed out' : 'PyTorch / YOLOv11 Headcount'}
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 800 }} className="num-tabular">
              {isForecastOnly || isNoData ? '—' : zone.vision ? zone.vision.person_count : '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isForecastOnly ? 'Uninstrumented location' : isNoData ? 'Telemetry offline' : 'Observed in camera FOV'}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '10px',
              marginTop: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            {isForecastOnly ? (
              <div>Status: <span style={{ color: 'var(--text-muted)' }}>Hardware absent</span></div>
            ) : isNoData ? (
              <div>Status: <span style={{ color: 'var(--tier-elevated)' }}>Signal lost (&gt;120s)</span></div>
            ) : (
              <>
                <div>Density: <span className="num-tabular" style={{ color: 'var(--text-primary)' }}>{zone.vision?.density_per_sqm ?? 0}</span> / m²</div>
                <div>Confidence: <span className="num-tabular" style={{ color: 'var(--text-primary)' }}>{((zone.vision?.confidence ?? 0.9) * 100).toFixed(0)}%</span></div>
                {zone.vision?.flow && (
                  <div>Flow velocity: <span className="num-tabular" style={{ color: 'var(--text-primary)' }}>{zone.vision.flow.magnitude.toFixed(2)} m/s</span></div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 2: Bluetooth Telemetry */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            opacity: isForecastOnly ? 0.45 : isNoData ? 0.65 : 1.0,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Radio size={16} color="var(--text-secondary)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Bluetooth BLE Telemetry</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {isForecastOnly ? 'No BLE gateway' : isNoData ? 'Receiver disconnected' : 'Omnidirectional RF Scanner'}
            </div>

            <div style={{ fontSize: '2.2rem', fontWeight: 800 }} className="num-tabular">
              {isForecastOnly || isNoData ? '—' : zone.beacon ? zone.beacon.unique_devices : '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isForecastOnly ? 'Uninstrumented location' : isNoData ? 'Telemetry offline' : 'Unique phones in sector'}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '10px',
              marginTop: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            {isForecastOnly ? (
              <div>Status: <span style={{ color: 'var(--text-muted)' }}>Hardware absent</span></div>
            ) : isNoData ? (
              <div>Status: <span style={{ color: 'var(--tier-elevated)' }}>Signal lost (&gt;120s)</span></div>
            ) : (
              <>
                <div>Scanner ID: <span style={{ color: 'var(--text-primary)' }}>{zone.beacon?.scanner_id ?? 'BLE-DEFAULT'}</span></div>
                <div>Blind spot coverage: <span style={{ color: 'var(--text-primary)' }}>Active (Non-visual)</span></div>
                <div>Privacy: <span>MAC anonymized window</span></div>
              </>
            )}
          </div>
        </div>

        {/* Column 3: Fused Decision */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            border: isForecastOnly || isNoData ? '1.5px dashed var(--border-active)' : '1px solid var(--border-active)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={16} color="var(--text-primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {isForecastOnly ? 'Predictive Model Mode' : isNoData ? 'Telemetry Stale Mode' : 'CrowdGuard Fusion'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {isForecastOnly
                ? 'Synthesized from event calendar'
                : isNoData
                ? 'Numerical metrics suppressed'
                : 'Fail-safe synthesized estimate'}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800 }} className="num-tabular">
                {isForecastOnly || isNoData ? '—' : zone.fused_estimate}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isForecastOnly ? 'no ground truth' : isNoData ? 'sensors offline' : 'occupants'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isForecastOnly ? (
                <span>Physical Capacity: {zone.capacity.toLocaleString()}</span>
              ) : isNoData ? (
                <span>Physical Capacity: {zone.capacity.toLocaleString()}</span>
              ) : (
                <span>
                  Calculated occupancy: <span className="num-tabular">{((zone.fused_estimate / zone.capacity) * 100).toFixed(0)}%</span>
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '10px',
              marginTop: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            {isForecastOnly ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
                <TrendingUp size={14} />
                <span>Forecast-only place</span>
              </div>
            ) : isNoData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tier-elevated)', fontWeight: 600 }}>
                <AlertCircle size={14} />
                <span>Never green / Never zero risk</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <ArrowRight size={14} />
                  <span>Policy: Trust upper envelope</span>
                </div>
                <div style={{ marginTop: '2px' }}>
                  Forecast impact: +<span className="num-tabular">{((zone.forecast_pressure || 0.2) * 100).toFixed(0)}%</span> pressure
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

