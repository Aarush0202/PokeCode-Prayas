import React, { useState } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { calculateRiskBreakdown } from '../types/crowdguard';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface RiskScoreExplainerProps {
  zone: ZoneRisk;
}

export const RiskScoreExplainer: React.FC<RiskScoreExplainerProps> = ({ zone }) => {
  const [open, setOpen] = useState<boolean>(false);
  const breakdown = calculateRiskBreakdown(zone);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Click to view exact mathematical formula breakdown"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          color: 'var(--text-muted)',
          fontSize: '0.78rem',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <Calculator size={13} color="var(--text-muted)" />
        <span style={{ textDecoration: 'underline dotted' }}>Formula</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '8px',
            width: '320px',
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-active)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 60,
            fontSize: '0.8rem',
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>
              Risk Formula Explainability
            </strong>
            <span className={`tier-badge tier-${zone.risk_tier}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
              {zone.risk_tier}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface-elevated)',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '10px',
            }}
          >
            Risk = (0.50 × Density) + (0.30 × BLE_Delta) + (0.20 × Event_Proximity)
          </div>

          {/* Three Component Breakdown Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {/* Component 1: Optical Density */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>1. Visual Density (50% wt)</span>
                <span className="num-tabular" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  +{breakdown.densityContribution} pts
                </span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                <div style={{ width: `${Math.min(100, breakdown.densityScore)}%`, height: '100%', backgroundColor: 'var(--tier-normal)' }} />
              </div>
            </div>

            {/* Component 2: BLE Discrepancy */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>2. BLE Discrepancy (30% wt)</span>
                <span className="num-tabular" style={{ fontWeight: 700, color: 'var(--tier-elevated)' }}>
                  +{breakdown.divergenceContribution} pts
                </span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                <div style={{ width: `${Math.min(100, breakdown.divergenceScore)}%`, height: '100%', backgroundColor: 'var(--tier-elevated)' }} />
              </div>
            </div>

            {/* Component 3: Forecast Pressure */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>3. Event Proximity (20% wt)</span>
                <span className="num-tabular" style={{ fontWeight: 700, color: 'var(--tier-high)' }}>
                  +{breakdown.forecastContribution} pts
                </span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                <div style={{ width: `${Math.min(100, breakdown.forecastScore)}%`, height: '100%', backgroundColor: 'var(--tier-high)' }} />
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
              Calculated Fused Risk:
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }} className="num-tabular">
              {breakdown.totalScore} / 100
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
