import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import AccountStatus, KleinanzeigenAccount
from app.scraper.pages.login_page import LoginPage
from app.scraper.session_manager import SessionManager
from app.services.sessions import set_account_storage_state

log = logging.getLogger("scraper.cli_login")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def run_login(account_id: int) -> int:
    session_manager = SessionManager()

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id))
            account = result.scalar_one_or_none()
            if account is None:
                log.error("Account %s not found", account_id)
                return 1

            page = await session_manager.get_page(
                account_id,
                headless=False,
                force_new=True,
            )
            login_page = LoginPage(page)

            try:
                await login_page.open()
                storage_state, user_name = await login_page.wait_for_manual_login_success(page.context)

                set_account_storage_state(account, storage_state)
                account.status = AccountStatus.ACTIVE.value
                account.kleinanzeigen_user_name = user_name or account.kleinanzeigen_user_name
                account.last_error = None
                account.session_updated_at = datetime.now(timezone.utc)

                await db.commit()

                result_payload = {
                    "success": True,
                    "account_id": account.id,
                    "user_name": user_name,
                }
                print(json.dumps(result_payload, ensure_ascii=False))
                return 0

            except TimeoutError:
                account.status = AccountStatus.PENDING_LOGIN.value
                account.last_error = "Login-Timeout"
                await db.commit()
                log.error("Login timed out for account %s", account_id)
                return 2

            finally:
                await session_manager.close_account(account_id, headless=False)

    finally:
        await session_manager.close_all()


def main() -> int:
    parser = argparse.ArgumentParser(description="Start visible Kleinanzeigen login on host")
    parser.add_argument("--account-id", type=int, required=True)
    args = parser.parse_args()

    if os.environ.get("DISPLAY") is None and os.name != "nt" and os.environ.get("WAYLAND_DISPLAY") is None:
        log.warning("No DISPLAY/WAYLAND_DISPLAY detected. Visible browser may fail on this host.")

    return asyncio.run(run_login(args.account_id))


if __name__ == "__main__":
    raise SystemExit(main())
