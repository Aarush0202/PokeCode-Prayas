import React, { useState, useEffect, useMemo } from 'react';
import type { MetroOverviewResponse, ZoneRisk, VisionSignal, BeaconSignal } from '../types/crowdguard';
import type { UserProfile } from './LoginPage';
import { getMetroStatus } from '../services/api';
import { MetroLineHeader } from './MetroLineHeader';
import { MetroStationMap } from './MetroStationMap';
import { CameraFeedModal } from './CameraFeedModal';
import {
  Sliders,
  CheckCircle2,
} from 'lucide-react';

interface DelhiMetroDashboardProps {
  currentUser: UserProfile;
}

export const DelhiMetroDashboard: React.FC<DelhiMetroDashboardProps> = ({ currentUser }) => {
  const [data, setData] = useState<MetroOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStationId, setSelectedStationId] = useState<string>('dm_z1');
  const [showCamModal, setShowCamModal] = useState<boolean>(false);

  // Control panel action states
  const [dispatchRateMins, setDispatchRateMins] = useState<number>(2.5);
  const [gateThrottlingActive, setGateThrottlingActive] = useState<boolean>(true);
  const [escalatorSpeed, setEscalatorSpeed] = useState<'0.75m/s' | '0.50m/s' | '0.25m/s'>('0.50m/s');
  const [diversionActive, setDiversionActive] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getMetroStatus()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load metro status:', err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedStation = useMemo(() => {
    if (!data?.stations) return null;
    return data.stations.find((s) => s.station_id === selectedStationId) || data.stations[0];
  }, [data, selectedStationId]);

  // Map MetroStationTelemetry into ZoneRisk for CameraFeedModal compatibility
  const currentZoneRiskForModal: ZoneRisk | null = useMemo(() => {
    if (!selectedStation) return null;

    const vision: VisionSignal = {
      zone_id: selectedStation.station_id,
      timestamp: new Date().toISOString(),
      person_count: Math.round(selectedStation.current_occupancy * 0.72),
      density_per_sqm: selectedStation.platform_1_density,
      flow: { dx: 0.12, dy: 0.15, magnitude: 0.19 },
      confidence: 0.94,
    };

    const beacon: BeaconSignal = {
      zone_id: selectedStation.station_id,
      timestamp: new Date().toISOString(),
      unique_devices: Math.round(selectedStation.current_occupancy * 0.88),
      scanner_id: `dmrc-ble-${selectedStation.station_id}`,
    };

    return {
      zone_id: selectedStation.station_id,
      zone_name: selectedStation.station_name,
      timestamp: new Date().toISOString(),
      risk_score: selectedStation.risk_score,
      risk_tier: selectedStation.risk_tier,
      level: selectedStation.risk_tier,
      fused_estimate: selectedStation.current_occupancy,
      occupancy: selectedStation.current_occupancy / selectedStation.max_capacity,
      capacity: selectedStation.max_capacity,
      vision,
      beacon,
      forecast_pressure: selectedStation.dmrc_forecast_pressure,
      reasons: [
        `Turnstile throughput: ${selectedStation.turnstile_throughput_ppm} commuters/min`,
        `Underground platform density: ${selectedStation.platform_1_density} persons/m²`,
        `DMRC peak ridership model calibration active`,
      ],
      has_live_signals: true,
      signal_status: 'ok',
    };
  }, [selectedStation]);

  const handleApplyControl = (actionName: string) => {
    setActionSuccessMsg(`Executed: ${actionName} for ${selectedStation?.station_name ?? 'Metro Network'}`);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Connecting to Delhi Metro Rail Corporation (DMRC) telemetry stream...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Network Header & Line Health Ticker */}
      <MetroLineHeader
        lines={data.lines}
        totalRidership={data.total_daily_ridership_calibration}
        activeTrains={data.active_train_count}
        networkStatus={data.network_status}
      />

      {/* Main 2-Column Grid: Station Telemetry Grid vs Station Spatial Map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Left Column: Metro Stations Telemetry Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Monitored Metro Hubs ({data.stations.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click station to isolate spatial map
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {data.stations.map((st) => {
              const isSelected = st.station_id === selectedStationId;
              const occPct = Math.min(100, Math.round((st.current_occupancy / st.max_capacity) * 100));

              let tierBg = 'var(--tier-normal-bg)';
              let tierBorder = 'var(--tier-normal-border)';
              let tierColor = 'var(--tier-normal)';

              if (st.risk_tier === 'CRITICAL' || st.risk_score >= 0.85) {
                tierBg = 'var(--tier-critical-bg)';
                tierBorder = 'var(--tier-critical-border)';
                tierColor = 'var(--tier-critical)';
              } else if (st.risk_tier === 'HIGH' || st.risk_score >= 0.65) {
                tierBg = 'var(--tier-high-bg)';
                tierBorder = 'var(--tier-high-border)';
                tierColor = 'var(--tier-high)';
              } else if (st.risk_tier === 'ELEVATED' || st.risk_score >= 0.40) {
                tierBg = 'var(--tier-elevated-bg)';
                tierBorder = 'var(--tier-elevated-border)';
                tierColor = 'var(--tier-elevated)';
              }

              return (
                <div
                  key={st.station_id}
                  onClick={() => setSelectedStationId(st.station_id)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid #eab308' : `1px solid ${tierBorder}`,
                    padding: '14px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 12px rgba(234, 179, 8, 0.3)' : 'var(--shadow-card)',
                    transition: 'transform 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {st.station_name}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {st.line_intersections.map((line) => (
                          <span
                            key={line}
                            style={{
                              fontSize: '0.64rem',
                              backgroundColor: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: tierBg,
                        color: tierColor,
                        border: `1px solid ${tierBorder}`,
                      }}
                    >
                      {st.risk_tier}
                    </span>
                  </div>

                  {/* Occupancy Progress Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Concourse Occupancy</span>
                      <strong style={{ color: tierColor, fontFamily: 'var(--font-mono)' }}>
                        {st.current_occupancy} / {st.max_capacity} ({occPct}%)
                      </strong>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${occPct}%`, height: '100%', backgroundColor: tierColor, borderRadius: '999px' }} />
                    </div>
                  </div>

                  {/* Stats Row: Turnstile rate & DMRC pressure */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>Turnstiles: <strong style={{ color: 'var(--text-primary)' }}>{st.turnstile_throughput_ppm} p/min</strong></span>
                    <span>DMRC Forecast: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(st.dmrc_forecast_pressure * 100)}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Spatial Station Map */}
        {selectedStation && (
          <MetroStationMap
            station={selectedStation}
            onOpenCamModal={() => setShowCamModal(true)}
          />
        )}
      </div>

      {/* Metro Tactical Control Panel */}
      {selectedStation && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="#eab308" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                DMRC Tactical Operations Panel — {selectedStation.station_name}
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Clearance: <strong>{currentUser.clearance} ({currentUser.role})</strong>
            </span>
          </div>

          {actionSuccessMsg && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* Control 1: Train Headway Dispatch Modulation */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Train Dispatch Frequency
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Modulate train headway to inject empty rakes during platform congestion.
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[2.0, 2.5, 3.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setDispatchRateMins(rate);
                      handleApplyControl(`Train Headway ${rate} mins`);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '0.76rem',
                      fontWeight: dispatchRateMins === rate ? 800 : 500,
                      backgroundColor: dispatchRateMins === rate ? '#eab308' : 'var(--bg-surface-elevated)',
                      color: dispatchRateMins === rate ? '#000000' : 'var(--text-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {rate} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Turnstile Gate Throttling */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Turnstile Ingress Metering
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Restrict AFC gate ingress to match platform evacuation throughput.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGateThrottlingActive((prev) => !prev);
                  handleApplyControl(gateThrottlingActive ? 'Disabled Gate Throttling' : 'Activated Gate Throttling');
                }}
                style={{
                  width: '100%',
                  padding: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  backgroundColor: gateThrottlingActive ? 'var(--tier-high-bg)' : 'var(--bg-surface-elevated)',
                  color: gateThrottlingActive ? 'var(--tier-high)' : 'var(--text-primary)',
                  border: `1px solid ${gateThrottlingActive ? 'var(--tier-high-border)' : 'var(--border-subtle)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {gateThrottlingActive ? '● Ingress Metering ACTIVE' : '○ Ingress Metering OFF'}
              </button>
            </div>

            {/* Control 3: Escalator Speed Regulation */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Escalator Speed Regulation
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Slow down ingress escalators when platforms reach 85% capacity.
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['0.75m/s', '0.50m/s', '0.25m/s'] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      setEscalatorSpeed(spd);
                      handleApplyControl(`Escalator speed set to ${spd}`);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '0.72rem',
                      fontWeight: escalatorSpeed === spd ? 800 : 500,
                      backgroundColor: escalatorSpeed === spd ? '#eab308' : 'var(--bg-surface-elevated)',
                      color: escalatorSpeed === spd ? '#000000' : 'var(--text-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>

            {/* Control 4: Commuter Diversion Announcement */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                PA Audio & Digital Signage Diversion
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                Broadcast alternate line transfer routes to bypass Rajiv Chowk.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDiversionActive((prev) => !prev);
                  handleApplyControl(diversionActive ? 'Stopped PA Broadcast' : 'Broadcasting Commuter Diversions');
                }}
                style={{
                  width: '100%',
                  padding: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  backgroundColor: diversionActive ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface-elevated)',
                  color: diversionActive ? '#60a5fa' : 'var(--text-primary)',
                  border: `1px solid ${diversionActive ? '#3b82f6' : 'var(--border-subtle)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {diversionActive ? 'Broadcast ACTIVE' : 'Trigger Diversion PA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CCTV Camera HUD Modal compatibility */}
      {currentZoneRiskForModal && (
        <CameraFeedModal
          isOpen={showCamModal}
          onClose={() => setShowCamModal(false)}
          zone={currentZoneRiskForModal}
        />
      )}
    </div>
  );
};
