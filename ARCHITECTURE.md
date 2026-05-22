# BubuBay — Architektur

## Parallel-Arbeitszonen

### Zone A: Backend API — Max 1 Agent
backend/app/api/routers/, schemas/, models/, core/

### Zone B: Scraper — Max 1 Agent
backend/app/scraper/

### Zone C: Frontend Pages — Parallelisierbar!
Verschiedene Pages = verschiedene Agents OK

### Zone D: Shared Components — Max 1 Agent
Layout.jsx, Modal.jsx, api.js, App.jsx

### Zone E: Config — Nur nach Absprache mit Opus
docker-compose.yml, .env, vite.config.js

### Zone F: Docs — Parallelisierbar (append-only)
TASKBOARD.md, CHANGELOG.md, alle .md Dateien

## Stack
- Frontend: React 18 + Vite + Tailwind (Port 3000)
- Backend: FastAPI + Python 3.11 (Port 8000)
- DB: PostgreSQL 16 + Redis 7
- Scraper: Playwright (headless Chromium)
- Infra: Docker Compose, Cloudflare Tunnel, Mac Mini M4
- Domains: bububay.de (Haupt), bubuanzeigen.de (Redirect)
