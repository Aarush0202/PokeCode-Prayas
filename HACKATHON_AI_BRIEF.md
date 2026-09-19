# PokeCode-Prayas: Hackathon Repository Blueprint & AI Prompt Context

> **How to use this file:** Copy and paste the prompt template below into Claude (or any AI assistant) along with your hackathon problem statement when released. It gives the AI complete context on the existing architecture, pre-configured pipelines, conventions, and exact file paths to modify.

---

## Copy-Paste Prompt Template for Claude

```markdown
Hello Claude! We are participating in the **Prayas Hackathon** with our project repository **PokeCode-Prayas**.

We already have a fully functioning, tested, production-grade full-stack boilerplate with CI/CD and multi-cloud deployment configurations ready.

### Our Tech Stack & Existing Architecture:
1. **Frontend (`/frontend`)**:
   - React 19 + TypeScript + Vite (Port 3000)
   - Styling: Vanilla CSS with design tokens, glassmorphism, responsive cards, dark mode (`frontend/src/index.css`, `frontend/src/App.css`)
   - Icons: `lucide-react`
   - API Client: Typed fetch client in `frontend/src/services/api.ts` (proxied in dev to `http://localhost:8000`, configurable via `VITE_API_BASE_URL`)
   - Deploy Ready: Multi-stage Dockerfile (Nginx Alpine with SPA fallback), `frontend/vercel.json` (Vercel edge static), `frontend/netlify.toml`.

2. **Backend (`/backend`)**:
   - Python FastAPI (Port 8000)
   - Package manager / dependencies: `backend/requirements.txt` (FastAPI, Uvicorn, Pydantic v2, Pydantic-Settings, Pytest, HTTPX)
   - Configuration: `backend/app/core/config.py` (CORS enabled for localhost & production, environment settings)
   - Endpoints:
     - Health checks: `GET /health` and `GET /api/v1/health`
     - Demo / Sample routes: `backend/app/api/v1/endpoints/demo.py`
     - API Router registration: `backend/app/api/v1/router.py`
     - Application Entrypoint: `backend/app/main.py` (Automatic Swagger docs at `http://localhost:8000/docs`)
   - Tests: `backend/tests/` (Pytest suite, 100% passing)
   - Deploy Ready: Production Dockerfile (Python 3.12 Slim, non-root user), `backend/Procfile`, `railway.json`.

3. **Pipelines & Orchestration**:
   - CI/CD: `.github/workflows/ci.yml` (runs Pytest, TypeScript check, Vite build, and Docker build on push/PR), `.github/workflows/deploy.yml` (deploy hooks for Render/Vercel), `.github/workflows/docker-publish.yml` (GHCR image publishing).
   - Docker: Root `docker-compose.yml` (Frontend port 3000, Backend port 8000, optional PostgreSQL service).
   - 1-Click Hosting: Root `render.yaml` (Render Blueprint for web service backend + static frontend).
   - Dev Shortcuts: Root `Makefile` (`make dev`, `make test`, `make build`, `make docker-up`) and root `package.json` (`pnpm dev`).

---

### OUR PROBLEM STATEMENT:
[INSERT YOUR HACKATHON PROBLEM STATEMENT HERE]

---

### INSTRUCTIONS FOR YOU (CLAUDE):
1. **Respect Existing Architecture**:
   - Do NOT delete the existing deployment files, CI/CD workflows, or health checks (`/health`).
   - Add new backend endpoints inside `backend/app/api/v1/endpoints/` and register them in `backend/app/api/v1/router.py`.
   - Add new data schemas / Pydantic models in `backend/app/schemas/` or within the endpoint files.
   - If AI/LLM APIs (e.g. Gemini, OpenAI, LangChain) or external services are needed, add their clients in `backend/app/services/` and their packages to `backend/requirements.txt`.
   - Add new frontend components in `frontend/src/components/` and update `frontend/src/services/api.ts` with new API methods.
   - Maintain the existing visual style tokens (dark mode, glassmorphism, responsive grid) in `frontend/src/index.css`.
2. **Implementation Steps Required**:
   - Define our solution's data models and architecture.
   - Implement the core backend routes with proper input validation and error handling.
   - Add backend tests in `backend/tests/` to verify logic.
   - Connect the frontend with clean, interactive UI components.
   - Ensure `make test` (`pytest` + `vite build`) passes without errors.
