import React, { useState, useEffect } from 'react';
import type { ZoneRisk } from '../types/crowdguard';
import { Camera, X, Layers, Play } from 'lucide-react';

interface CameraFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone: ZoneRisk | null;
}

export const CameraFeedModal: React.FC<CameraFeedModalProps> = ({
  isOpen,
  onClose,
  zone,
}) => {
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);
  const [vectorsEnabled, setVectorsEnabled] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(24.8);
  const [liveTimestamp, setLiveTimestamp] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const now = new Date();
      setLiveTimestamp(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2 } as Intl.DateTimeFormatOptions));
      setFps(Number((24.2 + Math.random() * 1.4).toFixed(1)));
    }, 400);

    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !zone) return null;

  const isHighRisk = zone.risk_tier === 'HIGH' || zone.risk_tier === 'CRITICAL';
  const personCount = zone.vision?.person_count ?? zone.fused_estimate;
  const density = zone.vision?.density_per_sqm ?? Number((personCount / zone.capacity).toFixed(2));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: `1.5px solid ${isHighRisk ? 'var(--tier-high)' : 'var(--border-active)'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--tier-critical)',
                boxShadow: '0 0 8px var(--tier-critical)',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} color="var(--text-primary)" />
              <h3 id="camera-modal-title" style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
                OPTICAL SENSOR STREAM — {zone.zone_name.toUpperCase()} [CAM-03-AXIS]
              </h3>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              1080p • {fps} FPS
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Optical Stream Viewport */}
        <div
          style={{
            position: 'relative',
            height: '420px',
            backgroundColor: '#0a0f1d',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {/* Surveillance HUD Overlay Grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />

          {/* Heatmap Overlay Simulation */}
          {heatmapEnabled && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isHighRisk
                  ? 'radial-gradient(circle at 45% 55%, rgba(239, 68, 68, 0.45) 0%, rgba(245, 158, 11, 0.25) 35%, transparent 70%), radial-gradient(circle at 65% 40%, rgba(239, 68, 68, 0.35) 0%, transparent 60%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.25) 0%, transparent 65%)',
                pointerEvents: 'none',
                transition: 'opacity 0.4s ease',
              }}
            />
          )}

          {/* Optical Bounding Boxes Overlay */}
          <svg
            viewBox="0 0 800 400"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* Crosshair corners */}
            <path d="M 30 50 L 30 30 L 50 30" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            <path d="M 770 50 L 770 30 L 750 30" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            <path d="M 30 350 L 30 370 L 50 370" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            <path d="M 770 350 L 770 370 L 750 370" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />

            {/* Target Person Bounding Boxes */}
            <g transform="translate(180, 140)">
              <rect width="60" height="130" fill="none" stroke="#22c55e" strokeWidth="1.5" />
              <rect x="0" y="-18" width="85" height="18" fill="rgba(34, 197, 94, 0.85)" />
              <text x="4" y="-5" fill="#ffffff" fontSize="10" fontWeight="bold">PERSON 96%</text>
            </g>

            <g transform="translate(280, 160)">
              <rect width="55" height="120" fill="none" stroke="#22c55e" strokeWidth="1.5" />
              <rect x="0" y="-18" width="85" height="18" fill="rgba(34, 197, 94, 0.85)" />
              <text x="4" y="-5" fill="#ffffff" fontSize="10" fontWeight="bold">PERSON 92%</text>
            </g>

            <g transform="translate(370, 130)">
              <rect width="65" height="145" fill="none" stroke={isHighRisk ? '#ef4444' : '#22c55e'} strokeWidth="2" />
              <rect x="0" y="-18" width="95" height="18" fill={isHighRisk ? '#ef4444' : 'rgba(34, 197, 94, 0.85)'} />
              <text x="4" y="-5" fill="#ffffff" fontSize="10" fontWeight="bold">{isHighRisk ? 'BOTTLENECK' : 'PERSON 98%'}</text>
            </g>

            <g transform="translate(470, 150)">
              <rect width="58" height="125" fill="none" stroke={isHighRisk ? '#f59e0b' : '#22c55e'} strokeWidth="1.5" />
              <rect x="0" y="-18" width="85" height="18" fill={isHighRisk ? '#f59e0b' : 'rgba(34, 197, 94, 0.85)'} />
              <text x="4" y="-5" fill="#ffffff" fontSize="10" fontWeight="bold">PERSON 89%</text>
            </g>

            <g transform="translate(560, 170)">
              <rect width="52" height="110" fill="none" stroke="#22c55e" strokeWidth="1.5" />
              <rect x="0" y="-18" width="85" height="18" fill="rgba(34, 197, 94, 0.85)" />
              <text x="4" y="-5" fill="#ffffff" fontSize="10" fontWeight="bold">PERSON 94%</text>
            </g>

            {/* Optical Flow Vectors */}
            {vectorsEnabled && (
              <g stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3">
                <line x1="210" y1="200" x2="240" y2="170" markerEnd="url(#arrow)" />
                <line x1="310" y1="210" x2="340" y2="180" />
                <line x1="400" y1="190" x2="440" y2="160" />
                <line x1="500" y1="200" x2="530" y2="170" />
              </g>
            )}

            {/* Choke Point Density Marker */}
            {isHighRisk && (
              <g transform="translate(400, 100)">
                <circle cx="0" cy="0" r="16" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
                <text x="-6" y="5" fontSize="14">⚠️</text>
                <text x="24" y="4" fill="#ef4444" fontSize="12" fontWeight="bold">HIGH DENSITY SQUEEZE</text>
              </g>
            )}
          </svg>

          {/* Top-left Telemetry Stamp */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              color: '#38bdf8',
              lineHeight: 1.4,
              backgroundColor: 'rgba(10, 15, 29, 0.8)',
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <div>LOC: {zone.zone_name.toUpperCase()} (SECTOR 17)</div>
            <div>TIME: {liveTimestamp || '15:04:12.84'} IST</div>
            <div>MODEL: PyTorch YOLOv8x TensorRT [ONNX-INT8]</div>
          </div>

          {/* Bottom-right Optical Flow Vector Info */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              color: '#94a3b8',
              backgroundColor: 'rgba(10, 15, 29, 0.8)',
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              textAlign: 'right',
            }}
          >
            <div>FLOW: Heading 34° (North Egress)</div>
            <div>MEAN VELOCITY: 1.18 m/s</div>
            <div>CONFIDENCE: 96.4%</div>
          </div>
        </div>

        {/* Modal Controls and Metrics Bar */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Key Metrics */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Visual Headcount
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }} className="num-tabular">
                {personCount} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {zone.capacity}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Area Density
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isHighRisk ? 'var(--tier-high)' : 'var(--text-primary)' }} className="num-tabular">
                {density} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>persons / m²</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Inference Latency
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--tier-normal)' }} className="num-tabular">
                18.4 <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms (CUDA)</span>
              </div>
            </div>
          </div>

          {/* Toggle Switches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setHeatmapEnabled((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: heatmapEnabled ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
                border: `1px solid ${heatmapEnabled ? 'var(--tier-high)' : 'var(--border-subtle)'}`,
                color: heatmapEnabled ? 'var(--tier-high)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <Layers size={14} />
              <span>{heatmapEnabled ? 'Density Heatmap: ON' : 'Density Heatmap: OFF'}</span>
            </button>

            <button
              onClick={() => setVectorsEnabled((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: vectorsEnabled ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-surface)',
                border: `1px solid ${vectorsEnabled ? '#38bdf8' : 'var(--border-subtle)'}`,
                color: vectorsEnabled ? '#38bdf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <Play size={14} />
              <span>{vectorsEnabled ? 'Flow Vectors: ON' : 'Flow Vectors: OFF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
