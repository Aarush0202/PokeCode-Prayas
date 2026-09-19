import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Zone } from '../types/crowdguard';
import { getZones, isDegraded } from '../services/api';
import {
  MapPin,
  Search,
  Check,
  ChevronDown,
  Radio,
  TrendingUp,
  X,
  Filter,
} from 'lucide-react';

interface PlacePickerProps {
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  className?: string;
  compact?: boolean;
}

export const PlacePicker: React.FC<PlacePickerProps> = ({
  selectedZoneId,
  onSelectZone,
  className = '',
  compact = false,
}) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [liveOnly, setLiveOnly] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [degraded, setDegraded] = useState(isDegraded());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load zones
  useEffect(() => {
    let isMounted = true;
    getZones()
      .then((data) => {
        if (isMounted) {
          setZones(data);
          setDegraded(isDegraded());
        }
      })
      .catch((err) => {
        console.warn('[PlacePicker] Failed to load zones:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const selectedZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZoneId) || zones.find((z) => z.id === 'z3') || zones[0];
  }, [zones, selectedZoneId]);

  // Categorize zones: Live sensors (z1..z4) vs Forecast only
  const isLiveSensorZone = (z: Zone) => ['z1', 'z2', 'z3', 'z4'].includes(z.id);

  // Filtered zones
  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zones.filter((z) => {
      if (liveOnly && !isLiveSensorZone(z)) return false;
      if (!q) return true;
      return (
        z.name.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q) ||
        (z.city && z.city.toLowerCase().includes(q)) ||
        (z.category && z.category.toLowerCase().includes(q))
      );
    });
  }, [zones, search, liveOnly]);

  // Group filtered zones: "Live Sensors" group, then groups by City for forecast-only
  const groupedData = useMemo(() => {
    const live: Zone[] = [];
    const forecastByCity: Record<string, Zone[]> = {};

    for (const z of filteredZones) {
      if (isLiveSensorZone(z)) {
        live.push(z);
      } else {
        const city = z.city || 'Other Locations';
        if (!forecastByCity[city]) forecastByCity[city] = [];
        forecastByCity[city].push(z);
      }
    }

    return {
      live,
      forecastByCity,
    };
  }, [filteredZones]);

  // Flatten for keyboard navigation
  const flatVisibleZones = useMemo(() => {
    const list: Zone[] = [...groupedData.live];
    for (const city of Object.keys(groupedData.forecastByCity).sort()) {
      list.push(...groupedData.forecastByCity[city]);
    }
    return list;
  }, [groupedData]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, liveOnly]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, flatVisibleZones.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + flatVisibleZones.length) % Math.max(1, flatVisibleZones.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatVisibleZones[highlightedIndex]) {
        onSelectZone(flatVisibleZones[highlightedIndex].id);
        setIsOpen(false);
      }
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return 'Venue';
    return category.replace(/_/g, ' ');
  };

  return (
    <div
      ref={containerRef}
      className={`place-picker-root ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: compact ? '4px 10px' : '6px 12px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.84rem',
          fontWeight: 600,
          transition: 'border-color var(--transition-fast)',
        }}
      >
        <MapPin size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}>
          <span>{selectedZone ? selectedZone.name : 'Select Venue...'}</span>
          {selectedZone && isLiveSensorZone(selectedZone) ? (
            <span
              style={{
                fontSize: '0.68rem',
                backgroundColor: 'var(--tier-normal-bg)',
                color: 'var(--tier-normal)',
                border: '1px solid var(--tier-normal-border)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: 700,
              }}
            >
              <Radio size={9} />
              LIVE
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.68rem',
                backgroundColor: 'rgba(100, 116, 139, 0.12)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '1px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <TrendingUp size={9} />
              FORECAST
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
            marginLeft: '4px',
          }}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '340px',
            maxHeight: '440px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header & Search Input */}
          <div
            style={{
              padding: '10px 12px 8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
              }}
            >
              <Search size={14} color="var(--text-muted)" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search venue, city, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  width: '100%',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Toggle & Demo Data indicator */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={liveOnly}
                  onChange={(e) => setLiveOnly(e.target.checked)}
                  style={{ accentColor: 'var(--tier-normal)' }}
                />
                <Filter size={11} />
                <span>Show only live-sensor zones</span>
              </label>

              {degraded && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--tier-elevated)',
                    fontWeight: 700,
                  }}
                  title="Running with mock fixture data"
                >
                  DEMO DATA
                </span>
              )}
            </div>
          </div>

          {/* Grouped Zone List */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '340px',
              padding: '6px 0',
            }}
          >
            {flatVisibleZones.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}
              >
                No venues match "{search}".
              </div>
            ) : (
              <>
                {/* 1. Live Sensors Group */}
                {groupedData.live.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 14px 4px 14px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--tier-normal)',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Radio size={11} />
                      Live Sensors (CCTV & Bluetooth)
                    </div>
                    {groupedData.live.map((z) => {
                      const isSelected = z.id === selectedZoneId;
                      const flatIndex = flatVisibleZones.findIndex((item) => item.id === z.id);
                      const isHighlighted = flatIndex === highlightedIndex;
                      return (
                        <div
                          key={z.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectZone(z.id);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setHighlightedIndex(flatIndex)}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: isSelected
                              ? 'rgba(16, 185, 129, 0.12)'
                              : isHighlighted
                              ? 'var(--bg-surface-elevated)'
                              : 'transparent',
                            cursor: 'pointer',
                            borderLeft: isSelected ? '3px solid var(--tier-normal)' : '3px solid transparent',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.86rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {z.name}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ({z.id})
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              <span>Cap: {z.capacity.toLocaleString()}</span>
                              <span>•</span>
                              <span style={{ textTransform: 'capitalize' }}>
                                {getCategoryLabel(z.category)}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check size={14} color="var(--tier-normal)" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Forecast-Only Groups by City */}
                {Object.keys(groupedData.forecastByCity).sort().map((city) => (
                  <div key={city} style={{ marginTop: '6px' }}>
                    <div
                      style={{
                        padding: '6px 14px 4px 14px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderTop: '1px solid var(--border-subtle)',
                        marginTop: '4px',
                      }}
                    >
                      <TrendingUp size={11} color="var(--text-muted)" />
                      Forecast Only — {city}
                    </div>
                    {groupedData.forecastByCity[city].map((z) => {
                      const isSelected = z.id === selectedZoneId;
                      const flatIndex = flatVisibleZones.findIndex((item) => item.id === z.id);
                      const isHighlighted = flatIndex === highlightedIndex;
                      return (
                        <div
                          key={z.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectZone(z.id);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setHighlightedIndex(flatIndex)}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: isSelected
                              ? 'rgba(100, 116, 139, 0.15)'
                              : isHighlighted
                              ? 'var(--bg-surface-elevated)'
                              : 'transparent',
                            cursor: 'pointer',
                            borderLeft: isSelected ? '3px solid var(--text-muted)' : '3px solid transparent',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.86rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {z.name}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ({z.id})
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              <span>Cap: {z.capacity.toLocaleString()}</span>
                              <span>•</span>
                              <span style={{ textTransform: 'capitalize' }}>
                                {getCategoryLabel(z.category)}
                              </span>
                              <span>•</span>
                              <span style={{ color: 'var(--text-muted)' }}>No live sensors</span>
                            </div>
                          </div>
                          {isSelected && <Check size={14} color="var(--text-secondary)" />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
