# BubuBay — Taskboard

> Jeder Agent MUSS vor Arbeitsbeginn seinen Task als IN_PROGRESS markieren und committen.
> Nach Abschluss: Task nach DONE verschieben, Dateien auflisten, committen.

Letzte Aktualisierung: 2026-05-22

---

## TODO

### P0 — Sofort
- [ ] **CLOUD-01**: Cloudflare bububay.de DNS einrichten (CNAME auf Tunnel)
- [ ] **CLOUD-02**: api.bububay.de Route im Cloudflare Dashboard hinzufügen
- [ ] **CLOUD-03**: bubuanzeigen.de → bububay.de 301 Redirect Rule

### P1 — Naechste Sprint-Runde

### P2 — Spaeter
- [ ] **UX-01**: Views-Trend Sparkline pro Inserat
- [ ] **MULTI-01**: eBay API-Anbindung (Phase 2 Multi-Platform)
- [ ] **INFRA-01**: Repo umbenennen bubukleinanzeigen-saas → bububay (GitHub-Rename, Chef-Task)

## IN_PROGRESS
<!-- - [ ] **TASK-ID**: Beschreibung | Agent: [codex/gpt/opus] | Seit: YYYY-MM-DD | Branch: xxx -->

## DONE
- [x] **INFRA-02**: Docker, migrations, caching, security hardening | Files: backend/Dockerfile, frontend/Dockerfile, docker-compose.yml, backend/app/models/activity_log.py, backend/migrations/versions/0010_add_activity_log.py, backend/app/services/cache.py, backend/app/services/activity.py, backend/app/api/routers/activity.py, backend/app/api/routers/listings.py, backend/app/core/config.py, backend/app/schemas/auth.py, backend/app/main.py | Agent: codex | 2026-05-26 | Commit: 2218b82
- [x] **WATCH-01**: CategoryWatch Backend + CHECK_CATEGORY Job | Agent: codex | 2026-05-24 | Commit: 58fb0ab
- [x] **REPLY-01**: AutoReplyRule Backend + dispatcher hook | Agent: codex | 2026-05-24 | Commit: 58fb0ab
- [x] **CORS-01**: ALLOWED_ORIGINS + FRONTEND_URL auf bububay.de | Agent: codex | 2026-05-24 | Commit: 8df9c58
- [x] **ROUTE-01**: Root "/" -> LandingPage anon / Dashboard signed-in | Agent: codex | 2026-05-24 | Commit: 58d9450
- [x] **UX-02**: Session-Banner mit /ka-accounts/health-summary Polling | Agent: codex | 2026-05-23 | Commit: 0c8cffe
- [x] **A5 (Pass 2)**: Dedizierter POST /listings/bulk-price Endpoint (signed-value percent) | Agent: codex | 2026-05-23 | Commit: ac63140
- [x] **A3 (Pass 2)**: Richer push body (partner+preview) + rebrand email copy | Agent: codex | 2026-05-23 | Commit: 9749e0e
- [x] **AUTH-01 (Pass 2)**: cli_login picks up project-root .env + crypto type guard | Agent: codex | 2026-05-23 | Commit: b712472
- [x] **LISTING-04 (Pass 2)**: Detail-Scrape Cap 5 -> 20 | Agent: codex | 2026-05-22 | Commit: d80d4a5
- [x] **A2**: SEND_MESSAGE Erfolgs-Verifikation (textarea-cleared poll + re-fetch submit) | Agent: codex | 2026-05-22 | Commit: 4d97df6
- [x] **A1**: Scraper Deep-Audit (parallel frame selectors + scoped bump/delete + idle timeouts) | Agent: codex | 2026-05-22 | Commit: 7596ced
- [x] **LISTING-02**: CSV-Import Backend (Frontend siehe Schlachtplan SPUR B) | Agent: codex | 2026-05-22 | Commit: 5563442
- [x] **LISTING-03**: Vorlagen-System (Templates mit Platzhaltern) | Agent: codex | 2026-05-22 | Commit: 449a252
- [x] **LISTING-04**: Bulk-Description-Scrape-Button | Agent: codex | 2026-05-22 | Commit: ecaba58
- [x] **LISTING-01**: Bulk-Preis (absolut + prozentual) | Agent: codex | 2026-05-22 | Commit: a19cd64
- [x] **MSG-02**: Push bei steigendem unread_count | Agent: codex | 2026-05-22 | Commit: d07013f
- [x] **MSG-01**: SEND_MESSAGE Audit + networkidle Timeout | Agent: codex | 2026-05-22 | Commit: 443f101
- [x] **AUTH-01**: FERNET_KEY Fail-Fast-Validation | Agent: codex | 2026-05-22 | Commit: 119adf9
- [x] **SCRAPER-01**: Selektoren-Audit + LOGGED_IN_MARKER haerten | Agent: codex | 2026-05-22 | Commit: 634c833
- [x] **REBRAND-01**: UI-Rebrand | Agent: codex | 2026-05-21 | Commit: 4976a15
- [x] **MSG-03**: 15s Polling + Badge | Agent: codex | 2026-05-21 | Commit: ab145b1
- [x] **LISTING-05**: Inline Price Edit | Agent: codex | 2026-05-21 | Commit: d80f114
- [x] **LISTING-06**: Inline Description Edit | Agent: codex | 2026-05-21 | Commit: 577af11
- [x] **SCRAPER-02**: bookmark_count | Agent: codex | 2026-05-21 | Commit: 1680b54
- [x] **SCRAPER-03**: Detail-Beschreibung | Agent: codex | 2026-05-21 | Commit: e0e76cd
- [x] **LISTING-07**: Bulk-Aktionen | Agent: codex | 2026-05-21
- [x] **MSG-04**: Multi-Account Inbox | Agent: codex | 2026-05-21
- [x] **DOCS-01**: CLOUDFLARE_SETUP.md | Agent: codex | 2026-05-21

## Regeln
1. Vor Arbeit: Task nach IN_PROGRESS, Agent + Branch eintragen, commit + push
2. Nur eigene Dateien aendern
3. Nach Abschluss: Task nach DONE, Commit-Hash eintragen, commit + push
4. Nie zwei Agents an gleicher Datei
5. Feature-Branches nutzen (codex/task-id, gpt/task-id)
