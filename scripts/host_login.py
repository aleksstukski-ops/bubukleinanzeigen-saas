#!/usr/bin/env python3
"""Standalone Kleinanzeigen login for the host machine (Mac Mini).

The Dockerized scraper cannot open a visible browser (no display), so the
manual login — where a human types the email/password and solves any captcha —
must run here, on the machine with a screen. This script opens a real Chromium
window, waits for you to finish logging in, then encrypts the browser session
in the exact same format the Docker scraper reads (Fernet over storage_state
JSON) and writes it straight into the database.

Deliberately standalone: it depends only on playwright, cryptography and
asyncpg, and reads FERNET_KEY + DATABASE_URL from the project .env — so it does
not need the full backend app installed on the host.

Usage (via scripts/login.sh, which sets up the venv):
    python scripts/host_login.py --account-id 16
    python scripts/host_login.py --label Riri
"""
import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
from cryptography.fernet import Fernet
from playwright.async_api import async_playwright

LOGIN_URL = "https://www.kleinanzeigen.de/m-einloggen.html"
MY_ADS_BASE_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html"
LOGIN_SUCCESS_PATTERNS = ["/m-meine-anzeigen.html", "/m-meine-anzeigen/"]

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def to_host_dsn(database_url: str) -> str:
    """Turn the app's async SQLAlchemy URL into a plain asyncpg DSN reachable
    from the host: drop the +asyncpg driver suffix and rewrite the Docker
    service hostname to localhost (postgres is published on 5432)."""
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://")
    dsn = dsn.replace("@postgres:", "@localhost:")
    return dsn


async def resolve_account(conn, account_id: int | None, label: str | None):
    if account_id is not None:
        return await conn.fetchrow(
            "SELECT id, label, status FROM kleinanzeigen_accounts WHERE id = $1", account_id
        )
    rows = await conn.fetch(
        "SELECT id, label, status FROM kleinanzeigen_accounts WHERE lower(label) = lower($1)", label
    )
    if len(rows) > 1:
        print(f"Mehrere Konten heissen '{label}':", flush=True)
        for row in rows:
            print(f"  id={row['id']}  status={row['status']}", flush=True)
        print("Bitte --account-id <ID> verwenden.", flush=True)
        return None
    return rows[0] if rows else None


async def run(account_id: int | None, label: str | None) -> int:
    env = load_env(PROJECT_ROOT / ".env")
    fernet_key = env.get("FERNET_KEY")
    database_url = env.get("DATABASE_URL")
    if not fernet_key or not database_url:
        print("FEHLER: FERNET_KEY oder DATABASE_URL fehlt in .env", flush=True)
        return 1

    fernet = Fernet(fernet_key.encode())
    conn = await asyncpg.connect(to_host_dsn(database_url))
    try:
        account = await resolve_account(conn, account_id, label)
        if account is None:
            print("Konto nicht gefunden.", flush=True)
            return 1

        acc_id = account["id"]
        print(f"\n=== Login fuer Konto '{account['label']}' (id={acc_id}) ===", flush=True)
        print("Ein Browserfenster oeffnet sich. Melde dich dort bei Kleinanzeigen an.", flush=True)
        print("Sobald du auf 'Meine Anzeigen' landest, wird die Sitzung gespeichert.\n", flush=True)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=False,
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                locale="de-DE",
                timezone_id="Europe/Berlin",
                no_viewport=True,
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
                ),
            )
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            page = await context.new_page()
            await page.goto(LOGIN_URL, wait_until="domcontentloaded")
            try:
                await page.bring_to_front()
            except Exception:
                pass

            deadline = 900  # 15 minutes
            elapsed = 0
            success = False
            left_login = False
            while elapsed < deadline:
                url = page.url
                if any(p in url for p in LOGIN_SUCCESS_PATTERNS):
                    success = True
                    break
                # Once the user has left the login page (logged in and browsing),
                # gently confirm by loading "Meine Anzeigen" — if it stays there,
                # the session is valid; if it bounces back to login, keep waiting.
                if "einloggen" not in url and "/login" not in url and not left_login and elapsed > 4:
                    left_login = True
                    try:
                        await page.goto(MY_ADS_BASE_URL, wait_until="domcontentloaded")
                        if any(p in page.url for p in LOGIN_SUCCESS_PATTERNS):
                            success = True
                            break
                    except Exception:
                        pass
                    left_login = False  # allow another confirm attempt later
                if elapsed % 30 == 0 and elapsed > 0:
                    print(f"...warte auf Login ({elapsed}s / {deadline}s)", flush=True)
                await page.wait_for_timeout(2000)
                elapsed += 2

            if not success:
                print(
                    "Zeitueberschreitung: Login nicht erkannt. Tipp: nach dem Einloggen "
                    "oben rechts auf 'Meine Anzeigen' klicken.",
                    flush=True,
                )
                await browser.close()
                return 2

            storage_state = await context.storage_state()
            await browser.close()

        payload = json.dumps(storage_state, ensure_ascii=False, separators=(",", ":"))
        encrypted = fernet.encrypt(payload.encode()).decode()
        now = datetime.now(timezone.utc)
        await conn.execute(
            """
            UPDATE kleinanzeigen_accounts
            SET session_encrypted = $1,
                status = 'active',
                last_error = NULL,
                session_updated_at = $2
            WHERE id = $3
            """,
            encrypted, now, acc_id,
        )
        print(f"\nErfolg! Konto '{account['label']}' ist jetzt verbunden (status=active).", flush=True)
        print("Der Scraper nutzt die Sitzung ab sofort automatisch.", flush=True)
        return 0
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Kleinanzeigen-Login am Host (sichtbarer Browser)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--account-id", type=int, help="ID des Kontos")
    group.add_argument("--label", type=str, help="Name/Label des Kontos, z. B. Riri")
    args = parser.parse_args()
    return asyncio.run(run(args.account_id, args.label))


if __name__ == "__main__":
    sys.exit(main())