```

---

## Detailed Repository File Map

```
PokeCode-Prayas/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated CI: Pytest, TS check, Vite build, Docker validation
│       ├── deploy.yml             # Automated CD: Webhook triggers for Render & Vercel
│       └── docker-publish.yml     # GHCR: Publishes images on release/workflow_dispatch
│
├── backend/                       # Python FastAPI API Server
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── demo.py    # Example POST/GET endpoint with Pydantic v2 schemas
│   │   │       │   └── health.py  # /health & /ping endpoints for cloud health checks
│   │   │       └── router.py      # Registers all v1 endpoint routers
│   │   ├── core/
│   │   │   └── config.py          # App settings, environment variables, CORS configuration
│   │   └── main.py                # FastAPI factory, CORS middleware, top-level routes
│   ├── tests/
│   │   ├── test_demo.py           # Unit tests for sample endpoints
│   │   └── test_health.py         # Unit tests for /health & /api/v1/health
│   ├── .dockerignore              # Prevents __pycache__ & .venv from bloating Docker build
│   ├── .env.example               # Backend env variable template (PORT, CORS_ORIGINS, DB_URL)
│   ├── Dockerfile                 # Python 3.12-slim production container (non-root appuser)
│   ├── Procfile                   # Process file for Railway & Heroku
│   └── requirements.txt           # Python dependencies (fastapi, uvicorn, pydantic, pytest, httpx)
│
├── frontend/                      # React 19 + TypeScript + Vite Single Page Application
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts             # Typed API client, health polling, error handling
│   │   ├── App.css                # Layout styles, panels, tabs, response views
│   │   ├── App.tsx                # Hero banner, Live Backend Latency Pill, API Tester, Deploy Hub
│   │   ├── index.css              # Obsidian dark theme, design tokens, Google fonts, glassmorphism
│   │   └── main.tsx               # React root render
│   ├── .dockerignore              # Prevents node_modules & dist from bloating Docker build
│   ├── .env.example               # Frontend env variable template (VITE_API_BASE_URL)
│   ├── Dockerfile                 # Multi-stage container (Node 22 builder -> Nginx Alpine runner)
│   ├── index.html                 # HTML5 template with Google Fonts (Plus Jakarta Sans) & SEO meta
│   ├── netlify.toml               # Netlify SPA redirect rules
│   ├── nginx.conf                 # Nginx production configuration with gzip & SPA fallback
│   ├── package.json               # Frontend dependencies (react 19, vite 8, lucide-react)
│   ├── pnpm-lock.yaml             # Frozen dependency lockfile
│   ├── tsconfig.json              # TypeScript strict configuration
│   ├── vercel.json                # Vercel zero-config routing rules & cache headers
│   └── vite.config.ts             # Vite config with dev proxy forwarding /api to port 8000
│
├── docker-compose.yml             # Orchestrates backend + frontend (+ optional PostgreSQL)
├── render.yaml                    # Render Infrastructure-as-Code Blueprint (1-click free deploy)
├── railway.json                   # Railway deployment settings
├── Makefile                       # Developer shortcuts (make dev, make test, make docker-up)
├── package.json                   # Root scripts running frontend & backend concurrently
├── .gitignore                     # Comprehensive git ignore for Node, Python, Docker & .env
├── README.md                      # Project documentation with quickstart & badges
└── DEPLOYMENT.md                  # Step-by-step 5-minute hosting guide for all platforms
```

---

## Developer Cheatsheet (Quick Reference)

### 1. Daily Development Commands
```bash
# Start both Backend and Frontend concurrently
make dev
# or: pnpm dev

# Run only Backend (FastAPI on http://localhost:8000, Docs at /docs)
make backend

# Run only Frontend (React on http://localhost:3000)
make frontend

# Run Full Test Suite (Pytest + TypeScript + Vite build)
make test

# Launch Isolated Container Stack (Docker Compose)
make docker-up

# Stop Docker Stack
make docker-down
```

### 2. Standard Workflow for Adding New Features

#### Adding a New Backend Endpoint:
1. Create `backend/app/api/v1/endpoints/your_feature.py`:
   ```python
   from fastapi import APIRouter, HTTPException, status
   from pydantic import BaseModel

   router = APIRouter()

   class FeatureRequest(BaseModel):
       query: str

   class FeatureResponse(BaseModel):
       result: str

   @router.post("/your-feature", response_model=FeatureResponse)
   async def handle_feature(payload: FeatureRequest):
       return FeatureResponse(result=f"Processed: {payload.query}")
   ```
2. Register the router in `backend/app/api/v1/router.py`:
   ```python
   from app.api.v1.endpoints import health, demo, your_feature

   api_router.include_router(your_feature.router, prefix="", tags=["Your Feature"])
   ```
3. Add a test in `backend/tests/test_your_feature.py`.
4. Run `pytest backend/tests` to verify.

#### Calling the Endpoint from Frontend:
1. Add function to `frontend/src/services/api.ts`:
   ```typescript
   export async function callYourFeature(query: string) {
     const res = await fetch(`${API_BASE_URL}/v1/your-feature`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query }),
     });
     if (!res.ok) throw new Error('Feature call failed');
     return res.json();
   }
   ```
2. Import and use it inside your React component!

---

## 3. Instant Deployment When Judging Begins

| Destination | What To Do | Time Needed |
| :--- | :--- | :--- |
| **Render (Full Stack)** | Push to GitHub -> Go to [Render Blueprints](https://dashboard.render.com/blueprints) -> Select repo -> Click **Apply**. It automatically deploys both services using `render.yaml`. | 3 minutes |
| **Vercel (Frontend)** | Run `cd frontend && npx vercel --prod`. Set `VITE_API_BASE_URL` to your backend URL. | 1 minute |
| **Railway (Backend)** | Connect repo in [Railway](https://railway.app), set root directory to `backend`. | 2 minutes |
| **Local Demo for Judges** | Run `make docker-up` or `make dev`. Open `http://localhost:3000` for Web App and `http://localhost:8000/docs` for interactive Swagger API. | 10 seconds |
