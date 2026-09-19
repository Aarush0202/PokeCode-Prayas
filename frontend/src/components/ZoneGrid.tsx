import React, { useState } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { ZoneCard } from './ZoneCard';
import { VenueMap } from './VenueMap';
import { Map, LayoutGrid, SplitSquareVertical } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'cards'>('split');

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
      {/* Top Header with Layout Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Command Telemetry & Spatial Overview
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            Real-time sensory coverage mapped to physical choke points and egress corridors.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            onClick={() => setViewMode('split')}
            title="Split command view (Floorplan map + cards)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: viewMode === 'split' ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'split' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            <SplitSquareVertical size={13} />
            <span>Split Command</span>
          </button>

          <button
            onClick={() => setViewMode('map')}
            title="Interactive spatial floorplan map"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: viewMode === 'map' ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === 'map' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'map' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            <Map size={13} />
            <span>Spatial Map</span>
          </button>

          <button
            onClick={() => setViewMode('cards')}
            title="Card matrix layout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: viewMode === 'cards' ? 'var(--bg-surface)' : 'transparent',
              color: viewMode === 'cards' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            <LayoutGrid size={13} />
            <span>Zone Cards</span>
          </button>
        </div>
      </div>

      {/* View 1: Spatial Map Component */}
      {(viewMode === 'map' || viewMode === 'split') && (
        <div style={{ marginBottom: viewMode === 'split' ? '18px' : '0' }}>
          <VenueMap
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
        </div>
      )}

      {/* View 2: Cards Grid */}
      {(viewMode === 'cards' || viewMode === 'split') && (
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
      )}
    </section>
  );
};
