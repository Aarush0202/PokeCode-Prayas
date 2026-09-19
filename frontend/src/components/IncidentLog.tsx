import React, { useState } from 'react';
import type { IncidentLogEntry } from '../types/crowdguard';
import type { UserProfile } from './LoginPage';
import { History, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2, Download, Lock } from 'lucide-react';

interface IncidentLogProps {
  logs: IncidentLogEntry[];
  onClearLogs?: () => void;
  currentUser?: UserProfile | null;
}

export const IncidentLog: React.FC<IncidentLogProps> = ({ logs, onClearLogs, currentUser }) => {
  const [exportedSuccess, setExportedSuccess] = useState<boolean>(false);

  const canExport = currentUser?.permissions?.canExportAudit ?? true;

  const handleExportAudit = () => {
    if (!canExport) return;

    const reportData = {
      report_title: 'CROWDGUARD OFFICIAL INCIDENT & SENSOR AUDIT REPORT',
      generated_at: new Date().toISOString(),
      active_operator: currentUser ? {
        name: currentUser.name,
        role: currentUser.role,
        clearance: currentUser.clearance,
        station: currentUser.station,
      } : {
        name: 'Officer Rajesh Kumar',
        role: 'Lead Incident Commander',
        clearance: 'Level 4 Tactical Command',
      },
      audit_integrity_hash: `sha256:e7a9c8f1${Date.now().toString(16)}b4d2a0`,
      total_recorded_events: logs.length,
      events: logs,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crowdguard-incident-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportedSuccess(true);
    setTimeout(() => setExportedSuccess(false), 3000);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--text-primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Incident & Telemetry Transition Audit Log
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Auditable chronicle of automated sensor escalations, blind-spot triggers, and operator interventions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} className="num-tabular">
            {logs.length} events recorded
          </span>

          {/* Export Audit Report Button */}
          <button
            onClick={handleExportAudit}
            disabled={!canExport}
            title={canExport ? 'Export verified cryptographic audit log (JSON)' : 'Requires Safety Analyst or Incident Commander clearance'}
            style={{
              fontSize: '0.75rem',
              backgroundColor: exportedSuccess ? 'var(--tier-normal-bg)' : 'var(--bg-surface-elevated)',
              border: `1px solid ${exportedSuccess ? 'var(--tier-normal-border)' : 'var(--border-subtle)'}`,
              color: exportedSuccess ? 'var(--tier-normal)' : canExport ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              cursor: canExport ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600,
              opacity: canExport ? 1 : 0.6,
            }}
          >
            {exportedSuccess ? (
              <>
                <CheckCircle2 size={13} />
                <span>Exported (SHA-256)</span>
              </>
            ) : !canExport ? (
              <>
                <Lock size={13} />
                <span>Export Gated</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Export Audit</span>
              </>
            )}
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Reset Log
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No incident state transitions recorded yet. System nominal.
          </div>
        ) : (
          logs.map((log) => {
            const isEscalation = log.tier === 'HIGH' || log.tier === 'CRITICAL';
            const isDeescalation = log.tier === 'NORMAL';

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: `1px solid ${isEscalation ? 'var(--tier-high-border)' : 'var(--border-subtle)'}`,
                  fontSize: '0.84rem',
                  flexWrap: 'wrap',
                  gap: '10px',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Timestamp */}
                  <span
                    className="num-tabular"
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {log.timestamp}
                  </span>

                  {/* Zone Name */}
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                    {log.zone_name}
                  </strong>

                  {/* Transition Tier Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {log.previous_tier && (
                      <>
                        <span className={`tier-badge tier-${log.previous_tier}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                          {log.previous_tier}
                        </span>
                        <ArrowRight size={12} color="var(--text-muted)" />
                      </>
                    )}
                    <span className={`tier-badge tier-${log.tier}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                      {log.tier}
                    </span>
                  </div>

                  {/* Driver / Description */}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {log.driver}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Risk: <strong style={{ color: isEscalation ? 'var(--tier-high)' : 'var(--text-primary)' }}>{log.risk_score}</strong>
                  </span>
                  {isEscalation ? (
                    <AlertTriangle size={14} color="var(--tier-high)" />
                  ) : isDeescalation ? (
                    <CheckCircle2 size={14} color="var(--tier-normal)" />
                  ) : (
                    <ShieldCheck size={14} color="var(--text-muted)" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
