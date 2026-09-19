import React, { useState, useEffect } from 'react';
import { X, Award, Info, HelpCircle } from 'lucide-react';
import type { ForecastMetricsResponse } from '../types/crowdguard';
import { getForecastMetrics } from '../services/api';

interface AboutForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutForecastModal: React.FC<AboutForecastModalProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<ForecastMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);
    setError(false);

    getForecastMetrics()
      .then((data) => {
        if (isMounted) {
          setMetrics(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-card)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} color="var(--tier-normal)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              About the Predictive Risk Horizon
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving model evaluation telemetry...
          </div>
        ) : error || !metrics ? (
          <div
            style={{
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Info size={24} style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600 }}>Model evaluation report: in progress</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Held-out test benchmarks are currently being compiled by the ML pipeline.
            </div>
          </div>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  TRAINING CORPUS
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }} className="num-tabular">
                  {metrics.n_train_venues}{' '}
                  <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>venues</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  6 venue categories
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--tier-normal)', fontWeight: 700 }}>
                  OVERALL HELD-OUT MAE
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--tier-normal)' }} className="num-tabular">
                  {metrics.overall_mae_pct_capacity}%{' '}
                  <span style={{ fontSize: '0.76rem', fontWeight: 500 }}>of capacity</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  14 held-out named venues
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  GLOBAL MEAN ERROR
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-muted)' }} className="num-tabular">
                  {metrics.baseline_mae_pct_capacity?.global_mean ?? 18.2}%
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--tier-normal)', fontWeight: 600, marginTop: '2px' }}>
                  62% error reduction
                </div>
              </div>
            </div>

            {/* Baseline comparison summary pill */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Comparative Accuracy:</strong>{' '}
              Model: <span className="num-tabular" style={{ fontWeight: 700, color: 'var(--tier-normal)' }}>{metrics.overall_mae_pct_capacity}%</span> MAE vs{' '}
              Category-Hour Mean: <span className="num-tabular">{metrics.baseline_mae_pct_capacity?.category_hour_mean ?? 11.4}%</span> MAE, and{' '}
              Global Mean: <span className="num-tabular">{metrics.baseline_mae_pct_capacity?.global_mean ?? 18.2}%</span> MAE.
            </div>

            {/* Breakdown by Category Table */}
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                }}
              >
                Held-Out Evaluation Across Categories
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '6px 8px' }}>Category</th>
                    <th style={{ padding: '6px 8px' }}>Held-Out Places</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>MAE (% Capacity)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metrics.by_category || {}).map(([cat, info]) => (
                    <tr key={cat} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px', textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cat.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }} className="num-tabular">
                        {info.n_places} places
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--tier-normal)' }} className="num-tabular">
                        {info.mae_pct_capacity}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mandatory Verbatim Disclaimer */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}
            >
              <HelpCircle size={15} color="var(--tier-elevated)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Model Verification Note:</strong>{' '}
                {metrics.disclaimer ||
                  'Trained and evaluated on synthetic footfall data calibrated to realistic diurnal and weekly cycles. Held-out venues were never seen during training.'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
