# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

---

## Projekt

Multi-Account Kleinanzeigen.de Management als SaaS. Live auf **bubuanzeigen.de** (Cloudflare Tunnel → Mac Mini M4).

**Lies-Reihenfolge beim Einsteigen:** `MASTERPLAN.md` → `PROJECT_STATE.md` → `HANDOFF.md` → Code.

**Letzter Schritt IMMER:** `PROJECT_STATE.md` aktualisieren, committen, pushen.

---

## Entwicklung starten

```bash
# Alle Services starten
docker compose up -d

# Logs prüfen
docker compose logs backend --tail 20
docker compose logs scraper --tail 20

# Services neu starten
docker compose up -d --force-recreate backend

# Alembic-Migration ausführen (im backend-Container)
docker compose exec backend alembic upgrade head

# Kleinanzeigen-Login (lokal, visibles Browser)
cd backend && python3 -m app.scraper.cli_login --account-id <ID>
```

Die **5 Services**: `backend` (Port 8000), `frontend` (Port 3000), `postgres` (5432), `redis` (6379), `scraper`.

---

## Architektur

```
Frontend (React 18 SPA)
  → FastAPI Backend (/api/*)
  → PostgreSQL (Source of Truth)
  → Redis Queue → Scraper Worker (Playwright)
```

**Kern-Prinzip:** Frontend liest **nur** aus DB. User-Aktionen erzeugen Jobs (DB + Redis). Der Scraper-Worker pollt die Queue, arbeitet mit Playwright, schreibt Ergebnis in DB. Frontend pollt Job-Status.

**Stale-while-revalidate:** `/api/listings` liefert sofort DB-Daten und triggert im Hintergrund einen Refresh-Job wenn die Daten älter als 60–120s sind.

### Backend (`backend/app/`)

| Pfad | Zweck |
|------|-------|
| `core/config.py` | Pydantic Settings aus `.env` (FERNET_KEY, SMTP, DB-URL) |
| `core/crypto.py` | Fernet-Verschlüsselung für Playwright-Sessions |
| `core/security.py` | JWT Access+Refresh, bcrypt |
| `models/domain.py` | Listing, Conversation, Message |
| `models/job.py` | Job, JobStatus, JobType |
| `scraper/selectors.py` | CSS-Selektoren mit Fallback-Cascades |
| `scraper/dispatcher.py` | Job-Handler-Routing (alle Actions) |
| `scraper/worker.py` | Runtime-Loop, Semaphore, Retry, Screenshot-on-Fail |
| `scraper/session_manager.py` | Playwright-Context pro Account, per-Account-Locks |
| `services/jobs.py` | `enqueue_job()` — atomarer DB-Insert + Redis-Push |
| `shared/queue.py` | Redis-Queue mit 3 Priority-Lanes (high/normal/low) |

### Frontend (`frontend/src/`)

| Pfad | Zweck |
|------|-------|
| `lib/api.js` | axios 0.27.2-Instance mit JWT-Interceptor + silent Refresh |
| `hooks/useAuth.jsx` | Auth-Context, localStorage-basiert |
| `components/Layout.jsx` | Bottom-Nav (Mobile) / Sidebar (Desktop) |
| `pages/` | LoginPage, RegisterPage, DashboardPage, AccountsPage, ListingsPage, MessagesPage |

---

## Code-Regeln (nicht verletzen)

### Frontend

- **Kein `useEffect`** → stattdessen: `if (!loaded) { setLoaded(true); load() }`
- **Kein React StrictMode** (Double-Mount-Problem)
- **Keine lucide-react Icons** — nur Emojis als Strings: `{'📋'}`
- **Emojis in JSX als String-Literale**: `'📦'`, nicht `📦`
- **axios 0.27.2** — axios 1.x bricht Vite HMR mit destroy-Fehler
- **React 18** — keine React 19 Features
- **Mobile-first**, iOS Safari Pflicht
- **Panel-Slides via `translate3d`**, nicht via conditional rendering (verhindert removeChild-Crash auf Mobile Safari)
- **React `key`**: immer stabile IDs, nie Array-Index
- 2 Spaces Indentation in JS/JSX

