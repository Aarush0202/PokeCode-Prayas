import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck, CheckCircle, Sparkles } from 'lucide-react';

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  email: string;
  clearance: string;
  station: string;
  avatarColor: string;
}

export const DUMMY_ACCOUNTS: UserProfile[] = [
  {
    id: 'usr-01',
    name: 'Officer Rajesh Kumar',
    role: 'Lead Incident Commander',
    email: 'commander@crowdguard.gov',
    clearance: 'Level 4 Tactical Command',
    station: 'Central Operations Command Center',
    avatarColor: '#0284c7',
  },
  {
    id: 'usr-02',
    name: 'Dr. Ananya Sharma',
    role: 'Senior Crowd Safety Analyst',
    email: 'analyst@crowdguard.gov',
    clearance: 'Predictive Horizon & Risk Modeling',
    station: 'Municipal Planning & Early Warning Hub',
    avatarColor: '#059669',
  },
  {
    id: 'usr-03',
    name: 'Inspector Vikram Singh',
    role: 'Rapid Response Field Lead',
    email: 'field@crowdguard.gov',
    clearance: 'Sector 17 Perimeter & Egress Control',
    station: 'Tactical Mobile Dispatch Unit',
    avatarColor: '#d97706',
  },
];

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>('commander@crowdguard.gov');
  const [password, setPassword] = useState<string>('admin123');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('usr-01');

  const handleQuickSelect = (account: UserProfile) => {
    setSelectedAccountId(account.id);
    setEmail(account.email);
    setPassword('admin123');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = DUMMY_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase()
    ) || DUMMY_ACCOUNTS[0];
    onLogin(matched);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-dark)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          padding: '36px',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Shield size={26} color="var(--tier-normal)" />
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
            }}
          >
            CROWDGUARD
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            Public Safety & Stampede Early Warning Console
          </p>
        </div>

        {/* Quick Demo Account Selector */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Demo Operator Account:
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--tier-normal)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <Sparkles size={12} /> One-Click Login
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DUMMY_ACCOUNTS.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleQuickSelect(acc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: acc.avatarColor,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {acc.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {acc.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {acc.role}
                      </div>
                    </div>
                  </div>

                  {isSelected && <CheckCircle size={16} color="var(--tier-normal)" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              Operator Email
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Mail size={16} color="var(--text-muted)" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              Authorization Passcode
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Lock size={16} color="var(--text-muted)" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-dark)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <span>Access Command Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <UserCheck size={12} />
          <span>Restricted to authorized emergency response & city venue staff</span>
        </div>
      </div>
    </div>
  );
};
