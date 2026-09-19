import React, { memo } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { Camera, Radio, AlertCircle } from 'lucide-react';
import { RiskScoreExplainer } from './RiskScoreExplainer';

interface ZoneCardProps {
  zone: ZoneRisk;
  isSelected: boolean;
  isHighestRisk: boolean;
  onSelect: (zoneId: string) => void;
}

export const ZoneCard: React.FC<ZoneCardProps> = memo(({
  zone,
  isSelected,
  isHighestRisk,
  onSelect,
}) => {
  const occupancyPercent = Math.min(100, Math.round((zone.fused_estimate / zone.capacity) * 100));

  const hasCamera = Boolean(zone.vision);
  const hasBeacon = Boolean(zone.beacon);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'CRITICAL': return 'var(--tier-critical)';
      case 'HIGH': return 'var(--tier-high)';
      case 'ELEVATED': return 'var(--tier-elevated)';
      default: return 'var(--tier-normal)';
    }
  };

  const getTierBorder = (tier: string) => {
    switch (tier) {
      case 'CRITICAL': return 'var(--tier-critical-border)';
      case 'HIGH': return 'var(--tier-high-border)';
      case 'ELEVATED': return 'var(--tier-elevated-border)';
      default: return 'var(--tier-normal-border)';
    }
  };

  const tierColor = getTierColor(zone.risk_tier);
  const tierBorder = getTierBorder(zone.risk_tier);

  return (
    <div
      onClick={() => onSelect(zone.zone_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(zone.zone_id);
        }
      }}
      aria-label={`Zone ${zone.zone_name}, Tier ${zone.risk_tier}, estimated occupancy ${zone.fused_estimate} out of ${zone.capacity}`}
      style={{
        backgroundColor: isHighestRisk ? 'var(--bg-card-highlight)' : 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: `1.5px solid ${isSelected ? tierColor : tierBorder}`,
        padding: isHighestRisk ? '20px 24px' : '16px 20px',
        cursor: 'pointer',
        transition: 'border-color var(--transition-tier), background-color var(--transition-tier), box-shadow var(--transition-tier)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: isSelected
          ? `0 0 0 1px ${tierColor}, 0 8px 24px rgba(0,0,0,0.5)`
          : isHighestRisk
            ? '0 6px 20px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Top row: Name & Tier Badge */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: isHighestRisk ? '1.25rem' : '1.05rem', margin: 0, fontWeight: 700 }}>
                {zone.zone_name}
              </h3>
              {isHighestRisk && (
                <span style={{ fontSize: '0.7rem', color: tierColor, fontWeight: 700, letterSpacing: '0.05em' }}>
                  PRIORITY
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {zone.zone_name} — <span className="num-tabular">{zone.fused_estimate}</span> estimated, capacity <span className="num-tabular">{zone.capacity}</span>
            </div>
          </div>

          <span className={`tier-badge tier-${zone.risk_tier}`}>
            {zone.risk_tier}
          </span>
        </div>

        {/* Live occupancy display */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '16px 0 12px 0' }}>
          <span
            className="num-tabular"
            style={{
              fontSize: isHighestRisk ? '2.8rem' : '2.1rem',
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--text-primary)',
            }}
          >
            {zone.fused_estimate}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            / <span className="num-tabular">{zone.capacity}</span> ({occupancyPercent}%)
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Risk Score: <strong style={{ color: tierColor }} className="num-tabular">{(zone.risk_score * 100).toFixed(0)}</strong>/100</span>
            <RiskScoreExplainer zone={zone} />
          </span>
        </div>

        {/* Occupancy Progress Bar */}
        <div
          style={{
            height: '6px',
            backgroundColor: 'var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, occupancyPercent)}%`,
              height: '100%',
              backgroundColor: tierColor,
              transition: 'width var(--transition-tier)',
            }}
          />
        </div>
      </div>

      {/* Sensor Reporting Status & Operating Reasons */}
      <div>
        {/* Sensor Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={14} color={hasCamera ? 'var(--text-secondary)' : 'var(--text-muted)'} />
            <span>Camera: {hasCamera ? <strong className="num-tabular" style={{ color: 'var(--text-primary)' }}>{zone.vision?.person_count}</strong> : 'Offline'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} color={hasBeacon ? 'var(--text-secondary)' : 'var(--text-muted)'} />
            <span>BLE: {hasBeacon ? <strong className="num-tabular" style={{ color: 'var(--text-primary)' }}>{zone.beacon?.unique_devices}</strong> : 'Offline'}</span>
          </div>
        </div>

        {/* Reasons list (formatted as sentences) */}
        {zone.reasons && zone.reasons.length > 0 && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <AlertCircle size={12} color={tierColor} />
              <span>Telemetry observations:</span>
            </div>
            {zone.reasons.slice(0, 2).map((reason, idx) => (
              <div key={idx} style={{ textTransform: 'none', color: reason.includes('disagree') ? 'var(--tier-elevated)' : 'var(--text-muted)' }}>
                • {reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ZoneCard.displayName = 'ZoneCard';
