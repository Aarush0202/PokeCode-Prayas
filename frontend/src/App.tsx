import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { useLiveRisk } from './hooks/useLiveRisk';
import { getAlerts, getEvents, checkBackendHealth } from './services/api';
import type { Alert, EventItem, IncidentLogEntry } from './types/crowdguard';
import { AlertBanner } from './components/AlertBanner';
import { ZoneGrid } from './components/ZoneGrid';
import { SignalBreakdown } from './components/SignalBreakdown';
import { ForecastChart } from './components/ForecastChart';
import { ControlPanel } from './components/ControlPanel';
import { EventTimeline } from './components/EventTimeline';
import { ForecastLinkageStrip } from './components/ForecastLinkageStrip';
import { IncidentLog } from './components/IncidentLog';
import { LoginPage, DUMMY_ACCOUNTS, type UserProfile } from './components/LoginPage';
import { EventPlanner } from './components/EventPlanner';
import { AboutForecastModal } from './components/AboutForecastModal';
import { Shield, Activity, TrendingUp, Layers, Radio, AlertOctagon, Sun, Moon, LogOut } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('crowdguard_user');
      return saved ? JSON.parse(saved) : DUMMY_ACCOUNTS[0];
    } catch {
      return DUMMY_ACCOUNTS[0];
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('crowdguard_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState<'live' | 'forecast' | 'planner'>('live');
  const [showMetricsModal, setShowMetricsModal] = useState<boolean>(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('z3'); // Default to Market Street (high interest)

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [backendStatus, setBackendStatus] = useState<{ status: string; latencyMs: number }>({
    status: 'healthy',
    latencyMs: 12,
  });

  // Incident & Alert Timeline Log State
  const [incidentLogs, setIncidentLogs] = useState<IncidentLogEntry[]>([
    {
      id: 'inc-01',
      timestamp: '14:02:18',
      zone_id: 'z2',
      zone_name: 'Metro Concourse',
      tier: 'HIGH',
      previous_tier: 'NORMAL',
      driver: 'BLE device surge +62% (RF phones detected in subway tunnel ingress)',
      risk_score: 0.76,
    },
    {
      id: 'inc-02',
      timestamp: '14:18:45',
      zone_id: 'z3',
      zone_name: 'Market Street Corridor',
      tier: 'HIGH',
      previous_tier: 'ELEVATED',
      driver: 'Optical camera density 0.78 persons/m² at bottleneck choke point',
      risk_score: 0.82,
    },
    {
      id: 'inc-03',
      timestamp: '14:35:10',
      zone_id: 'z1',
      zone_name: 'Main Gate Plaza',
      tier: 'NORMAL',
      previous_tier: 'ELEVATED',
      driver: 'Tactical de-escalation by Officer Rajesh Kumar (corridors cleared)',
      risk_score: 0.28,
    },
  ]);

  const handleLogIncident = (entry: IncidentLogEntry) => {
    setIncidentLogs((prev) => [entry, ...prev]);
  };

  // Apply theme to document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('crowdguard_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('crowdguard_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('crowdguard_user');
  };

  const { zones, degraded, lastUpdated, refetch } = useLiveRisk(3000);

  // Poll alerts every 5 seconds
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const fetchAlerts = () => {
      getAlerts()
        .then((res) => {
          if (isMounted) setAlerts(res.alerts);
        })
        .catch((err) => console.warn('Alert fetch fallback:', err));
    };

    fetchAlerts();
    const id = setInterval(fetchAlerts, 5000);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [currentUser]);

  // Fetch forecast events for linkage strip
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    getEvents(48)
      .then((res) => {
        if (isMounted) setEvents(res.events);
      })
      .catch((err) => console.warn('Events fetch fallback:', err));
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Poll backend health & latency every 6 seconds
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const updateHealth = () => {
      checkBackendHealth()
        .then((res) => {
          if (isMounted) setBackendStatus(res);
        })
        .catch(() => {
          if (isMounted) setBackendStatus({ status: 'unreachable', latencyMs: 0 });
        });
    };

    updateHealth();
    const id = setInterval(updateHealth, 6000);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [currentUser]);

  // Map of zone IDs to names for quick label lookup
  const zoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const z of zones) {
      map[z.zone_id] = z.zone_name;
    }
    return map;
  }, [zones]);

  const zonesSummaryList = useMemo(() => {
    if (zones.length > 0) {
      return zones.map((z) => ({ id: z.zone_id, name: z.zone_name, capacity: z.capacity }));
    }
    return [
      { id: 'z1', name: 'Main Gate Plaza', capacity: 400 },
      { id: 'z2', name: 'Metro Concourse', capacity: 600 },
      { id: 'z3', name: 'Market Street', capacity: 900 },
      { id: 'z4', name: 'Food Court', capacity: 300 },
    ];
  }, [zones]);

  const selectedZone = useMemo(() => {
    return zones.find((z) => z.zone_id === selectedZoneId) ?? zones[0] ?? null;
  }, [zones, selectedZoneId]);

  // Find elevated/high risk zone for Forecast Linkage Strip (The core pitch)
  const forecastTriggerZone = useMemo(() => {
    return zones.find(z => z.risk_tier === 'HIGH' || z.risk_tier === 'CRITICAL' || z.risk_tier === 'ELEVATED') || selectedZone;
  }, [zones, selectedZone]);

  // Seconds since last telemetry update
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // If user is not authenticated, show Login Screen
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Top Alert Banner for Active Alarms */}
      <AlertBanner alerts={alerts} />

      {/* Primary Command Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-logo">
              <Shield size={20} color="var(--tier-normal)" />
            </div>
            <div>
              <h1 className="brand-title">CROWDGUARD</h1>
              <p className="brand-subtitle">
                Crowd Density & Stampede Early-Warning Command System
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'live'}
              className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              <Activity size={14} />
              <span>Live Operations</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'forecast'}
              className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
              onClick={() => setActiveTab('forecast')}
            >
              <TrendingUp size={14} />
              <span>Predictive Forecast (48h)</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'planner'}
              className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Layers size={14} />
              <span>Event Planner</span>
              <span
                style={{
                  fontSize: '0.62rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                BETA
              </span>
            </button>
          </div>

          {/* Operational Status & Telemetry Pill */}
          <div className="header-meta">
            <div
              className="status-pill"
              title={degraded ? 'Backend disconnected or in mock mode; using local safety fixtures' : 'Connected to live backend stream'}
            >
              <span className={`indicator-dot ${degraded ? 'indicator-degraded' : 'indicator-live'}`} />
              <span style={{ color: 'var(--text-primary)' }}>
                {degraded ? 'SAMPLE DATA' : 'LIVE'}
              </span>
              <span style={{ color: 'var(--text-muted)' }} className="num-tabular">
                ({secondsAgo}s)
              </span>
            </div>

            {/* Backend Latency Pill */}
            <div className="status-pill" style={{ fontSize: '0.75rem' }}>
              <Radio size={12} color={backendStatus.status === 'healthy' ? 'var(--tier-normal)' : 'var(--tier-elevated)'} />
              <span className="num-tabular">{backendStatus.latencyMs}ms</span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            {/* Role Switcher Pill for Live Demonstrations */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ROLE:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const found = DUMMY_ACCOUNTS.find((u) => u.id === e.target.value);
                  if (found) handleLogin(found);
                }}
                aria-label="Active Security Role Switcher"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {DUMMY_ACCOUNTS.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.role.split(' ')[0]} ({acc.name.split(' ')[1] || acc.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Logged in User Profile Chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.avatarColor,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {currentUser.name[0]}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentUser.name.split(' ')[1] || currentUser.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {currentUser.role.split(' ')[0]}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out of console"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '4px',
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="app-main">
        {activeTab === 'live' ? (
          <>
            {/* Forecast-to-Live Predictive Linkage Strip */}
            <ForecastLinkageStrip
              zone={forecastTriggerZone}
              events={events}
            />

            {/* 4-Zone Live Telemetry Grid & Floorplan Map */}
            <ZoneGrid
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZone={(id) => setSelectedZoneId(id)}
            />

            {/* Multimodal Sensor Fusion Discrepancy Component */}
            <SignalBreakdown zone={selectedZone} />

            {/* Incident & Telemetry Transition Audit Timeline */}
            <IncidentLog
              logs={incidentLogs}
              onClearLogs={() => setIncidentLogs([])}
            />

            {/* Presenter Ingestion / Simulation Panel with RBAC */}
            <ControlPanel
              zonesList={zonesSummaryList}
              onTelemetryUpdated={() => refetch()}
              currentUser={currentUser}
              onLogIncident={handleLogIncident}
            />
          </>
        ) : activeTab === 'forecast' ? (
          <>
            {/* 48-Hour Predictive Horizon Chart with Event Driver Spikes */}
            <ForecastChart
              selectedZoneId={selectedZoneId}
              zonesList={zonesSummaryList}
              onSelectZone={(id) => setSelectedZoneId(id)}
              onOpenMetrics={() => setShowMetricsModal(true)}
            />

            {/* Scheduled City Events & Transit Peaks */}
            <EventTimeline zoneMap={zoneMap} />
          </>
        ) : (
          <EventPlanner
            initialZoneId={selectedZoneId}
            onSelectZone={(id) => setSelectedZoneId(id)}
          />
        )}
      </main>

      {/* Model Evaluation Metrics Modal */}
      <AboutForecastModal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
      />

      {/* Pitch One-Liner Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div>
            <strong>CrowdGuard Defense Doctrine:</strong> Existing systems react to a crowd that has already formed.
            CrowdGuard forecasts where crowds will form from city event data (calibrated on synthetic footfall), then verifies on the ground with camera and Bluetooth signals that cover each other's blind spots. No faces stored.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <AlertOctagon size={14} color="var(--text-muted)" />
            <span>Active Operator: {currentUser.name} • {currentUser.clearance}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
