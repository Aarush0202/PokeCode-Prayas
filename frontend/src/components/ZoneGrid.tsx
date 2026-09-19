import React from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { ZoneCard } from './ZoneCard';

interface ZoneGridProps {
  zones: ZoneRisk[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
}

export const ZoneGrid: React.FC<ZoneGridProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
}) => {
  if (!zones || zones.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)',
        }}
      >
        Waiting for initial telemetry poll. Verify gateway connection...
      </div>
    );
  }

  // Sorted by risk_score descending
  const sortedZones = [...zones].sort((a, b) => b.risk_score - a.risk_score);
  const highestRiskZone = sortedZones[0];
  const secondaryZones = sortedZones.slice(1);

  return (
    <section aria-label="Monitored Zones Overview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
            Live Zone Telemetry
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Sorted by threat level. Select a zone to inspect multimodal sensor fusion.
          </p>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {zones.length} active sectors
        </span>
      </div>

      {/* Asymmetric layout: top danger zone rendered with maximum prominence */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Highest Risk Zone */}
        {highestRiskZone && (
          <div style={{ gridColumn: '1 / -1' }}>
            <ZoneCard
              zone={highestRiskZone}
              isSelected={selectedZoneId === highestRiskZone.zone_id}
              isHighestRisk={true}
              onSelect={onSelectZone}
            />
          </div>
        )}

        {/* Secondary Zones */}
        {secondaryZones.map((zone) => (
          <ZoneCard
            key={zone.zone_id}
            zone={zone}
            isSelected={selectedZoneId === zone.zone_id}
            isHighestRisk={false}
            onSelect={onSelectZone}
          />
        ))}
      </div>
    </section>
  );
};
