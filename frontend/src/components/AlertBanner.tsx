import React from 'react';
import type { Alert } from '../types/crowdguard';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface AlertBannerProps {
  alerts: Alert[];
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  // Pick the highest severity alert
  const topAlert = [...alerts].sort((a, b) => {
    const tierPriority = { CRITICAL: 4, HIGH: 3, ELEVATED: 2, NORMAL: 1 };
    return tierPriority[b.tier] - tierPriority[a.tier] || b.risk_score - a.risk_score;
  })[0];

  const formatElapsed = (isoTime: string) => {
    const diffSec = Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  const isCritical = topAlert.tier === 'CRITICAL';

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
            className={`tier-badge tier-${topAlert.tier}`}
            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
          >
            {topAlert.tier} RISK ALERT
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {topAlert.zone_name}:
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
            {topAlert.message}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} className="num-tabular">
          Raised {formatElapsed(topAlert.raised_at)}
        </span>
      </div>
    </div>
  );
};
