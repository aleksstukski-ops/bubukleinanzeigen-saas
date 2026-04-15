# Project State

**Zuletzt aktualisiert:** 2026-04-14 (Claude Opus 4.6, Ende Session 1 Teil 2)

Dieses Dokument wird am Ende jeder Session vom Agenten aktualisiert. Kurz, faktisch, kein Gelaber.

---

## Aktueller Stand

**Phase:** Session 1 Teil 2 abgeschlossen
**Nächster Schritt:** Session 1 Teil 3 — Frontend-Skelett vervollständigen

## Was funktioniert

- Docker Compose startet alle 5 Services (postgres, redis, backend, scraper, frontend)
- Backend-API läuft auf Port 8000, OpenAPI-Docs auf `/docs`
- Alembic-Migration erstellt alle Tabellen
- Auth-Flow: Register → Login → Refresh Token → /me
- Kleinanzeigen-Accounts CRUD mit Plan-Limit-Check
- Job-Queue funktioniert end-to-end (DB + Redis)
- Scraper-Worker läuft und nimmt Jobs an (Handler werfen `NotImplementedError` bis Session 2)

## Was NICHT funktioniert / fehlt

- Frontend ist nur ein leeres Gerüst — keine UI-Seiten existieren
- Scraper-Handler sind Stubs — kein echtes Kleinanzeigen-Scraping
- Stripe-Integration komplett offen
- Kein Admin-Dashboard
- Kein Deployment

## Offene Entscheidungen

- Cloud-Browser für visible Login in Production (Browserbase vs. VNC-in-Container vs. lokaler Dev-Only)
- Logging-Stack (stdout + Docker vs. Loki/Grafana)
- E-Mail-Versand (Mailjet vs. Postmark vs. Resend)

## Session-Log

### 2026-04-14: Session 1 Teil 1+2 — Foundation (Claude Opus 4.6)

**Fertiggestellt:**
- Projekt-Struktur angelegt
- `docker-compose.yml` mit allen 5 Services
- Backend komplett: core (config/security/crypto), db, models (User/Account/Listing/Conversation/Message/Job), schemas, api/routers (auth/accounts/jobs/listings/messages), main, services/jobs, shared/queue
- Scraper-Skelett: worker.py, dispatcher.py, session_manager.py
- Alembic: env.py + 0001_initial.py (komplette Initial-Migration)
- Frontend: package.json, Dockerfile, vite.config.js
- `HANDOFF.md`, `PROJECT_STATE.md`, `SETUP_GITHUB.md`, `AGENT_START_PROMPT.md`

**Architektonische Entscheidungen:**
- Scraper als separater Prozess (nicht im API-Container) — bessere Isolation, eigener Crash-Bereich
- Redis-Queue mit 3 Priority-Lanes (high/normal/low) statt single queue — User-Aktionen beat Background-Refresh
- Fernet-Verschlüsselung für Sessions (Key derived from SECRET_KEY) — pragmatisch, bei Leak von SECRET_KEY auch Sessions weg
- SQLAlchemy async durchgehend — spart sync/async Kontextwechsel

**Bewusste Vereinfachungen:**
- Handler sind Stubs, keine echten Playwright-Aktionen — das ist Session 2
- Frontend hat nur package.json/vite-config — UI-Pages sind Session 1 Teil 3
- Kein WebSocket noch — Polling reicht für MVP

## Bekannte Issues

(keine)

## ⚠️ WICHTIG: Migration nach `docker compose down -v`

Nach jedem `docker compose down -v` (oder frischem Setup) muss die Alembic-Migration **manuell** ausgeführt werden, bevor das Backend funktioniert:

```bash
/Applications/Docker.app/Contents/Resources/bin/docker compose exec backend alembic upgrade head
```

Ohne diesen Schritt existieren keine Tabellen → alle API-Calls scheitern mit 500.

## Notizen für nächsten Agenten

Wenn du Session 1 Teil 3 machst: Chef will keine lucide-react Icons (Emojis als Strings), keinen useEffect (`if (!loaded)...` Pattern), axios muss auf 0.27.2 pinned bleiben. Das steht alles in HANDOFF.md — halt dich dran.

Frontend ist mobile-first. iOS Safari Kompatibilität ist Pflicht (removeChild-Fix mit transform statt conditional render, 100dvh statt 100vh).

Wenn Backend läuft, kannst du Frontend gegen echtes Backend testen — nicht mocken.
