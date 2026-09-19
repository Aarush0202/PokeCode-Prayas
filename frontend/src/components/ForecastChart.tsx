import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import type { ForecastResponse, ForecastPoint } from '../types/crowdguard';
import { getForecast, getZones } from '../services/api';
import {
  Calendar,
  Clock,
  Sparkles,
  HelpCircle,
  Info,
  TrendingUp,
  Users,
  ShieldAlert,
  Layers,
  Activity,
} from 'lucide-react';
import { PlacePicker } from './PlacePicker';

interface ForecastChartProps {
  selectedZoneId: string;
  zonesList?: Array<{ id: string; name: string; capacity: number }>;
  onSelectZone: (id: string) => void;
  onOpenMetrics?: () => void;
}

const isDriverIllustrative = (drv: string) => {
  const lower = drv.toLowerCase();
  return (
    lower.includes('hackathon') ||
    lower.includes('protest') ||
    lower.includes('illustrative') ||
    lower.includes('assumed')
  );
};

// Typical diurnal pedestrian ratio for baseline comparison
const getDiurnalBaselineRatio = (hour: number, isWeekend: boolean): number => {
  if (hour >= 0 && hour <= 5) return isWeekend ? 0.08 : 0.05;
  if (hour >= 6 && hour <= 8) return isWeekend ? 0.18 : 0.25;
  if (hour >= 9 && hour <= 13) return isWeekend ? 0.45 : 0.48;
  if (hour >= 14 && hour <= 16) return isWeekend ? 0.40 : 0.38;
  if (hour >= 17 && hour <= 21) return isWeekend ? 0.62 : 0.55;
  return isWeekend ? 0.28 : 0.18;
};

interface ForecastTooltipProps {
  active?: boolean;
  payload?: readonly any[];
  capacity: number;
  elevatedThresh: number;
  highThresh: number;
  criticalThresh: number;
}

