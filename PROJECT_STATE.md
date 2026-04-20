# Project State

Zuletzt aktualisiert: 2026-04-20 (Quality Phase abgeschlossen)

## Aktueller Stand

Phase: **Roadmap COMPLETE + Quality Phase DONE**
Naechster Schritt: Echte Stripe-Keys eintragen (falls noch nicht), live testen, Launch.

## Was funktioniert

### Infrastruktur
- Alle 5 Docker-Services laufen (postgres, redis, backend, scraper, frontend)
- bubuanzeigen.de LIVE via Cloudflare Tunnel -> Mac Mini M4
- GitHub Repo, alle Commits gepusht
- SMTP (Gmail App-Passwort) funktioniert

### Auth
- Register, Login, Refresh, Logout -- komplett
- Passwort vergessen + Reset via E-Mail -- komplett
- JWT Access + Refresh Tokens
- Rate-Limiting auf Auth-Endpoints (slowapi): login 20/min, register 10/min, forgot-pw 5/min

### Kleinanzeigen-Accounts
- CRUD mit Plan-Limit-Check
- listing_count jetzt korrekt per Batch-Query (war vorher immer 0)
- Session-Encryption/Decryption end-to-end

### Scraper
- Alle Handler implementiert und funktional
- bookmark_count + view_count Scraping funktioniert
- Canary-Alerts (0 Ergebnisse) -> Email + Telegram Alert
- Parallele Selektor-Suche (max. 1x timeout statt N*timeout)

### Backend API
- Globaler Exception Handler (kein roher Stack-Trace an User)
- Rate-Limiting via slowapi
- N+1 Fixes: listing_count per Batch, messages stale-check per IN, /listings/all Endpoint
- Input-Validierung: EmailStr auf allen Email-Feldern

### Frontend
- Dashboard, Konten, Inserate, Nachrichten, Abrechnung, Einstellungen, Admin
- Theme-System: Hell/Dunkel + 5 Akzentfarben, persistiert in localStorage
- Dark Mode: .dark CSS-Overrides fuer alle hardcodierten Tailwind-Klassen
- PWA: manifest.json, Icons (192/512px), apple-touch-icon, offline.html, SW registriert
- Mobile Nav: 5 Items max (kein Overflow auf 375px)
- Cookie-Banner + Legal Pages (Impressum, Datenschutz, AGB)
- Admin Dashboard (nur fuer is_admin=True)
- Push Notifications (Web Push via VAPID)

### Phase 4 Infrastructure
- docker-compose.prod.yml (Nginx, kein Hot-Reload, kein Source-Mount)
- nginx/nginx.conf + conf.d/app.conf (HTTPS, HSTS, SPA-Fallback, Stripe-Webhook)
- scripts/backup-postgres.sh + restore-postgres.sh
- Uptime Kuma in Prod-Compose

## Was noch manuell noetig ist (Chef-Tasks)

- Stripe: Konto anlegen, Produkte erstellen, Keys in .env eintragen, Webhook registrieren
- Telegram: Bot-Token + Chat-ID in .env fuer Scraper-Alerts
- Legal Pages: Platzhalter durch echte Angaben ersetzen (Anwalt pruefen lassen)
- Impressum: Echte Adresse eintragen
- Icons: Professionelles Logo statt blauem "B" erstellen (optional)
- Alembic Migration: docker compose exec backend alembic upgrade head (nach DB-Reset)

## Known Issues / Fixes die durchgefuehrt wurden

- listing_count war immer 0 -- jetzt per Batch-Query korrekt berechnet
- N+1 in messages.py -- jetzt mit IN-Clause gebatcht
- ListingsPage: N API-Calls pro Account -> jetzt /listings/all (1 Call)
- PasswordResetRequestIn: war `str` statt `EmailStr` -- gefixt
- PWA-Icons: *.png war in .gitignore, Exception fuer frontend/public/*.png hinzugefuegt

## Session-Log

### 2026-04-20: Quality Phase

Fertiggestellt:
1. Mobile Responsive: Nav auf 5 Items begrenzt (375px-sicher)
2. API-Fehlerbehandlung: Globaler Exception Handler in main.py
3. Dark Mode: .dark CSS-Overrides fuer bg-white/bg-slate-*/text-slate-*/border-slate-*
4. PWA: manifest.json, Icons, offline.html, SW mit install/activate/fetch
5. N+1-Fixes: /listings/all, messages batch, listing_count batch
6. Rate-Limiting: slowapi auf Auth-Endpoints
7. Input-Validierung: EmailStr fix

### 2026-04-20: Roadmap abgearbeitet (Tasks 9-15)

- Task 9: Admin Dashboard (stats, users, jobs, accounts -- 4 Tabs)
- Task 10: Email + Telegram Alerts bei Scraper-Fehlern
- Task 11: Theme-System (CSS-Vars, Dark Mode, 5 Akzentfarben, SettingsPage)
- Task 12: docker-compose.prod.yml + Nginx-Reverse-Proxy
- Task 13: Postgres Backup + Restore Scripts
- Task 14: Uptime Kuma in Prod-Compose
- Task 15: Legal Pages + Cookie-Banner

### 2026-04-19: Phase 1+2+3 (Tasks 1-8)

- Phase 1: Alembic Migration, Session-Banner, DOM-Haertung
- Phase 2: Stripe Integration (Checkout, Webhook, BillingPage)
- Phase 3: Push Notifications (VAPID, pywebpush, ServiceWorker)
- Phase 3: Admin Dashboard Backend

## Notizen

- Docker Service-Namen: backend, frontend, postgres, redis, scraper
- Dateien IMMER lesen vor Aenderung
- Kein sed fuer mehrzeilige Aenderungen
- cli_login.py laeuft NUR auf dem Host (nicht in Docker), braucht GUI/DISPLAY
- bookmark_count Selektor: gleiche DOM-Section wie view_count, Regex-basiert
