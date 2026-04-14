# Architecture Decisions Log

Jede bedeutende architektonische Entscheidung wird hier dokumentiert. Format: ADR-Style light.

---

## ADR-001: Scraper als separater Prozess (nicht im API-Container)

**Datum:** 2026-04-14 | **Entscheider:** Claude Opus 4.6
**Kontext:** API und Scraper hätten im selben Container laufen können.
**Entscheidung:** Getrennte Docker-Services.
**Begründung:**
- API-Crashes sollen Scraper nicht mitreißen und umgekehrt
- Playwright braucht anderes Image (offizielles Playwright-Image vs. Python-slim)
- Skalierung: Scraper kann später horizontal skaliert werden, API nicht (wegen WebSocket-State)
- Debugging: Worker-Logs sind sauber getrennt von Request-Logs

**Konsequenz:** Beide teilen sich DB und Redis, nicht In-Process-State. Alle Kommunikation über DB-Jobs + Redis-Queue.

---

## ADR-002: Redis-Queue mit 3 Priority-Lanes

**Datum:** 2026-04-14 | **Entscheider:** Claude Opus 4.6
**Kontext:** Job-Queue könnte FIFO sein oder priorisiert.
**Entscheidung:** 3 separate Redis-Listen (high/normal/low), BLPOP in dieser Reihenfolge.
**Begründung:**
- User-Aktionen (z.B. "sende diese Nachricht") müssen vor Background-Refreshes ausgeführt werden
- Simpler als Redis-Sorted-Set mit Score-basierter Priorität
- Worker-Code bleibt trivial (BLPOP über mehrere Keys ist atomic)

**Konsequenz:** 3 Queue-Keys (`jobs:high`, `jobs:normal`, `jobs:low`). Priority-Mapping: 1-3→high, 4-6→normal, 7-10→low.

---

## ADR-003: Fernet-Verschlüsselung für Session-Storage (Key-Derivation aus SECRET_KEY)

**Datum:** 2026-04-14 | **Entscheider:** Claude Opus 4.6
**Kontext:** Kleinanzeigen-Sessions enthalten Login-Tokens. Wenn DB-Dump leakt, sind alle Accounts kompromittiert.
**Entscheidung:** Fernet (symmetrische Verschlüsselung), Key per SHA-256 aus `SECRET_KEY` abgeleitet.
**Begründung:**
- Pragmatisch: keine KMS-Integration für MVP nötig
- Wenn SECRET_KEY rotiert wird, müssen alle Sessions neu erstellt werden (akzeptabel)
- Zero-Knowledge gegenüber DB allein

**Trade-off:** Wenn SECRET_KEY *und* DB-Dump leaken → alles kompromittiert. Für MVP akzeptabel. Production-Hardening später: SECRET_KEY in HSM/KMS.

---

## ADR-004: Stabile IDs aus URL-Extraction, nie Indexe

**Datum:** 2026-04-14 | **Entscheider:** Claude Opus 4.6 (lesson learned aus Vorgänger-Projekt)
**Kontext:** Vorgänger-Projekt nutzte Array-Index-basierte Identifikation — führte zu "falsches Inserat angezeigt" und "vermischte Chats" Bugs.
**Entscheidung:** Alle Kleinanzeigen-Entities werden per URL-ID identifiziert. Listings: Regex `r'/(\d{9,})-'`. Conversations: URL-Param `conversationId=X`.
**Begründung:**
- Indexe ändern sich bei Sortierung, Filter, Paginierung → Chaos
- URLs sind stabil solange das Inserat existiert
- React-Reconciler braucht stabile Keys, sonst removeChild-Crashes

**Konsequenz:** Jedes Model hat `kleinanzeigen_id` als String-Feld mit Unique-Constraint pro Account.

---

## ADR-005: axios gepinnt auf 0.27.2

**Datum:** 2026-04-14 | **Entscheider:** Chef (Projekt-Präferenz)
**Kontext:** axios 1.x hat in Vorgänger-Projekt destroy-Fehler mit Vite HMR verursacht.
**Entscheidung:** axios 0.27.2, keine Upgrades ohne expliziten Test.
**Begründung:** Known-good Version. Downgrade-Schmerz größer als Upgrade-Nutzen.

---

## Template für neue ADRs

```
## ADR-XXX: Titel

**Datum:** YYYY-MM-DD | **Entscheider:** [Agent-Name / Chef]
**Kontext:** [Worum geht's? Was war die Ausgangslage?]
**Entscheidung:** [Was wurde entschieden?]
**Begründung:** [Warum diese Entscheidung?]
**Konsequenz:** [Was folgt daraus? Was muss man jetzt beachten?]

(Optional)
**Alternativen:** [Was wurde sonst noch erwogen?]
**Trade-offs:** [Was wird bewusst geopfert?]
```
