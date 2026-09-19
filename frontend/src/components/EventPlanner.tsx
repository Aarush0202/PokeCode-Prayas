import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Calendar,
  Clock,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Info,
  Layers,
  Crown,
  CornerDownRight,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import type {
  PlannerAssessRequest,
  PlannerAssessResponse,
  PlannerParseResponse,
  PlannerEventType,
  PlannerDrawLevel,
} from '../types/crowdguard';
import { assessEvent, parseEventText } from '../services/api';
import { PlacePicker } from './PlacePicker';

interface EventPlannerProps {
  initialZoneId?: string;
  onSelectZone?: (id: string) => void;
}

const getNextSaturday1800 = (): string => {
  const now = new Date();
  const result = new Date(now);
  const day = now.getDay();
  let daysUntilSaturday = (6 - day + 7) % 7;
  if (daysUntilSaturday === 0 && now.getHours() >= 18) {
    daysUntilSaturday = 7;
  }
  result.setDate(now.getDate() + daysUntilSaturday);
  result.setHours(18, 0, 0, 0);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const YYYY = result.getFullYear();
  const MM = pad(result.getMonth() + 1);
  const DD = pad(result.getDate());
  const HH = pad(result.getHours());
  const mm = pad(result.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
};

export const EventPlanner: React.FC<EventPlannerProps> = ({
  initialZoneId = 'ch01',
}) => {
  // Form state
  const [zoneId, setZoneId] = useState<string>(initialZoneId);
  const [startTime, setStartTime] = useState<string>(getNextSaturday1800);
  const [durationHours, setDurationHours] = useState<number>(3);
  const [eventType, setEventType] = useState<PlannerEventType>('concert');
  const [expectedAttendance, setExpectedAttendance] = useState<number>(500);
  const [drawLevel, setDrawLevel] = useState<PlannerDrawLevel>('normal');

  // Parser helper state
  const [nlText, setNlText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<PlannerParseResponse | null>(null);

  // Assessment result state
  const [isAssessing, setIsAssessing] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<PlannerAssessResponse | null>(null);
  const [hasAssessedOnce, setHasAssessedOnce] = useState<boolean>(false);

  // Auto-run initial assessment so judges see a complete verdict immediately
  useEffect(() => {
    handleAssess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleParse = async () => {
    if (!nlText.trim()) return;
    setIsParsing(true);
    try {
      const res = await parseEventText(nlText);
      setParseResult(res);

      // Apply parsed fields
      if (res.fields) {
        if (res.fields.zone_id) setZoneId(res.fields.zone_id);
        if (res.fields.start_time) setStartTime(res.fields.start_time);
        if (res.fields.duration_hours) setDurationHours(res.fields.duration_hours);
        if (res.fields.event_type) setEventType(res.fields.event_type as PlannerEventType);
        if (res.fields.expected_attendance) setExpectedAttendance(res.fields.expected_attendance);
        if (res.fields.draw_level) setDrawLevel(res.fields.draw_level as PlannerDrawLevel);
      }
    } catch (err) {
      console.error('[EventPlanner] Parse error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAssess = async (overrideParams?: Partial<PlannerAssessRequest>) => {
    setIsAssessing(true);
    const req: PlannerAssessRequest = {
      zone_id: overrideParams?.zone_id ?? zoneId,
      start_time: overrideParams?.start_time ?? (startTime.length === 16 ? `${startTime}:00Z` : startTime),
      duration_hours: overrideParams?.duration_hours ?? durationHours,
      event_type: overrideParams?.event_type ?? eventType,
      expected_attendance: overrideParams?.expected_attendance ?? expectedAttendance,
      draw_level: overrideParams?.draw_level ?? drawLevel,
    };

    try {
      const res = await assessEvent(req);
      setAssessment(res);
      setHasAssessedOnce(true);
    } catch (err) {
      console.error('[EventPlanner] Assessment error:', err);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleApplyAlternative = (altZoneId: string) => {
    setZoneId(altZoneId);
    handleAssess({ zone_id: altZoneId });
  };

  const getVerdictTheme = (v?: string) => {
    switch (v) {
      case 'feasible':
        return {
          color: 'var(--tier-normal)',
          bgColor: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'var(--tier-normal)',
          label: 'FEASIBLE',
          icon: <CheckCircle2 size={18} color="var(--tier-normal)" />,
        };
      case 'feasible_with_mitigations':
        return {
          color: 'var(--tier-elevated)',
          bgColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'var(--tier-elevated)',
          label: 'FEASIBLE WITH MITIGATIONS',
          icon: <AlertTriangle size={18} color="var(--tier-elevated)" />,
        };
      case 'not_recommended':
      default:
        return {
          color: 'var(--tier-critical)',
          bgColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'var(--tier-critical)',
          label: 'NOT RECOMMENDED AT THIS TIME / LOCATION',
          icon: <XCircle size={18} color="var(--tier-critical)" />,
        };
    }
  };

  const verdictTheme = getVerdictTheme(assessment?.verdict);
  const safeCapacity = assessment?.zone ? Math.round(assessment.zone.capacity * 0.7) : 700;
  const crushCapacity = assessment?.zone ? assessment.zone.capacity : 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="var(--tier-normal)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Municipal Event Risk Planner
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Decision Support • Beta
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
            Simulate prospective public gatherings against diurnal baseline footfall and physical choke capacities before issuing municipal permits.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <Shield size={14} color="var(--tier-normal)" />
          <span>Synthetic baseline model • 18 verified venues</span>
        </div>
      </div>

      {/* Natural Language Event Description Assistant */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} color="var(--tier-elevated)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Quick Assist: Describe Event in Plain English
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="e.g. Punjabi singer concert at Sukhna Lake next Saturday 7 PM, expecting 8000 people, national VIP guest"
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleParse();
              }
            }}
            style={{
              flex: 1,
              minWidth: '280px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || !nlText.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isParsing || !nlText.trim() ? 'not-allowed' : 'pointer',
              opacity: isParsing || !nlText.trim() ? 0.6 : 1,
              transition: 'all var(--transition-fast)',
            }}
          >
            {isParsing ? (
              <>
                <RefreshCw size={13} className="spin-slow" />
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <CornerDownRight size={13} />
                <span>Fill form from description</span>
              </>
            )}
          </button>
        </div>

        {/* Missing fields or parser notes */}
        {parseResult && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem' }}>
            {parseResult.missing && parseResult.missing.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--tier-elevated)',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '6px',
                }}
              >
                <AlertTriangle size={13} />
                <span>
                  Could not extract: <strong>{parseResult.missing.join(', ')}</strong>. Please verify or fill these fields manually.
                </span>
              </div>
            )}
            {parseResult.note && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>
                ℹ️ {parseResult.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Form on Left (40%), Verdict Card on Right (60%) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: The Configuration Form */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Event Parameters
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Configure proposed location, schedule, and crowd expectations
            </span>
          </div>

          {/* 1. Place Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Target Venue / Zone:
            </label>
            <PlacePicker
              selectedZoneId={zoneId}
              onSelectZone={(id) => setZoneId(id)}
            />
          </div>

          {/* 2. Date & Time */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Scheduled Start Date & Time:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={15} color="var(--text-muted)" />
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>

          {/* 3. Duration */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Duration (Hours): <strong className="num-tabular" style={{ color: 'var(--text-primary)' }}>{durationHours}h</strong>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={15} color="var(--text-muted)" />
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--tier-normal)' }}
              />
              <span className="num-tabular" style={{ fontSize: '0.85rem', fontWeight: 700, width: '24px' }}>
                {durationHours}
              </span>
            </div>
          </div>

          {/* 4. Event Type Category */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Event Category:
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as PlannerEventType)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="religious_gathering">Religious Gathering / Aarti</option>
              <option value="concert">Concert / Music Festival</option>
              <option value="rally">Political Rally / Public Address</option>
              <option value="sports_match">Sports Match / Marathon</option>
              <option value="festival">Commercial Sale / Expo / Festival</option>
              <option value="other">General Community Assembly</option>
            </select>
          </div>

          {/* 5. Expected Attendance */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Expected Ticketed / Core Turnout:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} color="var(--text-muted)" />
              <input
                type="number"
                min={50}
                max={150000}
                step={50}
                value={expectedAttendance}
                onChange={(e) => setExpectedAttendance(Number(e.target.value))}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}
                className="num-tabular"
              />
            </div>
          </div>

          {/* 6. VIP / Celebrity Draw */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <Crown size={14} color="var(--tier-elevated)" />
              <span>VIP / Celebrity Factor:</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'normal', label: 'Normal: Standard crowd profile (+0% surge)' },
                { id: 'high', label: 'High: Notable local figure / popular artist (+30% surge)' },
                { id: 'very_high', label: 'Very High: National VIP / star (+60% surge)' },
              ].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.78rem',
                    color: drawLevel === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: drawLevel === item.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    border: `1px solid ${drawLevel === item.id ? 'var(--border-active)' : 'transparent'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="draw_level"
                    value={item.id}
                    checked={drawLevel === item.id}
                    onChange={() => setDrawLevel(item.id as PlannerDrawLevel)}
                    style={{ accentColor: 'var(--tier-normal)' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
              * Your estimate of how much a famous guest raises turnout. This is an assumption, not measured.
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => handleAssess()}
            disabled={isAssessing}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: 'var(--tier-normal)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 20px',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: isAssessing ? 'not-allowed' : 'pointer',
              opacity: isAssessing ? 0.7 : 1,
              marginTop: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {isAssessing ? (
              <>
                <RefreshCw size={16} className="spin-slow" />
                <span>Simulating Risk Models...</span>
              </>
            ) : (
              <>
                <span>Assess Event Feasibility</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Right Column: Feasibility Verdict Card */}
        <div>
          {!assessment && !isAssessing && !hasAssessedOnce ? (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Layers size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>No Event Assessed Yet</div>
              <div style={{ fontSize: '0.82rem', marginTop: '6px' }}>
                Fill the parameters on the left and click "Assess Event Feasibility" to simulate crowd dynamics.
              </div>
            </div>
          ) : assessment ? (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${verdictTheme.borderColor}`,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Verdict Header Pill & Summary */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: verdictTheme.bgColor,
                      color: verdictTheme.color,
                      border: `1px solid ${verdictTheme.borderColor}`,
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {verdictTheme.icon}
                    <span>{verdictTheme.label}</span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Safe Cap (70%): <strong className="num-tabular" style={{ color: 'var(--text-primary)' }}>{safeCapacity.toLocaleString()}</strong> | Physical Max: <strong className="num-tabular" style={{ color: 'var(--tier-critical)' }}>{crushCapacity.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Summary Statement */}
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: '12px',
                    lineHeight: 1.4,
                  }}
                >
                  {assessment.reasons?.[0] || 'Assessment complete for proposed venue schedule.'}
                </div>
              </div>

              {/* Scenario Sensitivity Table */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Sensitivity & Surge Scenarios
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '6px 8px' }}>Scenario</th>
                        <th style={{ padding: '6px 8px' }}>Peak Headcount</th>
                        <th style={{ padding: '6px 8px' }}>% Safe Cap</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.scenarios.map((sc, i) => {
                        const scTheme = getVerdictTheme(sc.verdict);
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {sc.label}
                            </td>
                            <td style={{ padding: '8px' }} className="num-tabular">
                              {sc.attendance.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px' }} className="num-tabular">
                              <span
                                style={{
                                  fontWeight: 700,
                                  color:
                                    sc.peak_ratio > 1.0
                                      ? 'var(--tier-critical)'
                                      : sc.peak_ratio > 0.7
                                      ? 'var(--tier-elevated)'
                                      : 'var(--tier-normal)',
                                }}
                              >
                                {Math.round(sc.peak_ratio * 100)}%
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: scTheme.color,
                                  backgroundColor: scTheme.bgColor,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  border: `1px solid ${scTheme.borderColor}`,
                                  display: 'inline-block',
                                }}
                              >
                                {sc.verdict.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Timeline Forecast Chart */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Event Horizon vs Physical Capacity Limits
                </div>
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={assessment.timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} className="num-tabular" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div
                                style={{
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '8px 12px',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                  {data.time}
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                  Baseline Footfall: <span className="num-tabular">{data.baseline}</span>
                                </div>
                                <div style={{ color: 'var(--tier-elevated)' }}>
                                  Event Addition: <span className="num-tabular">+{data.event}</span>
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                                  Combined Headcount: <span className="num-tabular">{data.total}</span> ({Math.round(data.ratio * 100)}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />

                      {/* Threshold lines */}
                      <ReferenceLine
                        y={safeCapacity}
                        stroke="var(--tier-elevated)"
                        strokeDasharray="4 4"
                        label={{ value: '70% Safe Cap', fill: 'var(--tier-elevated)', fontSize: 9, position: 'insideTopRight' }}
                      />
                      <ReferenceLine
                        y={crushCapacity}
                        stroke="var(--tier-critical)"
                        strokeDasharray="4 4"
                        label={{ value: '100% Crush Cap', fill: 'var(--tier-critical)', fontSize: 9, position: 'insideTopRight' }}
                      />

                      {/* Event footfall Area */}
                      <Area
                        type="monotone"
                        dataKey="event"
                        fill="rgba(245, 158, 11, 0.18)"
                        stroke="none"
                      />

                      {/* Baseline Footfall (dashed) */}
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        stroke="var(--text-muted)"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        dot={false}
                      />

                      {/* Combined Total (solid) */}
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke={assessment.verdict === 'not_recommended' ? 'var(--tier-critical)' : 'var(--tier-normal)'}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <span>-- Baseline Diurnal</span>
                  <span style={{ color: 'var(--tier-elevated)' }}>■ Event Addition</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>— Combined Total</span>
                </div>
              </div>

              {/* Recommended Mitigations */}
              {assessment.mitigations && assessment.mitigations.length > 0 && (
                <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} color="var(--tier-normal)" />
                    <span>Operational Mitigations & Requirements</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {assessment.mitigations.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Alternatives (Clickable to re-assess) */}
              {assessment.alternatives && assessment.alternatives.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Alternative Locations Suggested by Model
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assessment.alternatives.map((alt) => (
                      <div
                        key={alt.zone_id}
                        onClick={() => handleApplyAlternative(alt.zone_id)}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'border-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--tier-normal)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      >
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {alt.name}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Projected Peak Ratio: <strong className="num-tabular" style={{ color: 'var(--tier-normal)' }}>{Math.round(alt.peak_ratio * 100)}%</strong> • Verdict: {alt.verdict}
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '4px 10px',
                            color: 'var(--tier-normal)',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>Apply</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Assumptions */}
              {assessment.assumptions && assessment.assumptions.length > 0 && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Info size={12} />
                    <span>Model Assumptions:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {assessment.assumptions.map((assump, idx) => (
                      <li key={idx}>{assump}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mandatory Verbatim Disclaimer */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  fontStyle: 'italic',
                }}
              >
                <AlertOctagon size={14} color="var(--tier-elevated)" style={{ flexShrink: 0 }} />
                <span>Decision support only. Not a safety approval; real events need police, fire and local-authority clearance.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
