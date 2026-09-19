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
  CartesianGrid,
} from 'recharts';
import type { ForecastResponse, ForecastPoint } from '../types/crowdguard';
import { getForecast, getZones } from '../services/api';
import { Calendar, Clock, Sparkles, HelpCircle, Info } from 'lucide-react';
import { PlacePicker } from './PlacePicker';

interface ForecastChartProps {
  selectedZoneId: string;
  zonesList?: Array<{ id: string; name: string; capacity: number }>;
  onSelectZone: (id: string) => void;
  onOpenMetrics?: () => void;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  selectedZoneId,
  zonesList = [],
  onSelectZone,
  onOpenMetrics,
}) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [allZones, setAllZones] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

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


  // Thresholds based on capacity
  const elevatedThresh = Math.round(capacity * 0.48);
  const highThresh = Math.round(capacity * 0.70);
  const criticalThresh = Math.round(capacity * 0.90);

  // Format data for recharts
  const chartData = useMemo(() => {
    if (!forecast?.points) return [];
    return forecast.points.map((pt, index) => {
      const d = new Date(pt.timestamp);
      const isTomorrow = d.getDate() !== new Date().getDate();
      const hourStr = d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
      const dayLabel = isTomorrow ? 'Tomorrow' : 'Today';

      return {
        ...pt,
        index,
        timeLabel: `${dayLabel} ${hourStr}`,
        shortHour: hourStr,
        dayLabel,
        isPeak: false,
      };
    });
  }, [forecast]);

  // Find the absolute maximum spike point to annotate prominently
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

const isDriverIllustrative = (drv: string) => {
  const lower = drv.toLowerCase();
  return lower.includes('hackathon') || lower.includes('protest') || lower.includes('illustrative') || lower.includes('assumed');
};

interface ForecastTooltipProps {
  active?: boolean;
  payload?: readonly any[];
  capacity: number;
}

const ForecastCustomTooltip: React.FC<ForecastTooltipProps> = ({ active, payload, capacity }) => {
  if (active && payload && payload.length) {
    const data: ForecastPoint & { timeLabel: string } = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-card)',
          maxWidth: '320px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {data.timeLabel}
          </span>
          <span className={`tier-badge tier-${data.risk_tier}`}>
            {data.risk_tier}
          </span>
        </div>

        <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '4px 0' }} className="num-tabular">
          {data.predicted_count}{' '}
          <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
            predicted ({Math.round((data.predicted_count / capacity) * 100)}% capacity)
          </span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Projected density: <span className="num-tabular">{data.predicted_density}</span> / m²
        </div>

        {data.drivers && data.drivers.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--tier-elevated)', marginBottom: '4px' }}>
              PRIMARY PREDICTIVE DRIVER:
            </div>
            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              {data.drivers.map((drv, idx) => {
                const illustrative = isDriverIllustrative(drv);
                return (
                  <li key={idx} style={{ marginBottom: '2px' }}>
                    {drv}
                    {illustrative && (
                      <span
                        style={{
                          marginLeft: '6px',
                          fontSize: '0.68rem',
                          color: 'var(--tier-elevated)',
                          fontWeight: 700,
                        }}
                      >
                        [Illustrative]
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return null;
};


  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '20px 24px',
      }}
    >
      {/* Header with Searchable Place Picker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--text-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              48-Hour Predictive Risk Horizon
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Synthesized forecast integrating scheduled city permits, mass-transit timelines, and diurnal pedestrian flows.
          </p>
        </div>

        {/* Place Picker Combobox & About Button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PlacePicker
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
          />
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
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Info size={13} />
              <span>About this forecast</span>
            </button>
          )}
        </div>
      </div>

      {/* Prominent Driver Callout Banner for Peak Spike */}
      {peakPoint && peakPoint.predicted_count > highThresh && (
        <div
          style={{
            backgroundColor: 'var(--tier-high-bg)',
            border: '1px solid var(--tier-high-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} color="var(--tier-high)" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              <strong>Forecast Alert on {peakPoint.timeLabel}:</strong> Spike reaching{' '}
              <span className="num-tabular" style={{ fontWeight: 700, color: 'var(--tier-high)' }}>
                {peakPoint.predicted_count}
              </span>{' '}
              occupants driven by <em>"{peakPoint.drivers[0]}"</em>
              {isDriverIllustrative(peakPoint.drivers[0]) && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.72rem',
                    color: 'var(--tier-elevated)',
                    fontWeight: 700,
                  }}
                >
                  [Illustrative]
                </span>
              )}.
            </span>
          </div>
          <span className="tier-badge tier-HIGH" style={{ fontSize: '0.72rem' }}>
            EARLY INTERVENTION ADVISED
          </span>
        </div>
      )}

      {/* Chart Canvas */}
      {loading ? (
        <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Computing predictive trajectories...
        </div>
      ) : (
        <div style={{ width: '100%', height: '320px', position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--tier-high)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--tier-normal)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />

              <XAxis
                dataKey="timeLabel"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                interval={5}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[0, Math.ceil(capacity * 1.15)]}
                className="num-tabular"
              />

              <Tooltip content={(props) => <ForecastCustomTooltip {...props} capacity={capacity} />} />

              {/* Reference Areas for Danger Bands */}
              <ReferenceArea
                y1={highThresh}
                y2={criticalThresh}
                fill="var(--tier-high)"
                fillOpacity={0.08}
                stroke="none"
              />
              <ReferenceArea
                y1={criticalThresh}
                fill="var(--tier-critical)"
                fillOpacity={0.12}
                stroke="none"
              />

              {/* Threshold Lines */}
              <ReferenceLine
                y={elevatedThresh}
                stroke="var(--tier-elevated)"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: 'Elevated Threshold', fill: 'var(--tier-elevated)', fontSize: 10, position: 'insideTopRight' }}
              />
              <ReferenceLine
                y={highThresh}
                stroke="var(--tier-high)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: 'High Danger Threshold', fill: 'var(--tier-high)', fontSize: 10, position: 'insideTopRight' }}
              />

              {/* Current Time Reference */}
              <ReferenceLine
                x={chartData[0]?.timeLabel}
                stroke="var(--text-primary)"
                strokeWidth={2}
                label={{ value: 'NOW', fill: 'var(--text-primary)', fontSize: 10, position: 'top' }}
              />

              <Area
                type="monotone"
                dataKey="predicted_count"
                stroke="var(--tier-high)"
                strokeWidth={2.5}
                fill="url(#forecastAreaGrad)"
                activeDot={{ r: 6, fill: 'var(--text-primary)', stroke: 'var(--tier-high)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend & Required Small Print */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', backgroundColor: 'var(--tier-high)', display: 'inline-block' }} />
              <span>Predicted Headcount</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: 'rgba(249,115,22,0.15)', border: '1px dashed var(--tier-high)', display: 'inline-block' }} />
              <span>High Risk Band</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} />
            <span>Updates dynamically as municipal permits refresh</span>
          </div>
        </div>

        {/* Small Print Mandated by Brief */}
        <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <HelpCircle size={12} style={{ flexShrink: 0 }} />
          <span>Forecasts come from a category-based model trained on synthetic data; illustrative events are marked.</span>
        </div>
      </div>
    </div>
  );
};

