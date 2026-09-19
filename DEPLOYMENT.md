# PokeCode-Prayas Deployment & Cloud Hosting Guide

This guide gives you and your team exact, copy-paste instructions to host and deploy the **PokeCode** full-stack application across popular zero-cost platforms during the hackathon.

---

## Architecture Overview

```
+--------------------------------------------------------------------------+
|                            Production Setup                              |
+--------------------------------------------------------------------------+
|  Frontend (React + Vite)        |  Backend (Python FastAPI)              |
|  - Hosted on Vercel / Render     |  - Hosted on Render / Railway / Docker |
|  - Port 80 (Docker) / Edge CDN  |  - Port 8000                           |
|  - Environment: VITE_API_BASE_URL| - Auto Swagger Docs at /docs           |
+--------------------------------------------------------------------------+
```

---

## Option 1: One-Click Deploy on Render (Recommended)

Render can host **both** the FastAPI backend (Web Service) and React frontend (Static Site) completely free using the included `render.yaml` blueprint.

### Steps:
1. Push your repository to GitHub.
2. Open the [Render Blueprints Dashboard](https://dashboard.render.com/blueprints).
3. Click **New Blueprint Instance** and select your repository: `Aarush0202/PokeCode-Prayas`.
4. Render will automatically read `render.yaml` and discover two services:
   - `pokecode-backend` (FastAPI Python web service)
   - `pokecode-frontend` (React static site)
5. Click **Apply**. Render will build and deploy both services automatically!
6. Once deployed, note down your backend URL (e.g. `https://pokecode-backend.onrender.com`).
   - Your API Swagger documentation will be live at `https://pokecode-backend.onrender.com/docs`.
   - Your Health check will be active at `https://pokecode-backend.onrender.com/health`.

---

## Option 2: Vercel (Frontend) + Render / Railway (Backend)

For ultra-low latency frontend delivery, host the frontend on Vercel and backend on Render or Railway.

### Frontend on Vercel:
1. Install Vercel CLI (or use the web dashboard at [vercel.com](https://vercel.com)):
   ```bash
   cd frontend
   npx vercel
   ```
2. Set the environment variable in Vercel Project Settings:
   - `VITE_API_BASE_URL` = `https://your-backend-app.onrender.com/api`
3. Redeploy with `npx vercel --prod`.

### Backend on Railway:
1. Open [railway.app](https://railway.app) and click **New Project** -> **Deploy from GitHub repo**.
2. Select `Aarush0202/PokeCode-Prayas`.
3. Set the Root Directory to `/backend` (or let Railway use `railway.json` in repo root).
4. Add environment variables:
   - `PORT` = `8000`
   - `ENVIRONMENT` = `production`
   - `CORS_ORIGINS` = `*`
5. Railway will automatically build using the included `backend/Dockerfile` or `Procfile` and give you a public URL.

---

## Option 3: Docker Compose (Local or VPS / Cloud VM)

If deploying to a Linux VPS (DigitalOcean Droplet, AWS EC2, Linode, Google Compute Engine) or presenting locally during judging:

### Commands:
```bash
# Build and run containers in the background
docker compose up --build -d

# Verify container status
docker compose ps

# Inspect logs
docker compose logs -f

# Stop containers
docker compose down
```

### URLs:
- **Frontend App**: `http://localhost:3000` (or `http://<your-vps-ip>:3000`)
- **Backend API**: `http://localhost:8000` (or `http://<your-vps-ip>:8000`)
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## Automated CI/CD Pipelines (GitHub Actions)

This repository includes pre-configured GitHub Actions workflows in `.github/workflows/`:

1. **`ci.yml`**:
   - Runs automatically on every push & pull request to `main`.
   - Tests backend with `pytest`.
   - Typechecks and builds frontend bundle with `pnpm build`.
   - Validates that Dockerfiles build without errors.

2. **`deploy.yml`**:
   - Triggers automated redeployments on Render / Vercel whenever changes merge into `main`.
   - To enable automated redeployment:
     - In Render: Go to your service Settings -> Copy the **Deploy Hook URL**.
     - In GitHub: Go to Repository **Settings** -> **Secrets and variables** -> **Actions**.
     - Add a secret named `RENDER_DEPLOY_HOOK` with your URL.

3. **`docker-publish.yml`**:
   - Builds and publishes container images to GitHub Container Registry (`ghcr.io`).

---

## Environment Variables Reference

### Backend (`backend/.env`):
| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `PokeCode API` | API display name in Swagger |
| `PORT` | `8000` | Port for the Uvicorn server |
| `ENVIRONMENT` | `development` | Environment mode (`development` / `production`) |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated or `*`) |

### Frontend (`frontend/.env`):
| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api` | Base URL for backend API calls |
