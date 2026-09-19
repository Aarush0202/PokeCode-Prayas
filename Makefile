.PHONY: help dev backend frontend test build docker-up docker-down docker-logs clean

help:
	@echo "PokeCode-Prayas Hackathon CLI Helper"
	@echo ""
	@echo "Usage:"
	@echo "  make dev          - Run both backend & frontend concurrently"
	@echo "  make backend      - Run FastAPI backend locally (port 8000)"
	@echo "  make frontend     - Run React Vite frontend locally (port 3000)"
	@echo "  make test         - Run automated backend tests & frontend typecheck"
	@echo "  make build        - Build frontend production distribution"
	@echo "  make docker-up    - Build and launch all Docker containers"
	@echo "  make docker-down  - Stop all running Docker containers"
	@echo "  make docker-logs  - Follow Docker container logs"
	@echo "  make clean        - Clean cache and build artifacts"

backend:
	@echo "Starting FastAPI backend on http://localhost:8000 (docs at /docs)..."
	cd backend && uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

frontend:
	@echo "Starting React frontend on http://localhost:3000..."
	cd frontend && pnpm dev

dev:
	@echo "Starting Full Stack Development (Press Ctrl+C to stop)..."
	npx concurrently -n "backend,frontend" -c "blue,green" \
		"cd backend && uvicorn app.main:app --reload --port 8000 --host 0.0.0.0" \
		"cd frontend && pnpm dev"

test:
	@echo "Running backend test suite..."
	PYTHONPATH=backend pytest backend/tests
	@echo "Running frontend type check & build verification..."
	cd frontend && pnpm build

build:
	@echo "Building frontend production assets..."
	cd frontend && pnpm build

docker-up:
	@echo "Spinning up Docker containers..."
	docker compose up --build -d
	@echo "Done! Frontend: http://localhost:3000 | Backend: http://localhost:8000/docs"

docker-down:
	@echo "Stopping Docker containers..."
	docker compose down

docker-logs:
	docker compose logs -f

clean:
	rm -rf frontend/dist backend/__pycache__ backend/app/__pycache__ backend/app/*/__pycache__ .pytest_cache
