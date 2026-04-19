# BubuKleinanzeigen SaaS

Multi-Account Management für Kleinanzeigen.de — als SaaS.

## Fuer KI-Agenten

**Lies zuerst:** [`MASTERPLAN.md`](./MASTERPLAN.md) (Gesamtplan, Regeln, Fehler-Katalog, Roadmap)
**Dann:** [`PROJECT_STATE.md`](./PROJECT_STATE.md) (aktueller Stand)
**Details:** [`HANDOFF.md`](./HANDOFF.md) (Architektur, Datenmodell, Tech-Stack)
**History:** [`CHANGELOG.md`](./CHANGELOG.md) (was wann gemacht wurde)

## 👉 Für den Chef (menschlicher Projekt-Owner)

**Setup GitHub:** [`SETUP_GITHUB.md`](./SETUP_GITHUB.md)
**Agent starten:** [`AGENT_START_PROMPT.md`](./AGENT_START_PROMPT.md)

## Architektur

```
┌─────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Frontend  │─────▶│  FastAPI     │─────▶│   PostgreSQL     │
│  (React PWA)│◀─────│  Backend     │◀─────│   (Users, Data)  │
└─────────────┘ WS   └──────┬───────┘      └──────────────────┘
                            │                        ▲
                            │ enqueues jobs          │ writes
                            ▼                        │
                     ┌──────────────┐      ┌────────┴─────────┐
                     │  Redis Queue │─────▶│ Scraper Worker   │
                     │              │      │ (Playwright)     │
                     └──────────────┘      └──────────────────┘
```

## Tech Stack

- **Backend:** FastAPI (Python 3.11), SQLAlchemy 2, PostgreSQL, Redis, Playwright
- **Frontend:** React 18, Vite, TailwindCSS, PWA (Workbox)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Payments:** Stripe (later phase)
- **Deployment:** Docker Compose, Cloudflare Tunnel

## Setup (Development)

```bash
# 1. Clone repo
git clone <repo> && cd bubukleinanzeigen-saas

# 2. Copy env
cp .env.example .env
# Edit .env and set SECRET_KEY (generate with: openssl rand -hex 32)

# 3. Start stack
docker compose up -d

# 4. Run migrations
docker compose exec backend alembic upgrade head

# 5. Open frontend
# http://localhost:3000

# 6. Open API docs
# http://localhost:8000/docs
```

## Session Plan

- **Session 1 (now):** Foundation — Auth, DB, API skeleton, Frontend skeleton, Docker
- **Session 2:** Kleinanzeigen account linking + session storage
- **Session 3:** Listings sync + display
- **Session 4:** Messages inbox + reply
- **Session 5:** Push notifications (Web Push)
- **Session 6:** Stripe subscriptions + plan gating
- **Session 7:** Admin dashboard + monitoring
- **Session 8:** Production deployment + launch prep

## Legal

This is a tool. Users are responsible for complying with Kleinanzeigen.de's
Terms of Service and applicable laws. See `docs/TERMS_GUIDANCE.md`.
