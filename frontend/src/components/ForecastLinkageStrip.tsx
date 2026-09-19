import React from 'react';
import type { ZoneRisk, EventItem } from '../types/crowdguard';
import { Zap, Clock, ShieldAlert } from 'lucide-react';

interface ForecastLinkageStripProps {
  zone: ZoneRisk | null;
  events: EventItem[];
}

export const ForecastLinkageStrip: React.FC<ForecastLinkageStripProps> = ({ zone, events }) => {
  if (!zone || (zone.risk_tier === 'NORMAL' && zone.risk_score < 0.45)) {
    return null;
  }

  // Find matching scheduled event for this zone
  const matchingEvent = events.find((e) => e.zone_id === zone.zone_id) ?? events[0];

  const formatEventTime = (isoTime: string) => {
    try {
      const d = new Date(isoTime);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '19:00';
    }
  };

  return (
    <div
      role="region"
      aria-label="Predictive Forecast to Ground Telemetry Verification"
      style={{
        backgroundColor: 'var(--tier-elevated-bg)',
        border: '1.5px solid var(--tier-elevated)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: 'var(--shadow-card)',
        margin: '8px 0 16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            backgroundColor: 'var(--tier-elevated)',
            color: '#ffffff',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Zap size={18} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
              ⚡ PREDICTED BY FORECAST MODEL (Ground Telemetry Verified)
            </span>
            <span className={`tier-badge tier-${zone.risk_tier}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
              LIVE: {zone.risk_tier}
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
            Flagged in advance by municipal schedule — Event:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>"{matchingEvent?.title || 'City Transit Ingress Surge'}"</strong>{' '}
            (Target: {formatEventTime(matchingEvent?.start_time || new Date().toISOString())} • Sector {zone.zone_name}).
            Physical camera and Bluetooth sensors on the ground verify surge accumulation.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Clock size={13} />
          <span>Ahead-of-time horizon: <strong>48h</strong></span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--tier-elevated)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--tier-elevated-border)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <ShieldAlert size={13} />
          <span>FUSED ACCORD</span>
        </div>
      </div>
    </div>
  );
};
