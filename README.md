# BubuBay

Multi-Plattform-Verkaufsmanager für Kleinanzeigen.de — geplant als Cross-Platform-Tool (eBay, weitere folgen).

Live auf [bububay.de](https://bububay.de) (Vorgaengerdomain: bubuanzeigen.de, leitet weiter).

## Was BubuBay kann

- **Mehrere Kleinanzeigen-Konten** unter einem Login verwalten
- **Inserate** auflisten, hochschieben, loeschen, bearbeiten (inline Preis + Beschreibung)
- **Bulk-Aktionen**: hochschieben, loeschen, Preis (absolut/prozent), Beschreibung re-scrapen
- **CSV-Import** fuer 1-30 Inserate auf einmal
- **Vorlagen** (Templates) mit Platzhaltern fuer wiederkehrende Anzeigen
- **Nachrichten-Inbox** ueber alle Konten, antworten direkt aus der App
- **Push-Notifications** bei neuen Nachrichten (mit Partner-Name + Vorschau)
- **Auto-Bump** auf Wunsch (1, 2, 3, 5, 7, 14 Tage)
- **Views & Bookmarks** scrapen, Verlauf als Chart
- **Session-Auto-Refresh-Check** alle 6 h, Banner wenn ein Konto neu eingeloggt werden muss
- **Stripe-Abos**: Starter / Pro / Business
- **Theme**: Hell/Dunkel + 5 Akzentfarben
- **PWA**: installierbar, offline-Hinweis
- **DSGVO**: Impressum, Datenschutz, AGB, Cookie-Banner
- **Admin-Dashboard** (intern): Users, Accounts, Jobs, Stats

Für Agenten / Maintainer: `CLAUDE.md`, `MASTERPLAN.md`, `PROJECT_STATE.md`, `TASKBOARD.md`.

## Architektur

```
┌─────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Frontend  │─────▶│  FastAPI     │─────▶│   PostgreSQL     │
│  (React PWA)│◀─────│  Backend     │◀─────│  (Source of      │
└─────────────┘      └──────┬───────┘      │   Truth)         │
                            │              └────────┬─────────┘
                            │ enqueues jobs         │ writes
                            ▼                       │
                     ┌──────────────┐      ┌────────┴─────────┐
                     │  Redis Queue │─────▶│ Scraper Worker   │
                     │  (3 lanes)   │      │ (Playwright)     │
                     └──────────────┘      └──────────────────┘
```

Kern-Prinzip: Frontend liest ausschliesslich aus der DB. Jede User-Aktion
erzeugt einen Job (DB + Redis); der Scraper-Worker pollt die Queue,
arbeitet mit Playwright, schreibt das Ergebnis in die DB. Stale-while-
revalidate: `/api/listings` liefert sofort DB-Daten und triggert im
Hintergrund einen Refresh-Job, wenn die Daten aelter als 60-120 s sind.

## Tech-Stack

- **Backend**: FastAPI (Python 3.11), SQLAlchemy 2 (async), Alembic, Pydantic v2
- **Datenbank**: PostgreSQL 16
- **Queue**: Redis 7 (3 Priority-Lanes: high/normal/low)
- **Scraper**: Playwright (Chromium, headless)
- **Frontend**: React 18, Vite, TailwindCSS, axios 0.27.2
- **PWA**: Workbox, manifest, Apple/Android Icons, offline.html
- **Auth**: JWT Access + Refresh, bcrypt, slowapi Rate-Limit
- **Crypto**: Fernet fuer Playwright-Sessions (eigener `FERNET_KEY` in `.env`)
- **Payments**: Stripe (Checkout + Customer Portal + Webhooks)
- **Push**: Web Push via VAPID + pywebpush
- **Email**: SMTP (Gmail App-Passwort)
- **Alerts**: Email + Telegram bei Canary-Failures
- **Hosting**: Mac Mini M4, Cloudflare Tunnel, Docker Compose

## Setup (Development)

```bash
# 1. Repo clonen
git clone https://github.com/aleksstukski-ops/bubukleinanzeigen-saas.git
cd bubukleinanzeigen-saas

# 2. .env anlegen
cp .env.example .env
# Pflichtfelder befuellen:
#  SECRET_KEY     openssl rand -hex 32
#  FERNET_KEY     python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
#  DATABASE_URL   bleibt fuer Docker wie in .env.example
#  VAPID_*        web-push generate-vapid-keys (optional, aber empfohlen)
#  STRIPE_*       Test-Keys aus Stripe Dashboard (optional)
#  SMTP_*         Gmail App-Passwort (optional)

# 3. Alle Services starten
docker compose up -d

# 4. Migrationen ausfuehren
docker compose exec backend alembic upgrade head

# 5. Frontend
open http://localhost:3000

# 6. API Docs
open http://localhost:8000/docs
```

Die fuenf Services: `backend` (Port 8000), `frontend` (Port 3000),
`postgres` (5432), `redis` (6379), `scraper`.

### Kleinanzeigen-Konto einloggen (visibles Browser, lokal)

```bash
cd backend && python3 -m app.scraper.cli_login --account-id <ID>
```

Laeuft NUR auf dem Host (nicht in Docker), braucht GUI/DISPLAY. Der
gespeicherte Playwright-`storage_state` wird Fernet-verschluesselt in
die DB geschrieben und vom Scraper-Worker fuer alle weiteren Jobs wieder
geladen.

## Production-Deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```

Nutzt Nginx (HTTPS via Cloudflare), kein Hot-Reload, kein Source-Mount.
Backups: `scripts/backup-postgres.sh` (Restore: `scripts/restore-postgres.sh`).
Monitoring: Uptime Kuma auf Port 3001.

## Wichtige Endpoints (Auswahl)

- `POST /api/auth/register`, `/login`, `/refresh`, `/me`
- `GET  /api/ka-accounts`, `POST .../{id}/start-login|verify|refresh`
- `GET  /api/ka-accounts/health-summary` — fuer Layout-Banner
- `GET  /api/listings/all` — alle Konten in einem Call
- `POST /api/listings/import-csv` — CSV-Upload (max. 30 Zeilen)
- `POST /api/listings/bulk-price` — `{listing_ids, mode, value}`
- `POST /api/listings/bulk-action` — bump/delete/scrape_description
- `PATCH /api/listings/{id}` — inline Preis/Beschreibung
- `GET  /api/templates`, `POST`, `PUT /{id}`, `DELETE /{id}`
- `GET  /api/messages/conversations`, `POST .../send`, `POST .../mark-read`
- `GET  /api/messages/unread-summary` — fuer Nav-Badge
- `POST /api/billing/checkout-session`, `/portal`, `/webhook`
- `POST /api/push/subscribe`, `/unsubscribe`

Vollstaendige Liste: `http://localhost:8000/docs`.

## Repo-Layout

```
backend/
  app/
    api/routers/          # FastAPI Endpoints
    core/                 # config, crypto, security
    models/               # SQLAlchemy ORM
    scraper/
      pages/              # Page-Objects (Playwright)
      dispatcher.py       # Job-Handler-Routing
      session_manager.py  # Playwright Context pro Account
      worker.py           # Runtime-Loop
    services/             # alerts, email, jobs, push, sessions
    shared/queue.py       # Redis-Queue (3 Lanes)
  migrations/             # Alembic
frontend/
  src/
    components/           # Layout, Modal, ConversationView, ...
    hooks/                # useAuth, usePushNotifications
    lib/api.js            # axios + JWT refresh
    pages/                # Dashboard, Listings, Messages, ...
docker-compose.yml / docker-compose.prod.yml
nginx/                    # Reverse-Proxy fuer Prod
scripts/                  # backup/restore Postgres
CLAUDE.md                 # Code-Regeln + Fehler-Katalog
MASTERPLAN.md             # Gesamtplan
PROJECT_STATE.md          # Aktueller Stand
TASKBOARD.md              # Tasks (TODO/IN_PROGRESS/DONE)
SCHLACHTPLAN_BUBUBAY.md   # Parallele Agent-Arbeit
```

## Repo-Name

Das GitHub-Repo heisst aus historischen Gruenden noch `bubukleinanzeigen-saas`.
Das Produkt heisst **BubuBay** und wird so im UI, in Mails, Pushes und auf
`bububay.de` praesentiert. Ein Rename des Git-Repos ist Chef-Task — Code
und Doku verweisen ueberall schon auf BubuBay.

## Roadmap (Stand 2026-05)

- Phase 1: Kleinanzeigen ✓ live
- Phase 2: eBay-API-Anbindung (`MULTI-01` in TASKBOARD)
- Phase 3: weitere Marketplaces
- UX: Views-Trend Sparkline pro Inserat (`UX-01`)

## Lizenz / Rechtliches

Eigener proprietaerer Code. Nutzer sind selbst dafuer verantwortlich,
die Nutzungsbedingungen von Kleinanzeigen.de einzuhalten. Impressum,
Datenschutz und AGB sind in der App unter `/impressum`, `/datenschutz`,
`/agb` einsehbar.
