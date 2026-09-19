import React, { useState } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { Compass, Camera, Radio, AlertOctagon, ShieldAlert } from 'lucide-react';

interface VenueMapProps {
  zones: ZoneRisk[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
}

export const VenueMap: React.FC<VenueMapProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
}) => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const getZone = (id: string): ZoneRisk | undefined => {
    return zones.find((z) => z.zone_id === id);
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'CRITICAL': return 'var(--tier-critical)';
      case 'HIGH': return 'var(--tier-high)';
      case 'ELEVATED': return 'var(--tier-elevated)';
      default: return 'var(--tier-normal)';
    }
  };

  const getTierBg = (tier?: string) => {
    switch (tier) {
      case 'CRITICAL': return 'var(--tier-critical-bg)';
      case 'HIGH': return 'var(--tier-high-bg)';
      case 'ELEVATED': return 'var(--tier-elevated-bg)';
      default: return 'var(--tier-normal-bg)';
    }
  };

  const z1 = getZone('z1');
  const z2 = getZone('z2');
  const z3 = getZone('z3');
  const z4 = getZone('z4');

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Map Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} color="var(--text-primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Venue Spatial Floorplan & Sensor Topology
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Interactive geographical command map. Click any spatial polygon to isolate sensor signals.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Camera size={12} color="var(--text-secondary)" />
            <span>CCTV Coverage</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Radio size={12} color="var(--tier-elevated)" />
            <span>BLE Scanner</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertOctagon size={12} color="var(--tier-high)" />
            <span>Choke Point</span>
          </div>
        </div>
      </div>

      {/* SVG Floorplan Canvas */}
      <div
        style={{
          width: '100%',
          height: '380px',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 900 450"
          style={{ width: '100%', height: '100%', userSelect: 'none' }}
        >
          <defs>
            {/* Grid pattern */}
            <pattern id="cadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" strokeOpacity="0.6" />
            </pattern>

            {/* Pulsing radar for High/Critical risk zones */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Technical Grid */}
          <rect width="900" height="450" fill="url(#cadGrid)" />

          {/* Exterior Venue Boundary Wall */}
          <rect
            x="40"
            y="30"
            width="820"
            height="390"
            rx="12"
            fill="none"
            stroke="var(--border-active)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* Compass Rose */}
          <g transform="translate(820, 65)">
            <circle cx="0" cy="0" r="18" fill="var(--bg-surface)" stroke="var(--border-subtle)" strokeWidth="1" />
            <path d="M 0 -14 L 4 0 L -4 0 Z" fill="var(--text-primary)" />
            <path d="M 0 14 L 3 0 L -3 0 Z" fill="var(--text-muted)" />
            <text x="-4" y="-18" fontSize="10" fontWeight="bold" fill="var(--text-primary)">N</text>
          </g>

          {/* Scale Bar (50m) */}
          <g transform="translate(60, 400)">
            <line x1="0" y1="0" x2="80" y2="0" stroke="var(--text-muted)" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--text-muted)" strokeWidth="2" />
            <line x1="80" y1="-4" x2="80" y2="4" stroke="var(--text-muted)" strokeWidth="2" />
            <text x="26" y="-6" fontSize="10" fill="var(--text-muted)" fontWeight="600">50m</text>
          </g>

          {/* Emergency Egress Paths */}
          <path d="M 450 30 L 450 10 M 860 220 L 885 220 M 450 420 L 450 440 M 40 220 L 15 220" stroke="var(--tier-normal)" strokeWidth="2" strokeDasharray="3 3" />
          <text x="455" y="22" fontSize="9" fill="var(--tier-normal)" fontWeight="700">GATE NORTH (EVAC 1)</text>
          <text x="770" y="215" fontSize="9" fill="var(--tier-normal)" fontWeight="700">EAST EXIT</text>
          <text x="455" y="435" fontSize="9" fill="var(--tier-normal)" fontWeight="700">SOUTH EVAC</text>

          {/* ================= ZONE 1: MAIN GATE PLAZA (North) ================= */}
          <g
            onClick={() => onSelectZone('z1')}
            onMouseEnter={() => setHoveredZone('z1')}
            onMouseLeave={() => setHoveredZone(null)}
            style={{ cursor: 'pointer' }}
          >
            <polygon
              points="70,50 520,50 500,160 90,160"
              fill={getTierBg(z1?.risk_tier)}
              stroke={selectedZoneId === 'z1' ? 'var(--text-primary)' : getTierColor(z1?.risk_tier)}
              strokeWidth={selectedZoneId === 'z1' ? 3 : 1.5}
            />
            {/* Zone Label & Telemetry Badge */}
            <text x="100" y="85" fontSize="14" fontWeight="800" fill="var(--text-primary)">
              ZONE 1 — Main Gate Plaza
            </text>
            <text x="100" y="105" fontSize="11" fill="var(--text-secondary)">
              Capacity: 400 • Area: 500 m²
            </text>
            <rect x="100" y="118" width="105" height="22" rx="4" fill="var(--bg-surface)" stroke={getTierColor(z1?.risk_tier)} strokeWidth="1" />
            <text x="110" y="133" fontSize="11" fontWeight="800" fill={getTierColor(z1?.risk_tier)}>
              {z1?.fused_estimate ?? 140} / {z1?.capacity ?? 400} ({z1?.risk_tier})
            </text>

            {/* Sensor Cones */}
            <circle cx="85" cy="65" r="5" fill="var(--text-secondary)" />
            <path d="M 85 65 L 140 120 L 160 80 Z" fill="rgba(100, 116, 139, 0.15)" stroke="var(--text-muted)" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>

          {/* ================= ZONE 2: METRO CONCOURSE (East Hub) ================= */}
          <g
            onClick={() => onSelectZone('z2')}
            onMouseEnter={() => setHoveredZone('z2')}
            onMouseLeave={() => setHoveredZone(null)}
            style={{ cursor: 'pointer' }}
          >
            <polygon
              points="540,50 830,50 830,220 540,220"
              fill={getTierBg(z2?.risk_tier)}
              stroke={selectedZoneId === 'z2' ? 'var(--text-primary)' : getTierColor(z2?.risk_tier)}
              strokeWidth={selectedZoneId === 'z2' ? 3 : 1.5}
            />
            <text x="560" y="85" fontSize="14" fontWeight="800" fill="var(--text-primary)">
              ZONE 2 — Metro Concourse
            </text>
            <text x="560" y="105" fontSize="11" fill="var(--text-secondary)">
              Capacity: 600 • Subway Hub
            </text>
            <rect x="560" y="118" width="115" height="22" rx="4" fill="var(--bg-surface)" stroke={getTierColor(z2?.risk_tier)} strokeWidth="1" />
            <text x="570" y="133" fontSize="11" fontWeight="800" fill={getTierColor(z2?.risk_tier)}>
              {z2?.fused_estimate ?? 418} / {z2?.capacity ?? 600} ({z2?.risk_tier})
            </text>

            {/* Subway Turnstile representation */}
            <line x1="560" y1="165" x2="680" y2="165" stroke="var(--border-active)" strokeWidth="3" strokeDasharray="6 4" />
            <text x="560" y="185" fontSize="9" fill="var(--text-muted)">Turnstile Ingress Matrix</text>
          </g>

          {/* ================= ZONE 3: MARKET STREET (Center Bottleneck) ================= */}
          <g
            onClick={() => onSelectZone('z3')}
            onMouseEnter={() => setHoveredZone('z3')}
            onMouseLeave={() => setHoveredZone(null)}
            style={{ cursor: 'pointer' }}
          >
            <polygon
              points="90,180 520,180 480,310 70,310"
              fill={getTierBg(z3?.risk_tier)}
              stroke={selectedZoneId === 'z3' ? 'var(--text-primary)' : getTierColor(z3?.risk_tier)}
              strokeWidth={selectedZoneId === 'z3' ? 3.5 : 2}
              filter={z3?.risk_tier === 'HIGH' || z3?.risk_tier === 'CRITICAL' ? 'url(#glow)' : undefined}
            />
            <text x="100" y="215" fontSize="14" fontWeight="800" fill="var(--text-primary)">
              ZONE 3 — Market Street Corridor
            </text>
            <text x="100" y="235" fontSize="11" fill="var(--text-secondary)">
              Capacity: 900 • Narrow Arcade Geography
            </text>

            <rect x="100" y="248" width="125" height="24" rx="4" fill="var(--bg-surface)" stroke={getTierColor(z3?.risk_tier)} strokeWidth="1.5" />
            <text x="110" y="265" fontSize="12" fontWeight="800" fill={getTierColor(z3?.risk_tier)}>
              {z3?.fused_estimate ?? 782} / {z3?.capacity ?? 900} ({z3?.risk_tier})
            </text>

            {/* Marked Physical Choke Point near North Arcade */}
            <g transform="translate(380, 220)">
              <circle cx="0" cy="0" r="14" fill="rgba(234, 88, 12, 0.2)" stroke="var(--tier-high)" strokeWidth="1.5" />
              <text x="-8" y="4" fontSize="11" fontWeight="bold" fill="var(--tier-high)">⚠️</text>
              <text x="20" y="4" fontSize="10" fontWeight="bold" fill="var(--tier-high)">Bottleneck Choke Point</text>
            </g>

            {/* BLE Scanner Radar Ring */}
            <circle cx="280" cy="270" r="28" fill="none" stroke="var(--tier-elevated)" strokeWidth="1" strokeDasharray="4 2" />
            <circle cx="280" cy="270" r="4" fill="var(--tier-elevated)" />
            <text x="260" y="295" fontSize="8" fill="var(--tier-elevated)">BLE-MKT-03</text>
          </g>

          {/* ================= ZONE 4: FOOD COURT (South Pavilion) ================= */}
          <g
            onClick={() => onSelectZone('z4')}
            onMouseEnter={() => setHoveredZone('z4')}
            onMouseLeave={() => setHoveredZone(null)}
            style={{ cursor: 'pointer' }}
          >
            <polygon
              points="70,330 830,330 800,410 70,410"
              fill={getTierBg(z4?.risk_tier)}
              stroke={selectedZoneId === 'z4' ? 'var(--text-primary)' : getTierColor(z4?.risk_tier)}
              strokeWidth={selectedZoneId === 'z4' ? 3 : 1.5}
            />
            <text x="100" y="365" fontSize="14" fontWeight="800" fill="var(--text-primary)">
              ZONE 4 — Central Food Court & Dining Pavilion
            </text>
            <text x="100" y="385" fontSize="11" fill="var(--text-secondary)">
              Capacity: 300 • Unimpeded Perimeter Seating
            </text>

            <rect x="460" y="355" width="105" height="22" rx="4" fill="var(--bg-surface)" stroke={getTierColor(z4?.risk_tier)} strokeWidth="1" />
            <text x="470" y="370" fontSize="11" fontWeight="800" fill={getTierColor(z4?.risk_tier)}>
              {z4?.fused_estimate ?? 94} / {z4?.capacity ?? 300} ({z4?.risk_tier})
            </text>
          </g>
        </svg>
      </div>

      {/* Interactive Map Footer Note */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <div>
          {hoveredZone ? (
            <span>Inspecting hover: <strong style={{ color: 'var(--text-primary)' }}>{zones.find(z => z.zone_id === hoveredZone)?.zone_name}</strong> (Click to isolate signals)</span>
          ) : (
            <span>Active Selected: <strong style={{ color: 'var(--text-primary)' }}>{zones.find(z => z.zone_id === selectedZoneId)?.zone_name}</strong>. Click any polygon above to isolate signals.</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={14} color="var(--tier-high)" />
          <span>Real-time polygon coloration reflects instantaneous fused risk tier.</span>
        </div>
      </div>
    </div>
  );
};
