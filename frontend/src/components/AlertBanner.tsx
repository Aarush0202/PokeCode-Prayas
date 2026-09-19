import React from 'react';
import type { Alert } from '../types/crowdguard';
import { AlertTriangle, ShieldAlert, Radio } from 'lucide-react';

interface AlertBannerProps {
  alerts: Alert[];
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const formatElapsed = (isoTime: string) => {
    const diffSec = Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  // Separate actionable safety risk alerts from sensor-offline notices
  const riskAlerts = alerts.filter(
    (a) => a.tier !== 'no_data' && a.tier !== 'NO_DATA' && a.tier !== 'NORMAL'
  );
  const sensorAlerts = alerts.filter((a) => a.tier === 'no_data' || a.tier === 'NO_DATA');

  const tierPriority: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    ELEVATED: 2,
    NORMAL: 1,
    no_data: 0,
    NO_DATA: 0,
  };

  const topRiskAlert = riskAlerts.sort(
    (a, b) => (tierPriority[b.tier] || 0) - (tierPriority[a.tier] || 0) || b.risk_score - a.risk_score
  )[0];

  const topSensorNotice = sensorAlerts[0];

  if (topRiskAlert) {
    const isCritical = topRiskAlert.tier === 'CRITICAL';
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          width: '100%',
          backgroundColor: isCritical ? 'var(--tier-critical-bg)' : 'var(--tier-high-bg)',
          borderBottom: `2px solid ${isCritical ? 'var(--tier-critical)' : 'var(--tier-high)'}`,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isCritical ? (
            <ShieldAlert size={20} color="var(--tier-critical)" style={{ flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={20} color="var(--tier-high)" style={{ flexShrink: 0 }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              className={`tier-badge tier-${topRiskAlert.tier}`}
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              {topRiskAlert.tier} RISK ALERT
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {topRiskAlert.zone_name}:
            </span>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
              {topRiskAlert.message}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} className="num-tabular">
            Raised {formatElapsed(topRiskAlert.raised_at)}
          </span>
        </div>
      </div>
    );
  }

  // If only sensor telemetry offline alert (low-key notice, NOT red banner)
  if (topSensorNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span
            className="tier-badge tier-no_data"
            style={{ fontSize: '0.7rem', padding: '1px 6px' }}
          >
            SENSORS OFFLINE
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong>{topSensorNotice.zone_name}:</strong> {topSensorNotice.message}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="num-tabular">
          {formatElapsed(topSensorNotice.raised_at)}
        </span>
      </div>
    );
  }

  return null;
};
