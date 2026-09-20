import React from 'react';
import type { MetroLineStatus } from '../types/crowdguard';
import { ShieldAlert, Activity } from 'lucide-react';

interface MetroLineHeaderProps {
  lines: MetroLineStatus[];
  totalRidership: number;
  activeTrains: number;
  networkStatus: string;
}

export const MetroLineHeader: React.FC<MetroLineHeaderProps> = ({
  lines,
  totalRidership,
  activeTrains,
  networkStatus,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '20px',
      }}
    >
      {/* Top DMRC Network Badge & Calibration Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eab308',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Delhi Metro Rail Corporation (DMRC) — Command Center
              </h2>
              <span
                style={{
                  fontSize: '0.66rem',
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: '#eab308',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                DMRC ML MODEL CALIBRATED
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Real-time transit network telemetry & ML crowd flow forecasting across DMRC interchange hubs.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.82rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Daily Calibration: </span>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {(totalRidership / 100000).toFixed(2)} Lakh
            </strong>
          </div>
          <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active Rakes: </span>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {activeTrains} Trains
            </strong>
          </div>
          <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: networkStatus.includes('ELEVATED') ? 'var(--tier-elevated-bg)' : 'var(--tier-normal-bg)',
              color: networkStatus.includes('ELEVATED') ? 'var(--tier-elevated)' : 'var(--tier-normal)',
              border: `1px solid ${networkStatus.includes('ELEVATED') ? 'var(--tier-elevated-border)' : 'var(--tier-normal-border)'}`,
            }}
          >
            {networkStatus}
          </span>
        </div>
      </div>

      {/* Metro Lines Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {lines.map((line) => {
          const isCongested = line.status === 'CONGESTED';
          const isElevated = line.status === 'ELEVATED';

          return (
            <div
              key={line.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: `1px solid ${isCongested ? 'var(--tier-high-border)' : 'var(--border-subtle)'}`,
                borderLeft: `4px solid ${line.color}`,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {line.name.split(' (')[0]}
                </span>
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: isCongested
                      ? 'var(--tier-high-bg)'
                      : isElevated
                      ? 'var(--tier-elevated-bg)'
                      : 'var(--tier-normal-bg)',
                    color: isCongested
                      ? 'var(--tier-high)'
                      : isElevated
                      ? 'var(--tier-elevated)'
                      : 'var(--tier-normal)',
                  }}
                >
                  {line.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <span>Frequency: <strong>{line.train_frequency_mins}m</strong></span>
                <span>Ridership: <strong>{(line.ridership_daily / 100000).toFixed(1)}L</strong></span>
              </div>

              {line.active_advisories.length > 0 && (
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: isCongested ? '#c2410c' : '#b45309',
                    backgroundColor: isCongested ? '#fff7ed' : '#fffbeb',
                    border: `1px solid ${isCongested ? '#fed7aa' : '#fde68a'}`,
                    padding: '3px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px',
                  }}
                >
                  <ShieldAlert size={10} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {line.active_advisories[0]}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
