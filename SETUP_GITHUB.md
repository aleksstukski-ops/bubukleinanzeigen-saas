# GitHub-Setup für BubuKleinanzeigen

Diese Anleitung ist für dich (den Chef), nicht für den Agenten. Folge Schritt für Schritt.

---

## Was du damit erreichst

Du hast einen zentralen Ort, an dem dein ganzer Projektcode lebt. Jeder KI-Agent (Claude, GPT-5, etc.) kann drauf zugreifen. Du siehst alle Änderungen. Du kannst jederzeit zurückspringen wenn was kaputtgeht.

Zeitaufwand einmalig: **15 Minuten**. Danach nie wieder Setup.

---

## Schritt 1: GitHub-Account erstellen (3 Min)

Falls du noch keinen hast:

1. Gehe auf **https://github.com/signup**
2. E-Mail eingeben → Passwort wählen → Username wählen (z.B. `miniagent-dev`)
3. Verifizierungscode aus E-Mail eingeben
4. Fertig. Kostenlos.

---

## Schritt 2: Privates Repository anlegen (2 Min)

1. Oben rechts auf das **+** klicken → **New repository**
2. Einstellungen:
   - **Repository name:** `bubukleinanzeigen-saas`
   - **Description:** `Multi-Account Kleinanzeigen.de Management SaaS`
   - **Privacy:** **Private** anklicken (wichtig! Sonst sieht es jeder)
   - Haken **NICHT** setzen bei "Add a README" (haben wir schon)
   - Haken **NICHT** setzen bei ".gitignore" (haben wir schon)
   - Haken **NICHT** setzen bei "license" (haben wir schon)
3. **Create repository** klicken

Du landest auf einer Seite mit Befehlen — die brauchen wir gleich.

---

## Schritt 3: Git auf deinem Mac einrichten (3 Min, einmalig)

Falls Git noch nie konfiguriert:

```bash
git config --global user.name "Dein Name"
git config --global user.email "deine@email.de"
```

Die E-Mail muss mit der von GitHub übereinstimmen.

**Authentifizierung:** Du brauchst einen Personal Access Token (PAT) für den Push. Passwörter funktionieren nicht mehr bei GitHub.

1. Auf GitHub: Oben rechts dein Profilbild → **Settings**
2. Links ganz unten: **Developer settings**
3. Links: **Personal access tokens** → **Tokens (classic)**
4. Oben rechts: **Generate new token** → **Generate new token (classic)**
5. Einstellungen:
   - **Note:** `BubuKleinanzeigen Mac`
   - **Expiration:** `90 days` (oder länger)
   - **Scopes:** Haken setzen bei **repo** (das reicht)
6. Unten **Generate token** klicken
7. **WICHTIG:** Token kopieren und irgendwo sicher speichern (z.B. 1Password, Keychain). Wird nur einmal angezeigt.

---

## Schritt 4: Projekt hochladen (5 Min)

Öffne Terminal und geh ins Projekt-Verzeichnis. Du bekommst von mir das Zip-File `bubukleinanzeigen-saas.zip`. Entpacke es:

```bash
cd ~/Projects
unzip bubukleinanzeigen-saas.zip
cd bubukleinanzeigen-saas
```

Jetzt das Projekt als Git-Repo initialisieren und hochladen:

```bash
# Git initialisieren
git init

# Main-Branch verwenden
git branch -M main

# Alle Dateien hinzufügen
git add .

# Erster Commit
git commit -m "chore: initial project foundation (Session 1 Teil 1+2)"

# Mit GitHub-Repo verbinden (ersetze USERNAME mit deinem GitHub-Username)
git remote add origin https://github.com/USERNAME/bubukleinanzeigen-saas.git

# Hochladen
git push -u origin main
```

Beim ersten Push fragt Git nach Username + Passwort:
- **Username:** Dein GitHub-Username
- **Password:** Der Personal Access Token von Schritt 3 (NICHT dein GitHub-Passwort)

Wenn alles klappt, siehst du auf der GitHub-Seite deines Repos jetzt alle Dateien.

---

## Schritt 5: Agent auf Repo loslassen

### Variante A: ChatGPT Pro mit Connectors (einfachster Weg)

ChatGPT Pro hat GitHub-Integration:

1. In ChatGPT oben auf das **...** neben dem Chat-Titel → **Connectors** oder **Tools**
2. **GitHub** verbinden, dein Repo auswählen
3. Neuen Chat starten mit dem Prompt aus `AGENT_START_PROMPT.md`

### Variante B: GPT manuell mit Dateien füttern

Falls du keine GitHub-Integration hast:

1. Öffne in GitHub dein Repo
2. Klick auf die Datei `HANDOFF.md` → oben rechts **Raw** klicken
3. Die URL kopieren (sieht so aus: `https://raw.githubusercontent.com/USERNAME/bubukleinanzeigen-saas/main/HANDOFF.md`)
4. Im ChatGPT-Chat: den `AGENT_START_PROMPT.md`-Prompt einfügen, den Raw-Link einbauen
5. GPT liest via Fetch die Datei

### Variante C: Repo öffentlich machen (einfachster Fallback)

Falls Connectors nicht gehen: Repo **temporär öffentlich** machen. Dann kann jede KI mit Web-Zugriff die Dateien lesen.

GitHub → Repo → **Settings** → ganz unten **Danger Zone** → **Change visibility** → Public.

**Nachteil:** Jeder im Netz kann reinschauen. Für dein Projekt unproblematisch, solange keine API-Keys/Secrets drin sind. Unser `.gitignore` sorgt dafür, dass `.env` nicht ins Repo kommt.

---

## Schritt 6: Täglicher Workflow

Wenn der Agent fertig ist mit einer Session:

**Falls Agent via Connector arbeitet:**
Er committet und pusht selbst. Du machst auf deinem Mac:

```bash
cd ~/Projects/bubukleinanzeigen-saas
git pull
```

Und hast die neuen Dateien lokal.

**Falls Agent dir Code im Chat gibt:**
Du kopierst die Dateien rein, committest selbst:

```bash
git add .
git commit -m "feat: session 1 teil 3 frontend skeleton (GPT-5)"
git push
```

---

## Problem-Lösungen

**"Permission denied" beim Push:**
Du hast dein Passwort statt Token eingegeben. Nochmal mit Token versuchen.

**"Repository not found":**
Tippfehler im Remote-URL. Prüfen mit `git remote -v`. Korrigieren mit `git remote set-url origin https://github.com/USERNAME/bubukleinanzeigen-saas.git`.

**"Updates were rejected":**
Remote hat Änderungen, die du lokal nicht hast. `git pull --rebase` dann nochmal `git push`.

**Commit zurückrollen:**
Den letzten Commit rückgängig, Dateien behalten: `git reset --soft HEAD~1`
Den letzten Commit komplett weg: `git reset --hard HEAD~1` (Vorsicht, löscht Änderungen!)

---

## Zusammenfassung

Nach diesem Setup:
- Dein Code lebt auf GitHub unter `github.com/USERNAME/bubukleinanzeigen-saas`
- Du gibst jedem Agenten nur den Repo-Link + den Start-Prompt
- Änderungen sind versioniert, du kannst immer zurück
- Multi-Agent-Arbeit ist trivial — alle arbeiten am selben Code

Wenn irgendwas hakt, schreib Claude oder GPT "Hilfe mit Git: [Fehlermeldung]". Die beantworten das in Sekunden.
