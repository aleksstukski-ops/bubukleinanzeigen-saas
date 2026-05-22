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
- [ ] **LISTING-01**: Bulk-Preis aendern (prozentual/absolut)
- [ ] **LISTING-02**: CSV/Excel Import fuer Inserate (Queue, 10-30 Stueck)
- [ ] **LISTING-03**: Vorlagen-System (Templates mit Platzhaltern)
- [ ] **LISTING-04**: Beschreibung von allen Inseraten scrapen

### P2 — Spaeter
- [ ] **UX-01**: Views-Trend Sparkline pro Inserat
- [ ] **UX-02**: Session-Auto-Refresh mit freundlichem Banner
- [ ] **STRIPE-01**: Stripe Produkte anlegen + Webhook testen
- [ ] **MULTI-01**: eBay API-Anbindung (Phase 2 Multi-Platform)
- [ ] **INFRA-01**: Repo umbenennen bubukleinanzeigen-saas → bububay

## IN_PROGRESS
<!-- - [ ] **TASK-ID**: Beschreibung | Agent: [codex/gpt/opus] | Seit: YYYY-MM-DD | Branch: xxx -->
- [ ] **MSG-02**: Push-Notification bei neuer Nachricht | Agent: codex | Seit: 2026-05-22 | Branch: main

## DONE
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
