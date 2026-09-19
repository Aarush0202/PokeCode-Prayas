# PokeCode-Prayas ⚡

[![CI Pipeline](https://github.com/Aarush0202/PokeCode-Prayas/actions/workflows/ci.yml/badge.svg)](https://github.com/Aarush0202/PokeCode-Prayas/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.0+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0+-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production-grade Full-Stack Hackathon Starter & DevOps Pipeline** created for **PokeCode-Prayas**. Pre-configured with automated CI/CD testing, containerization, live API monitoring, and 1-click cloud deployments for Render, Vercel, and Railway.

---

## Architecture

```
                               +-------------------------------------+
                               |         GitHub Repository           |
                               |    (GitHub Actions CI/CD)           |
                               +------------------+------------------+
                                                  |
                    +-----------------------------+-----------------------------+
                    |                                                           |
                    v                                                           v
       [ Frontend Service: React 19 ]                             [ Backend Service: FastAPI ]
       - Lightning Fast Vite + TypeScript                         - High Performance Async API
       - Live Backend Latency & Health Indicator                  - Auto Swagger UI (/docs)
       - Deploy: Vercel / Netlify / Render                        - Deploy: Render / Railway / Docker
                    |                                                           |
                    +---------------------> [ Docker Compose ] <----------------+
                                           - Nginx Alpine Frontend
                                           - Python Slim Backend
                                           - Optional PostgreSQL
```

---

## Quickstart (60 Seconds)

### Prerequisites
- Node.js 20+ & pnpm (or npm)
- Python 3.11+
- Docker & Docker Compose (optional for containerized run)

### 1. Clone & Install
```bash
git clone https://github.com/Aarush0202/PokeCode-Prayas.git
cd PokeCode-Prayas

# Install root & frontend dependencies
pnpm install
cd frontend && pnpm install && cd ..

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Run Local Development
You can run both services concurrently with a single command:
```bash
# Option A: Using make
make dev

# Option B: Using pnpm / npm
pnpm dev
```

Your services will be running at:
- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

---

## One-Command Container Execution (Docker)

To run everything in production-like isolated containers:
```bash
docker compose up --build -d
```
Stop containers:
```bash
docker compose down
```

---

## Automated CI/CD Pipelines

GitHub Actions workflows are automatically configured under `.github/workflows/`:
- **`ci.yml`**: Runs on every pull request and push to `main`:
  - Backend unit & integration tests (`pytest`)
  - Frontend typecheck and production bundling (`tsc` + `vite build`)
  - Multi-stage Docker image build verification
- **`deploy.yml`**: Webhook dispatcher for Render & Vercel automated deployments.
- **`docker-publish.yml`**: Container image publisher to GitHub Container Registry (`ghcr.io`).

---

## Deployment Cheatsheet

| Platform | Target | Config File | Free Tier |
| :--- | :--- | :--- | :--- |
| **Render** | Backend + Frontend | [`render.yaml`](file:///home/daredevil/Music/PokeCode-Prayas/render.yaml) | Free |
| **Vercel** | Frontend | [`frontend/vercel.json`](file:///home/daredevil/Music/PokeCode-Prayas/frontend/vercel.json) | Free |
| **Netlify** | Frontend | [`frontend/netlify.toml`](file:///home/daredevil/Music/PokeCode-Prayas/frontend/netlify.toml) | Free |
| **Railway** | Backend | [`railway.json`](file:///home/daredevil/Music/PokeCode-Prayas/railway.json) | Free trial |
| **Docker / VPS** | Full Stack | [`docker-compose.yml`](file:///home/daredevil/Music/PokeCode-Prayas/docker-compose.yml) | Self-hosted |

See [DEPLOYMENT.md](file:///home/daredevil/Music/PokeCode-Prayas/DEPLOYMENT.md) for full step-by-step deployment instructions.

---

## Project Structure

```
PokeCode-Prayas/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated CI tests & builds
│       ├── deploy.yml             # Webhook automated CD trigger
│       └── docker-publish.yml     # GHCR Docker image publisher
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/      # Route handlers (health, demo, etc.)
│   │   ├── core/config.py         # Pydantic environment configuration
│   │   └── main.py                # FastAPI app entrypoint & CORS
│   ├── tests/                     # Pytest suite
│   ├── Dockerfile                 # Multi-stage Python Slim container
│   ├── Procfile                   # Railway / Heroku process definition
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── services/api.ts        # Typed API service & health checker
│   │   ├── App.tsx                # Interactive UI & DevOps dashboard
│   │   ├── App.css                # Component styling & responsiveness
│   │   └── index.css              # Design system tokens & dark theme
│   ├── Dockerfile                 # Multi-stage Nginx Alpine container
│   ├── nginx.conf                 # Production Nginx reverse proxy & SPA router
│   ├── vercel.json                # Vercel configuration
│   └── netlify.toml               # Netlify configuration
├── docker-compose.yml             # Multi-service local & cloud orchestration
├── render.yaml                    # Render 1-click infrastructure blueprint
├── railway.json                   # Railway deployment config
├── Makefile                       # Developer shortcuts (make dev, make test)
├── package.json                   # Root workspace scripts
└── DEPLOYMENT.md                  # Comprehensive cloud hosting guide
```