const ForecastCustomTooltip: React.FC<ForecastTooltipProps> = ({
  active,
  payload,
  capacity,
  elevatedThresh,
  highThresh,
  criticalThresh,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ForecastPoint & {
      timeLabel: string;
      fullDateStr: string;
      hoursDiff: number;
      baselineCount: number;
      eventSurge: number;
    };

    const pct = Math.min(100, Math.round((data.predicted_count / capacity) * 100));

    let tierColor = 'var(--tier-normal)';
    let tierBg = 'var(--tier-normal-bg)';
    let tierBorder = 'var(--tier-normal-border)';
    let actionRecommendation = 'Nominal crowd density. Standard security patrol sufficient.';

    if (data.risk_tier === 'CRITICAL' || data.predicted_count >= criticalThresh) {
      tierColor = 'var(--tier-critical)';
      tierBg = 'var(--tier-critical-bg)';
      tierBorder = 'var(--tier-critical-border)';
      actionRecommendation =
        'CRITICAL STAMPEDE HAZARD: Pre-stage rapid dispersal corridors & open secondary emergency exits.';
    } else if (data.risk_tier === 'HIGH' || data.predicted_count >= highThresh) {
      tierColor = 'var(--tier-high)';
      tierBg = 'var(--tier-high-bg)';
      tierBorder = 'var(--tier-high-border)';
      actionRecommendation =
        'EARLY INTERVENTION ADVISED: Deploy pedestrian stanchions, activate gate metering.';
    } else if (data.risk_tier === 'ELEVATED' || data.predicted_count >= elevatedThresh) {
      tierColor = 'var(--tier-elevated)';
      tierBg = 'var(--tier-elevated-bg)';
      tierBorder = 'var(--tier-elevated-border)';
      actionRecommendation =
        'Heightened traffic expected. Keep marshals stationed near bottleneck choke-points.';
    }

    return (
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          color: '#f8fafc',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${tierBorder}`,
          borderRadius: '12px',
          padding: '14px 16px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          maxWidth: '340px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header with full date and time */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {data.fullDateStr}
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#f8fafc' }}>
              {data.timeLabel}
            </div>
          </div>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              backgroundColor: tierBg,
              color: tierColor,
              border: `1px solid ${tierBorder}`,
            }}
          >
            {data.risk_tier}
          </span>
        </div>

        {/* Main Metric Callout */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 4px 0' }}>
          <span
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: tierColor,
              letterSpacing: '-0.02em',
            }}
          >
            {data.predicted_count.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
            occupants / {capacity.toLocaleString()} max
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: tierColor,
            }}
          >
            {pct}%
          </span>
        </div>

        {/* Mini Capacity Progress Gauge with Threshold Milestones */}
        <div style={{ margin: '8px 0 12px 0' }}>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: tierColor,
                borderRadius: '999px',
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.68rem',
              color: '#64748b',
              marginTop: '3px',
              fontWeight: 600,
            }}
          >
            <span>Safe (0-48%)</span>
            <span>Caution (70%)</span>
            <span>Max (100%)</span>
          </div>
        </div>

        {/* Breakdown Row: Density, Baseline, Event Surge */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '8px',
            borderRadius: '8px',
            marginBottom: '10px',
            fontSize: '0.74rem',
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Density</div>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
              {data.predicted_density} /m²
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Baseline</div>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
              ~{data.baselineCount}
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Surge Lift</div>
            <div
              style={{
                fontWeight: 700,
                color: data.eventSurge > 0 ? 'var(--tier-high)' : '#94a3b8',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {data.eventSurge > 0 ? `+${data.eventSurge}` : '0'}
            </div>
          </div>
        </div>

        {/* Drivers Section */}
        {data.drivers && data.drivers.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
              KEY PREDICTIVE DRIVERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {data.drivers.map((drv, idx) => {
                const illustrative = isDriverIllustrative(drv);
                return (
                  <div
                    key={idx}
                    style={{
                      fontSize: '0.76rem',
                      color: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: tierColor }} />
                    <span>{drv}</span>
                    {illustrative && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(217, 119, 6, 0.25)',
                          color: '#fbbf24',
                          fontWeight: 700,
                        }}
                      >
                        [Assumed Event]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tactical Recommendation */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '6px',
            fontSize: '0.72rem',
            color: '#94a3b8',
            lineHeight: 1.35,
          }}
        >
          <strong style={{ color: tierColor }}>ACTION: </strong>
          {actionRecommendation}
        </div>
      </div>
    );
  }
  return null;
};

export const ForecastChart: React.FC<ForecastChartProps> = ({
  selectedZoneId,
  zonesList = [],
  onSelectZone,
  onOpenMetrics,
}) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [allZones, setAllZones] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // User Controls for Horizon & Overlays
  const [horizonFilter, setHorizonFilter] = useState<12 | 24 | 48>(48);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [showRiskBands] = useState<boolean>(true);

  useEffect(() => {
    getZones()
      .then((zs) => {
        setAllZones(zs.map((z) => ({ id: z.id, name: z.name, capacity: z.capacity })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getForecast(selectedZoneId, 48)
      .then((data) => {
        if (isMounted) {
          setForecast(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[ForecastChart] Failed to load forecast:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedZoneId]);

  const currentZone =
    allZones.find((z) => z.id === selectedZoneId) ??
    zonesList.find((z) => z.id === selectedZoneId);
  const capacity = currentZone?.capacity ?? 900;

  // Key Safety Thresholds
  const elevatedThresh = Math.round(capacity * 0.48);
  const highThresh = Math.round(capacity * 0.70);
  const criticalThresh = Math.round(capacity * 0.90);

  // Format data for recharts with enriched time stamps and baseline
  const fullChartData = useMemo(() => {
    if (!forecast?.points) return [];
    const now = new Date();

    return forecast.points.map((pt, index) => {
      const d = new Date(pt.timestamp);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const hour = d.getHours();

      // Days relative to now
      const isToday = d.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();

      const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' });
      const shortHour = d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
      const fullDateStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      // Baseline estimate
      const baselineRatio = getDiurnalBaselineRatio(hour, isWeekend);
      const baselineCount = Math.round(capacity * baselineRatio);
      const eventSurge = Math.max(0, pt.predicted_count - baselineCount);

      return {
        ...pt,
        index,
        hour,
        timeLabel: `${dayLabel} ${shortHour}`,
        shortHour,
        dayLabel,
        fullDateStr,
        hoursDiff: index,
        baselineCount,
        eventSurge,
      };
    });
  }, [forecast, capacity]);

  // Filter based on selected horizon (12, 24, or 48 hours)
  const chartData = useMemo(() => {
    return fullChartData.slice(0, horizonFilter);
  }, [fullChartData, horizonFilter]);

  // Find absolute maximum spike point within the active view
  const peakPoint = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    let max = chartData[0];
    for (const pt of chartData) {
      if (pt.predicted_count > max.predicted_count) {
        max = pt;
      }
    }
    return max;
  }, [chartData]);

  // Calculate hours until peak
  const peakHoursDiff = peakPoint ? peakPoint.hoursDiff : 0;

  // Dynamic Y-Axis upper bound to give breathing room above the peak
  const maxForecastVal = peakPoint ? peakPoint.predicted_count : capacity;
  const yAxisMax = Math.max(Math.ceil(capacity * 1.15), Math.ceil(maxForecastVal * 1.12));

  // Determine overall peak tier styling
  const isPeakHigh = (peakPoint?.predicted_count ?? 0) >= highThresh;

  // Custom X-Axis Tick renderer for clear, readable day & hour labels
  const CustomXAxisTick = (tickProps: any) => {
    const { x, y, payload } = tickProps;
    const point = chartData[payload.index];
    if (!point) return null;

    const isNow = payload.index === 0;
    const isMidnight = point.hour === 0;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill={isNow ? 'var(--tier-normal)' : isMidnight ? 'var(--text-primary)' : 'var(--text-secondary)'}
          fontSize={11}
          fontWeight={isMidnight || isNow ? 700 : 500}
        >
          {point.shortHour}
        </text>
        <text
          x={0}
          y={0}
          dy={26}
          textAnchor="middle"
          fill={isNow ? 'var(--tier-normal)' : 'var(--text-muted)'}
          fontSize={9.5}
          fontWeight={600}
          letterSpacing="0.02em"
        >
          {isNow ? '● LIVE' : point.dayLabel}
        </text>
      </g>
    );
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '22px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      {/* Top Header & Interactive Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                48-Hour Predictive Risk Horizon
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Early-warning crowd forecasting fusing scheduled city events, transit timelines, and diurnal footfall patterns.
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Place Picker, Horizon Tabs, Layer Toggles, Metrics */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Place Picker Combobox */}
          <PlacePicker selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} />

          {/* Horizon View Selector (12h, 24h, 48h) */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface-elevated)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {([12, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizonFilter(h)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: horizonFilter === h ? 700 : 500,
                  backgroundColor: horizonFilter === h ? 'var(--bg-surface)' : 'transparent',
                  color: horizonFilter === h ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: horizonFilter === h ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {h}h View
              </button>
            ))}
          </div>

          {/* Baseline Toggle */}
          <button
            type="button"
            onClick={() => setShowBaseline((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: showBaseline ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              color: showBaseline ? 'var(--text-primary)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
            title="Toggle normal baseline without special events"
          >
            <Layers size={13} color={showBaseline ? '#818cf8' : 'var(--text-muted)'} />
            <span>Baseline</span>
          </button>

          {/* About Forecast Metrics Modal */}
          {onOpenMetrics && (
            <button
              type="button"
              onClick={onOpenMetrics}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 11px',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Info size={13} />
              <span>Model Metrics</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Executive KPI Cards for Instant Comprehension */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Card 1: Live Now */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--tier-normal-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tier-normal)',
              flexShrink: 0,
            }}
          >
            <Users size={19} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Current Ground Truth
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {chartData[0]?.predicted_count.toLocaleString() ?? '—'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {chartData[0] ? `${Math.round((chartData[0].predicted_count / capacity) * 100)}% capacity` : 'Syncing'}
            </div>
          </div>
        </div>

        {/* Card 2: Projected Peak Spike */}
        <div
          style={{
            backgroundColor: isPeakHigh ? 'var(--tier-high-bg)' : 'var(--bg-surface)',
            border: `1px solid ${isPeakHigh ? 'var(--tier-high-border)' : 'var(--border-subtle)'}`,
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: isPeakHigh ? 'rgba(234, 88, 12, 0.2)' : 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPeakHigh ? 'var(--tier-high)' : 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={19} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: isPeakHigh ? 'var(--tier-high)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Forecasted Peak Spike
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: isPeakHigh ? 'var(--tier-high)' : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {peakPoint?.predicted_count.toLocaleString() ?? '—'}
            </div>
            <div style={{ fontSize: '0.74rem', color: isPeakHigh ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {peakPoint ? `${peakPoint.timeLabel} (${Math.round((peakPoint.predicted_count / capacity) * 100)}%)` : '—'}
            </div>
          </div>
        </div>

        {/* Card 3: Lead Time to Peak */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            <Clock size={19} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Actionable Window
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              +{peakHoursDiff} hours
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {peakPoint?.drivers?.[0] ?? 'Diurnal progression'}
            </div>
          </div>
        </div>

        {/* Card 4: Design Capacity Limit */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={19} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Safe Venue Capacity
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {capacity.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              High risk starts at {highThresh.toLocaleString()} (70%)
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Driver Callout Banner for Peak Spike */}
      {peakPoint && isPeakHigh && (
        <div
          style={{
            backgroundColor: 'var(--tier-high-bg)',
            border: '1px solid var(--tier-high-border)',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="var(--tier-high)" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <strong>Early Warning Alert for {peakPoint.timeLabel}:</strong> Anticipating peak spike of{' '}
              <span className="num-tabular" style={{ fontWeight: 800, color: 'var(--tier-high)', fontSize: '1rem' }}>
                {peakPoint.predicted_count.toLocaleString()}
              </span>{' '}
              occupants ({Math.round((peakPoint.predicted_count / capacity) * 100)}% capacity) driven by{' '}
              <em>"{peakPoint.drivers[0]}"</em>
              {isDriverIllustrative(peakPoint.drivers[0]) && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.74rem',
                    color: 'var(--tier-elevated)',
                    fontWeight: 700,
                  }}
                >
                  [Assumed Event]
                </span>
              )}.
            </span>
          </div>
          <span className="tier-badge tier-HIGH" style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
            PRE-STAGE BARRICADES & CROWD FLOW
          </span>
        </div>
      )}

      {/* Chart Canvas */}
      {loading ? (
        <div
          style={{
            height: '380px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <Activity size={28} className="animate-spin" />
          <span>Synthesizing predictive crowd trajectory across {horizonFilter} hours...</span>
        </div>
      ) : (
        <div style={{ width: '100%', height: '380px', position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 25, right: 35, left: 25, bottom: 25 }}
            >
              <defs>
                {/* Gradient for Primary Forecast Area */}
                <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)'}
                    stopOpacity={0.48}
                  />
                  <stop
                    offset="55%"
                    stopColor={isPeakHigh ? 'var(--tier-elevated)' : 'var(--tier-normal)'}
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--bg-card)"
                    stopOpacity={0.0}
                  />
                </linearGradient>

                {/* Gradient for Baseline Area */}
                <linearGradient id="baselineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <CartesianGrid strokeDasharray="3 4" stroke="var(--border-subtle)" vertical={false} />

              {/* X-Axis: Time Horizon with custom tick formatter */}
              <XAxis
                dataKey="timeLabel"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                interval={horizonFilter === 12 ? 1 : horizonFilter === 24 ? 3 : 5}
                tick={CustomXAxisTick}
                height={48}
                label={{
                  value: `Timeline (IST / Indian Standard Time • Next ${horizonFilter} Hours)`,
                  position: 'insideBottom',
                  offset: -4,
                  style: { fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 },
                }}
              />

              {/* Y-Axis: Occupancy Headcount with clear unit title */}
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[0, yAxisMax]}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                className="num-tabular"
                width={52}
                label={{
                  value: 'Headcount (Persons)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 0,
                  style: { textAnchor: 'middle', fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 },
                }}
              />

              {/* Enhanced Custom Tooltip */}
              <Tooltip
                content={(props) => (
                  <ForecastCustomTooltip
                    {...props}
                    capacity={capacity}
                    elevatedThresh={elevatedThresh}
                    highThresh={highThresh}
                    criticalThresh={criticalThresh}
                  />
                )}
              />

              {/* Optional Shaded Risk Bands */}
              {showRiskBands && (
                <>
                  <ReferenceArea
                    y1={0}
                    y2={elevatedThresh}
                    fill="var(--tier-normal)"
                    fillOpacity={0.03}
                    stroke="none"
                  />
                  <ReferenceArea
                    y1={elevatedThresh}
                    y2={highThresh}
                    fill="var(--tier-elevated)"
                    fillOpacity={0.05}
                    stroke="none"
                  />
                  <ReferenceArea
                    y1={highThresh}
                    y2={criticalThresh}
                    fill="var(--tier-high)"
                    fillOpacity={0.08}
                    stroke="none"
                  />
                  <ReferenceArea
                    y1={criticalThresh}
                    y2={yAxisMax}
                    fill="var(--tier-critical)"
                    fillOpacity={0.12}
                    stroke="none"
                  />
                </>
              )}

              {/* Safety Reference Milestone Lines */}
              <ReferenceLine
                y={elevatedThresh}
                stroke="var(--tier-elevated)"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: `Elevated (48%): ${elevatedThresh}`,
                  fill: 'var(--tier-elevated)',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontWeight: 600,
                }}
              />
              <ReferenceLine
                y={highThresh}
                stroke="var(--tier-high)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `High Danger (70%): ${highThresh}`,
                  fill: 'var(--tier-high)',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontWeight: 700,
                }}
              />
              <ReferenceLine
                y={capacity}
                stroke="var(--tier-critical)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                label={{
                  value: `Max Capacity Ceiling: ${capacity}`,
                  fill: 'var(--tier-critical)',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontWeight: 800,
                }}
              />

              {/* Current Time Landmark Reference Line */}
              {chartData[0] && (
                <ReferenceLine
                  x={chartData[0].timeLabel}
                  stroke="var(--tier-normal)"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{
                    value: 'LIVE SYNC',
                    fill: 'var(--tier-normal)',
                    fontSize: 10,
                    fontWeight: 700,
                    position: 'top',
                  }}
                />
              )}

              {/* Peak Point Reference Dot Marker */}
              {peakPoint && (
                <ReferenceDot
                  x={peakPoint.timeLabel}
                  y={peakPoint.predicted_count}
                  r={6}
                  fill={isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{
                    value: `PEAK: ${peakPoint.predicted_count}`,
                    position: 'top',
                    fill: isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                />
              )}

              {/* Optional Secondary Series: Baseline Diurnal Profile (Without Events) */}
              {showBaseline && (
                <Area
                  type="monotone"
                  dataKey="baselineCount"
                  name="Nominal Baseline"
                  stroke="#818cf8"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  fill="url(#baselineAreaGrad)"
                  activeDot={false}
                />
              )}

              {/* Primary Series: Predicted Headcount (With All Events & Modifiers) */}
              <Area
                type="monotone"
                dataKey="predicted_count"
                name="Predicted Occupancy"
                stroke={isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)'}
                strokeWidth={3}
                fill="url(#forecastAreaGrad)"
                activeDot={{
                  r: 7,
                  fill: 'var(--text-primary)',
                  stroke: isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)',
                  strokeWidth: 3,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend & Explanatory Metadata Footer */}
      <div
        style={{
          marginTop: '6px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          {/* Visual Legend Tags */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '14px',
                  height: '3.5px',
                  backgroundColor: isPeakHigh ? 'var(--tier-high)' : 'var(--tier-normal)',
                  display: 'inline-block',
                  borderRadius: '2px',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Predicted Headcount</span>
            </div>

            {showBaseline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '14px',
                    height: '2px',
                    borderTop: '2px dashed #818cf8',
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: '#818cf8', fontWeight: 600 }}>Diurnal Baseline (No Events)</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: 'rgba(234, 88, 12, 0.15)',
                  border: '1px dashed var(--tier-high)',
                  display: 'inline-block',
                  borderRadius: '2px',
                }}
              />
              <span>High Risk Band (&gt;70%)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid var(--tier-critical)',
                  display: 'inline-block',
                  borderRadius: '2px',
                }}
              />
              <span>Critical Hazard (&gt;90%)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <Clock size={13} />
            <span>Refreshes dynamically on municipal calendar ingestion</span>
          </div>
        </div>

        {/* Small Print Mandated by Brief */}
        <div
          style={{
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <HelpCircle size={13} style={{ flexShrink: 0 }} />
          <span>
            Forecast trajectory generated by category-based Random Forest regressor with DMRC calibration, municipal permit overlays, and diurnal baseline tracking. Assumed hackathon events are flagged.
          </span>
        </div>
      </div>
    </div>
  );
};
