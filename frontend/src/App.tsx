import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { useLiveRisk } from './hooks/useLiveRisk';
import { getAlerts, checkBackendHealth } from './services/api';
import type { Alert } from './types/crowdguard';
import { AlertBanner } from './components/AlertBanner';
import { ZoneGrid } from './components/ZoneGrid';
import { SignalBreakdown } from './components/SignalBreakdown';
import { ForecastChart } from './components/ForecastChart';
import { ControlPanel } from './components/ControlPanel';
import { EventTimeline } from './components/EventTimeline';
import { Shield, Activity, TrendingUp, Radio, AlertOctagon } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'forecast'>('live');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('z3'); // Default to Market Street (high interest)
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [backendStatus, setBackendStatus] = useState<{ status: string; latencyMs: number }>({
    status: 'healthy',
    latencyMs: 12,
  });

  const { zones, degraded, lastUpdated, refetch } = useLiveRisk(3000);

  // Poll alerts every 5 seconds
  useEffect(() => {
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
  }, []);

  // Poll backend health & latency every 6 seconds
  useEffect(() => {
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
  }, []);

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

  return (
    <div className="app-container">
      {/* Top Alert Banner for Active Alarms */}
      <AlertBanner alerts={alerts} />

      {/* Primary Command Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-logo">
              <Shield size={20} color="#f8fafc" />
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
          </div>

          {/* Operational Status & Telemetry Pill */}
          <div className="header-meta">
            <div
              className="status-pill"
              title={degraded ? 'Backend disconnected or in mock mode; using local safety fixtures' : 'Connected to live backend stream'}
            >
              <span className={`indicator-dot ${degraded ? 'indicator-degraded' : 'indicator-live'}`} />
              <span style={{ color: 'var(--text-primary)' }}>
                {degraded ? 'SAMPLE DATA (Fallback Mode)' : 'LIVE TELEMETRY'}
              </span>
              <span style={{ color: 'var(--text-muted)' }} className="num-tabular">
                ({secondsAgo}s ago)
              </span>
            </div>

            {/* Backend Latency Pill */}
            <div className="status-pill" style={{ fontSize: '0.75rem' }}>
              <Radio size={12} color={backendStatus.status === 'healthy' ? 'var(--tier-normal)' : 'var(--tier-elevated)'} />
              <span className="num-tabular">{backendStatus.latencyMs}ms</span>
              <span style={{ color: 'var(--text-muted)' }}>({backendStatus.status})</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="app-main">
        {activeTab === 'live' ? (
          <>
            {/* 4-Zone Live Telemetry Grid */}
            <ZoneGrid
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZone={(id) => setSelectedZoneId(id)}
            />

            {/* Multimodal Sensor Fusion Discrepancy Component */}
            <SignalBreakdown zone={selectedZone} />

            {/* Presenter Ingestion / Simulation Panel */}
            <ControlPanel
              zonesList={zonesSummaryList}
              onTelemetryUpdated={() => refetch()}
            />
          </>
        ) : (
          <>
            {/* 48-Hour Predictive Horizon Chart with Event Driver Spikes */}
            <ForecastChart
              selectedZoneId={selectedZoneId}
              zonesList={zonesSummaryList}
              onSelectZone={(id) => setSelectedZoneId(id)}
            />

            {/* Scheduled City Events & Transit Peaks */}
            <EventTimeline zoneMap={zoneMap} />
          </>
        )}
      </main>

      {/* Pitch One-Liner Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div>
            <strong>CrowdGuard Defense Doctrine:</strong> Existing systems react to a crowd that has already formed.
            CrowdGuard predicts where crowds will form from city event data, then verifies on the ground with camera and Bluetooth signals that cover each other's blind spots.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <AlertOctagon size={14} color="var(--text-muted)" />
            <span>Privacy Standard: No facial recognition; BLE MAC addresses anonymized in-memory.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