### Backend

- Async-only — keine synchronen DB-Calls in Async-Context
- Pydantic v2, SQLAlchemy 2 async, Python 3.11
- Alembic für alle Schema-Änderungen
- 4 Spaces Indentation in Python

### Allgemein

- **ASCII-only Code** — keine Smart Quotes (`"` `"` `'` `'`)
- **Deutsch UI**, Englisch Code-Kommentare und Commit-Messages
- Commit-Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- **Vor jeder Datei-Bearbeitung: Datei lesen** — nie blind editieren

---

## Fehler-Katalog (bekannte Fallen)

| # | Problem | Lösung |
|---|---------|--------|
| 1 | Python-Inline-Script leert Datei mit `write(None)` | Nie Inline-Scripts zum Patchen. `cat > datei << 'EOF'` oder Edit-Tool nutzen |
| 2 | `sed` mit komplexem Regex in zsh scheitert | Komplette Datei neu schreiben statt sed |
| 3 | GPT liefert Smart Quotes | Vor Einspielen prüfen: `grep -P '[\x{201C}\x{201D}]' datei` |
| 4 | FERNET_KEY nicht als eigene Env-Variable | `FERNET_KEY` muss eigene Variable in `.env` sein — nie aus `SECRET_KEY` ableiten |
| 5 | Service heißt `scraper`, nicht `worker` | Immer erst `docker compose ps` prüfen |
| 6 | DOM-Selektor existiert nicht | Selektoren gegen Live-DOM prüfen; `bookmark_count` und `view_count` stehen im gleichen Element (Regex `(\d+)\s*mal gemerkt`) |

---

## Validierung vor Commit

```bash
# Datei nicht leer?
wc -l <datei>

# Smart Quotes?
grep -cP '[\x{201C}\x{201D}\x{2018}\x{2019}]' <datei>

# Python-Syntax?
python3 -c "import ast; ast.parse(open('<datei>').read())"

# Services healthy?
docker compose up -d && docker compose ps

# Backend-Logs?
docker compose logs backend --tail 20
```

---

## Datenmodell (Kern)

- Kleinanzeigen-IDs immer als **String** — Regex `r'/(\d{9,})-'` aus URL
- Konversations-IDs aus URL-Parameter `conversationId=X`
- `kleinanzeigen_accounts.session_encrypted` — Fernet-verschlüsseltes Playwright `storage_state` JSON
- `jobs.payload` — JSONB, enthält `kleinanzeigen_id` für Listing-Actions

---

## iOS Safari Fixes

```jsx
// Panel-Slide (kein removeChild-Crash)
<div style={{
  transform: isOpen ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
  pointerEvents: isOpen ? 'auto' : 'none',
}} className="fixed inset-0 z-50 transition-transform duration-200">

// Scrollbarer Container mit fixem Header
<div className="flex flex-col" style={{ height: '100dvh' }}>
  <header className="flex-shrink-0">...</header>
  <div className="flex-1 overflow-y-auto overscroll-contain">...</div>
</div>
```

Wenn `position: fixed` Nav mit Content scrollt: Vorfahren auf `transform`, `filter`, `perspective`, `will-change`, `contain` prüfen und entfernen.

---

## Notfall

```bash
# Datei kaputt
git checkout -- <datei>

# Container crashed
docker compose logs <service> --tail 50
docker compose up -d --force-recreate <service>

# Session invalidieren + neu einloggen
docker compose exec postgres psql -U bubu bubukleinanzeigen -c \
  "UPDATE kleinanzeigen_accounts SET session_encrypted=NULL, status='pending_login' WHERE id=<ID>;"
```
