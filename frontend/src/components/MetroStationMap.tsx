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
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          padding: '16px',
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 800 240" style={{ display: 'block' }}>
          {/* Outer Station Boundary */}
          <rect x="20" y="20" width="760" height="200" rx="12" fill="none" stroke="var(--border-subtle)" strokeWidth="2" strokeDasharray="4 4" />

          {/* Underground Concourse Hall */}
          <rect x="200" y="60" width="400" height="120" rx="8" fill="rgba(30, 41, 59, 0.4)" stroke="var(--border-active)" strokeWidth="2" />
          <text x="400" y="85" fill="var(--text-muted)" fontSize="12" fontWeight="700" textAnchor="middle">
            UNDERGROUND CONCOURSE & TURNSTILE MATRIX
          </text>

          {/* Platform 1 (Northbound) */}
          <rect x="200" y="30" width="400" height="24" rx="4" fill={station.platform_1_density > 1.3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.15)'} stroke={station.platform_1_density > 1.3 ? '#ef4444' : '#10b981'} strokeWidth="1.5" />
          <text x="400" y="46" fill="var(--text-primary)" fontSize="10" fontWeight="700" textAnchor="middle">
            PLATFORM 1 (NORTHBOUND) — Density: {station.platform_1_density} p/m²
          </text>

          {/* Platform 2 (Southbound) */}
          <rect x="200" y="186" width="400" height="24" rx="4" fill={station.platform_2_density > 1.3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.15)'} stroke={station.platform_2_density > 1.3 ? '#ef4444' : '#10b981'} strokeWidth="1.5" />
          <text x="400" y="202" fill="var(--text-primary)" fontSize="10" fontWeight="700" textAnchor="middle">
            PLATFORM 2 (SOUTHBOUND) — Density: {station.platform_2_density} p/m²
          </text>

          {/* Gates A-D */}
          <rect x="40" y="90" width="90" height="60" rx="6" fill="rgba(59, 130, 246, 0.12)" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="85" y="125" fill="#60a5fa" fontSize="11" fontWeight="700" textAnchor="middle">
            GATE A & B (INGRESS)
          </text>

          <rect x="670" y="90" width="90" height="60" rx="6" fill="rgba(59, 130, 246, 0.12)" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="715" y="125" fill="#60a5fa" fontSize="11" fontWeight="700" textAnchor="middle">
            GATE C & D (EGRESS)
          </text>

          {/* Escalator Choke Points */}
          <circle cx="300" cy="120" r="16" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" />
          <text x="300" y="124" fill="#f59e0b" fontSize="10" fontWeight="800" textAnchor="middle">ESC 1</text>

          <circle cx="500" cy="120" r="16" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" />
          <text x="500" y="124" fill="#f59e0b" fontSize="10" fontWeight="800" textAnchor="middle">ESC 2</text>

          {/* Connectors */}
          <line x1="130" y1="120" x2="200" y2="120" stroke="var(--border-subtle)" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="600" y1="120" x2="670" y2="120" stroke="var(--border-subtle)" strokeWidth="2" strokeDasharray="3 3" />
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
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            padding: '4px 10px',
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
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
