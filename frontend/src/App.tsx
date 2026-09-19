import { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Server,
  Cloud,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  RefreshCw,
  GitBranch,
  Box,
  Cpu
} from 'lucide-react';
import {
  checkBackendHealth,
  submitDemoMessage,
  type HealthStatus,
  type DemoItem
} from './services/api';
import './App.css';

export function App() {
  const [health, setHealth] = useState<HealthStatus>({ status: 'checking', latencyMs: 0 });
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);

  // Demo Playground state
  const [inputMessage, setInputMessage] = useState('Build fast, test continuously, ship to production!');
  const [selectedTag, setSelectedTag] = useState('hackathon');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active deploy tab
  const [activeTab, setActiveTab] = useState<'render' | 'vercel' | 'docker' | 'cicd'>('render');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsRefreshingHealth(true);
    try {
      const res = await checkBackendHealth();
      setHealth(res);
    } catch {
      setHealth({ status: 'unreachable', latencyMs: 0 });
    } finally {
      setIsRefreshingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await submitDemoMessage(inputMessage, selectedTag);
      setDemoResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach backend';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHealthy = health.status === 'healthy';

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={22} />
          </div>
          <div>
            <h1 className="brand-title">PokeCode</h1>
          </div>
          <span className="badge badge-accent">Prayas Hackathon</span>
        </div>

        <div className="nav-actions">
          {/* Live Health Status Pill */}
          <div
            className="status-pill"
            title={isHealthy ? `Backend connected (${health.latencyMs}ms)` : 'Backend currently unreachable'}
          >
            <span className={`status-dot ${isHealthy ? 'healthy pulse-emerald' : 'unreachable'}`} />
            <span>
              {health.status === 'checking'
                ? 'Connecting...'
                : isHealthy
                ? `Backend: ${health.latencyMs ?? 15}ms`
                : 'Backend Offline'}
            </span>
            <button
              onClick={fetchHealth}
              disabled={isRefreshingHealth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}
              title="Refresh connection"
            >
              <RefreshCw size={13} className={isRefreshingHealth ? 'spin' : ''} />
            </button>
          </div>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            <ExternalLink size={14} /> Swagger Docs
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-pill">
          <Zap size={14} /> Hackathon Full-Stack & DevOps Starter
        </div>
        <h2 className="hero-title">
          Ship Fast. Test Early. <br />
          <span className="hero-gradient-text">Deploy Anywhere in Seconds.</span>
        </h2>
        <p className="hero-subtitle">
          Engineered for <strong>PokeCode-Prayas</strong>. Includes production-ready Python FastAPI backend,
          React 19 Vite frontend, GitHub Actions CI/CD, Docker Compose, and zero-dollar deployment configs
          for Vercel, Render, and Railway.
        </p>

        <div className="hero-actions">
          <button
            onClick={() => {
              const el = document.getElementById('playground-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn btn-primary"
          >
            <Send size={16} /> Test Live API
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('deployment-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn btn-secondary"
          >
            <Cloud size={16} /> Cloud Deploy Guides
          </button>
        </div>
      </section>

      {/* Quick Status KPI Row */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#10b981' }}>
            <Activity size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Backend Status</span>
            <span className="stat-value">{isHealthy ? 'Online & Healthy' : 'Standby / Local'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#6366f1' }}>
            <GitBranch size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">CI/CD Automation</span>
            <span className="stat-value">GitHub Actions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#06b6d4' }}>
            <Box size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Containers</span>
            <span className="stat-value">Docker Compose</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#f59e0b' }}>
            <Cloud size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Cloud Ready</span>
            <span className="stat-value">Render & Vercel</span>
          </div>
        </div>
      </div>

      {/* Split Interactive Workspace */}
      <div className="split-grid">
        {/* Left Column: Interactive API Playground */}
        <section id="playground-section" className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title">
              <Server size={20} style={{ color: 'var(--accent-secondary)' }} />
              <span>Full-Stack Live Playground</span>
            </div>
            <span className={`badge ${isHealthy ? 'badge-success' : 'badge-error'}`}>
              {isHealthy ? 'API Active' : 'Connecting'}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Test round-trip communication from this React frontend to the FastAPI backend (
            <code>POST /api/v1/demo/process</code>).
          </p>

          <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="message-input" className="form-label">
                Test Message:
              </label>
              <textarea
                id="message-input"
                className="form-textarea"
                rows={3}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a test message to process on the backend..."
              />
            </div>

            <div className="form-group">
              <span className="form-label">Select Feature Tag:</span>
              <div className="tags-row">
                {['hackathon', 'ai-feature', 'database', 'auth-service', 'analytics'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-btn ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => setSelectedTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="send-demo-btn"
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '4px' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="spin" /> Processing Request...
                </>
              ) : (
                <>
                  <Send size={16} /> Send to Backend
                </>
              )}
            </button>
          </form>

          {/* Feedback & Result */}
          {errorMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {demoResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> Backend Response (201 Created)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {demoResult.id}</span>
              </div>
              <div className="response-box">
                <pre className="code-snippet">{JSON.stringify(demoResult, null, 2)}</pre>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Deployment & DevOps Command Center */}
        <section id="deployment-section" className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title">
              <Terminal size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>Deploy & Host Command Center</span>
            </div>
            <span className="badge badge-info">Zero-Cost Ready</span>
          </div>

          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'render' ? 'active' : ''}`}
              onClick={() => setActiveTab('render')}
            >
              Render (1-Click)
            </button>
            <button
              className={`tab-btn ${activeTab === 'vercel' ? 'active' : ''}`}
              onClick={() => setActiveTab('vercel')}
            >
              Vercel (Frontend)
            </button>
            <button
              className={`tab-btn ${activeTab === 'docker' ? 'active' : ''}`}
              onClick={() => setActiveTab('docker')}
            >
              Docker Compose
            </button>
            <button
              className={`tab-btn ${activeTab === 'cicd' ? 'active' : ''}`}
              onClick={() => setActiveTab('cicd')}
            >
              CI/CD Pipeline
            </button>
          </div>

          {/* Render Tab */}
          {activeTab === 'render' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Deploy both backend and frontend automatically using the included <code>render.yaml</code> blueprint.
              </p>
              <div className="command-row">
                <code># Step 1: Connect your GitHub repo to Render Blueprints</code>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy('https://dashboard.render.com/blueprints/new', 'render-link')}
                >
                  {copiedKey === 'render-link' ? <Check size={14} /> : <Copy size={14} />} Copy Link
                </button>
              </div>
              <div className="command-row">
                <code>render.yaml detects backend service + static frontend</code>
                <span className="badge badge-accent">Auto-Config</span>
              </div>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', paddingLeft: '20px', lineHeight: '1.7' }}>
                <li>Backend free web service with auto-healthcheck at <code>/health</code></li>
                <li>Frontend static site bundle with automatic SPA routing rewrites</li>
                <li>Instant SSL certificates and custom domains support</li>
              </ul>
            </div>
          )}

          {/* Vercel Tab */}
          {activeTab === 'vercel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Host the React frontend on Vercel with zero latency and edge CDN caching.
              </p>
              <div className="command-row">
                <code>cd frontend && vercel deploy --prod</code>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy('cd frontend && vercel deploy --prod', 'vercel-cmd')}
                >
                  {copiedKey === 'vercel-cmd' ? <Check size={14} /> : <Copy size={14} />} Copy
                </button>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <strong>Environment Variable:</strong> Set <code>VITE_API_BASE_URL</code> to your deployed backend URL (e.g., <code>https://pokecode-api.onrender.com/api</code>).
              </div>
            </div>
          )}

          {/* Docker Tab */}
          {activeTab === 'docker' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Run the entire full stack locally or on any cloud VM using Docker Compose.
              </p>
              <div className="command-row">
                <code>docker compose up --build -d</code>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy('docker compose up --build -d', 'docker-cmd')}
                >
                  {copiedKey === 'docker-cmd' ? <Check size={14} /> : <Copy size={14} />} Copy
                </button>
              </div>
              <div className="command-row">
                <code>docker compose ps && docker compose logs -f</code>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy('docker compose ps', 'docker-ps')}
                >
                  {copiedKey === 'docker-ps' ? <Check size={14} /> : <Copy size={14} />} Copy
                </button>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Frontend mapped to <code>http://localhost:3000</code>, Backend mapped to <code>http://localhost:8000</code>.
              </span>
            </div>
          )}

          {/* CI/CD Tab */}
          {activeTab === 'cicd' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Every commit to <code>main</code> or PR automatically triggers GitHub Actions to run tests and verify builds.
              </p>
              <div className="command-row">
                <code>git add . && git commit -m "feat: your change" && git push</code>
                <button
                  className="copy-btn"
                  onClick={() => handleCopy('git push origin main', 'git-push')}
                >
                  {copiedKey === 'git-push' ? <Check size={14} /> : <Copy size={14} />} Copy
                </button>
              </div>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', paddingLeft: '20px', lineHeight: '1.7' }}>
                <li><strong>Backend Job:</strong> Runs <code>pytest</code> and validates schema types</li>
                <li><strong>Frontend Job:</strong> Runs TypeScript check and <code>vite build</code></li>
                <li><strong>Docker Check:</strong> Verifies containers build with zero errors</li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Architecture Highlights Matrix */}
      <section>
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Project Architecture & Stack</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Built for maximum speed, maintainability, and zero deployment friction.
          </p>
        </div>

        <div className="matrix-grid">
          <div className="matrix-card">
            <div className="matrix-header">
              <span className="matrix-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="var(--accent-secondary)" /> React 19 + TypeScript
              </span>
              <span className="badge badge-accent">Frontend</span>
            </div>
            <p className="matrix-desc">
              Instant Vite HMR, typed API client, live latency health tracker, and clean vanilla CSS tokens.
            </p>
            <span className="matrix-file">frontend/src/</span>
          </div>

          <div className="matrix-card">
            <div className="matrix-header">
              <span className="matrix-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--accent-primary)" /> Python FastAPI
              </span>
              <span className="badge badge-info">Backend</span>
            </div>
            <p className="matrix-desc">
              High-concurrency async endpoints, automatic Swagger UI documentation at <code>/docs</code>, and Pydantic v2 schemas.
            </p>
            <span className="matrix-file">backend/app/</span>
          </div>

          <div className="matrix-card">
            <div className="matrix-header">
              <span className="matrix-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Box size={18} color="var(--accent-emerald)" /> Multi-Stage Docker
              </span>
              <span className="badge badge-success">Containers</span>
            </div>
            <p className="matrix-desc">
              Optimized production images using Nginx Alpine and Python Slim with non-root security.
            </p>
            <span className="matrix-file">docker-compose.yml</span>
          </div>

          <div className="matrix-card">
            <div className="matrix-header">
              <span className="matrix-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} color="var(--accent-amber)" /> Multi-Cloud Blueprints
              </span>
              <span className="badge badge-accent">Deploy</span>
            </div>
            <p className="matrix-desc">
              One-click config files for Render Blueprint, Vercel SPA routing, Netlify redirects, and Railway.
            </p>
            <span className="matrix-file">render.yaml / vercel.json</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div>
          <strong>PokeCode-Prayas</strong> • Hackathon Pipeline & Production-Ready Starter
        </div>
        <div>
          Designed for rapid prototyping, robust pair programming, and instant deployment.
        </div>
      </footer>
    </div>
  );
}

export default App;
