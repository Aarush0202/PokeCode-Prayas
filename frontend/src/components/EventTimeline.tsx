import React, { useState, useEffect } from 'react';
import type { EventItem } from '../types/crowdguard';
import { getEvents } from '../services/api';
import { Calendar, Users, MapPin, Tag } from 'lucide-react';

interface EventTimelineProps {
  zoneMap: Record<string, string>;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ zoneMap }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    getEvents(48)
      .then((res) => {
        if (isMounted) {
          setEvents(res.events);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load events:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatEventTime = (isoTime: string) => {
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDayGroup = (isoTime: string) => {
    const d = new Date(isoTime);
    const today = new Date();
    if (d.getDate() === today.getDate()) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (d.getDate() === tomorrow.getDate()) return 'Tomorrow';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group events by Day
  const groupedEvents = events.reduce((acc, evt) => {
    const group = getDayGroup(evt.start_time);
    if (!acc[group]) acc[group] = [];
    acc[group].push(evt);
    return acc;
  }, {} as Record<string, EventItem[]>);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        padding: '20px 24px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="var(--text-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Scheduled City Events & Footfall Drivers (Next 48h)
          </h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Municipal event filings, sports schedules, and mass-transit peaks ingested into the predictive risk model.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Ingesting scheduled events...
        </div>
      ) : Object.keys(groupedEvents).length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No scheduled mass gatherings recorded in the 48-hour municipal calendar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(groupedEvents).map(([dayLabel, dayEvents]) => (
            <div key={dayLabel}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '6px',
                  marginBottom: '10px',
                }}
              >
                {dayLabel}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {evt.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Tag size={10} />
                          {evt.category}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} />
                          <span>{evt.venue}</span>
                        </div>
                        {evt.zone_id && (
                          <div>
                            Impacted Zone: <strong style={{ color: 'var(--text-secondary)' }}>{zoneMap[evt.zone_id] ?? evt.zone_id}</strong>
                          </div>
                        )}
                        <div>Source: {evt.source}</div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }} className="num-tabular">
                        {formatEventTime(evt.start_time)}
                        {evt.end_time ? ` – ${formatEventTime(evt.end_time)}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <Users size={12} />
                        <span className="num-tabular">{evt.expected_attendance.toLocaleString()}</span> expected
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
