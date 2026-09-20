import React from 'react';
import type { MetroStationTelemetry } from '../types/crowdguard';
import { Camera, Layers } from 'lucide-react';

interface MetroStationMapProps {
  station: MetroStationTelemetry;
  onOpenCamModal?: () => void;
}

export const MetroStationMap: React.FC<MetroStationMapProps> = ({ station, onOpenCamModal }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '20px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Station Map Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--text-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Underground Station Floorplan & Choke-Point Map
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            Interactive spatial layout for {station.station_name}. Click CCTV markers to launch visual AI detection.
          </p>
        </div>

        {onOpenCamModal && (
          <button
            type="button"
            onClick={onOpenCamModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <Camera size={14} color="#60a5fa" />
            <span>Launch CCTV HUD</span>
          </button>
        )}
      </div>

      {/* SVG Spatial Station Blueprint */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '280px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          padding: '16px',
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 800 240" style={{ display: 'block' }}>
          {/* Outer Station Boundary */}
          <rect x="20" y="20" width="760" height="200" rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />

          {/* Underground Concourse Hall */}
          <rect x="200" y="60" width="400" height="120" rx="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
          <text x="400" y="85" fill="#475569" fontSize="12" fontWeight="700" textAnchor="middle">
            UNDERGROUND CONCOURSE & TURNSTILE MATRIX
          </text>

          {/* Platform 1 (Northbound) */}
          <rect x="200" y="30" width="400" height="24" rx="4" fill={station.platform_1_density > 1.3 ? '#fef2f2' : '#ecfdf5'} stroke={station.platform_1_density > 1.3 ? '#ef4444' : '#10b981'} strokeWidth="1.5" />
          <text x="400" y="46" fill={station.platform_1_density > 1.3 ? '#b91c1c' : '#047857'} fontSize="10" fontWeight="800" textAnchor="middle">
            PLATFORM 1 (NORTHBOUND) — Density: {station.platform_1_density} p/m²
          </text>

          {/* Platform 2 (Southbound) */}
          <rect x="200" y="186" width="400" height="24" rx="4" fill={station.platform_2_density > 1.3 ? '#fef2f2' : '#ecfdf5'} stroke={station.platform_2_density > 1.3 ? '#ef4444' : '#10b981'} strokeWidth="1.5" />
          <text x="400" y="202" fill={station.platform_2_density > 1.3 ? '#b91c1c' : '#047857'} fontSize="10" fontWeight="800" textAnchor="middle">
            PLATFORM 2 (SOUTHBOUND) — Density: {station.platform_2_density} p/m²
          </text>

          {/* Gates A-D */}
          <rect x="40" y="90" width="90" height="60" rx="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="85" y="125" fill="#1d4ed8" fontSize="11" fontWeight="800" textAnchor="middle">
            GATE A & B (INGRESS)
          </text>

          <rect x="670" y="90" width="90" height="60" rx="6" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="715" y="125" fill="#1d4ed8" fontSize="11" fontWeight="800" textAnchor="middle">
            GATE C & D (EGRESS)
          </text>

          {/* Escalator Choke Points */}
          <circle cx="300" cy="120" r="16" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
          <text x="300" y="124" fill="#b45309" fontSize="10" fontWeight="800" textAnchor="middle">ESC 1</text>

          <circle cx="500" cy="120" r="16" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
          <text x="500" y="124" fill="#b45309" fontSize="10" fontWeight="800" textAnchor="middle">ESC 2</text>

          {/* Connectors */}
          <line x1="130" y1="120" x2="200" y2="120" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="600" y1="120" x2="670" y2="120" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
        </svg>

        {/* Live Legend Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '0.74rem',
            color: '#334155',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: '5px 12px',
            borderRadius: '6px',
          }}
        >
          <span>● Turnstile Gate Control</span>
          <span>● Platform Density Sensor</span>
          <span>● Escalator Regulation: <strong>{station.esc_speed_regulation}</strong></span>
        </div>
      </div>
    </div>
  );
};
