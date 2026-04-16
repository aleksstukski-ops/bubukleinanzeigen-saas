import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AccountStatus, Job, JobType, KleinanzeigenAccount
from app.models.domain import Conversation, Listing, Message
from app.scraper.pages.conversation_page import ConversationPage
from app.scraper.pages.edit_listing_page import EditListingPage
from app.scraper.pages.listings_page import ListingsPage
from app.scraper.pages.login_page import LoginPage
from app.scraper.pages.messages_page import MessagesPage
from app.scraper.selectors import Selectors, UrlPatterns
from app.scraper.session_manager import SessionManager
from app.services.sessions import get_account_storage_state, set_account_storage_state

log = logging.getLogger("scraper.dispatcher")


class JobError(Exception):
    def __init__(self, message: str, *, recoverable: bool = True):
        super().__init__(message)
        self.recoverable = recoverable


async def _not_implemented(job, *_):
    raise JobError(f"Handler for {job.type} not yet implemented", recoverable=False)


async def _get_account(db: AsyncSession, account_id: int | None) -> KleinanzeigenAccount:
    if account_id is None:
        raise JobError("Job is missing account_id", recoverable=False)
    result = await db.execute(select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise JobError(f"Account {account_id} not found", recoverable=False)
    return account


async def _get_listing(db: AsyncSession, *, account_id: int, listing_id: str) -> Listing:
    result = await db.execute(
        select(Listing).where(
            Listing.account_id == account_id,
            Listing.kleinanzeigen_id == listing_id,
        )
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise JobError(f"Listing {listing_id} not found for account {account_id}", recoverable=False)
    return listing


async def _get_conversation(
    db: AsyncSession,
    *,
    account_id: int,
    conversation_id: int | None = None,
    kleinanzeigen_conversation_id: str | None = None,
) -> Conversation:
    query = select(Conversation).where(Conversation.account_id == account_id)
    if conversation_id is not None:
        query = query.where(Conversation.id == conversation_id)
    elif kleinanzeigen_conversation_id:
        query = query.where(Conversation.kleinanzeigen_id == kleinanzeigen_conversation_id)
    else:
        raise JobError("Conversation lookup requires conversation_id or kleinanzeigen_conversation_id", recoverable=False)
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise JobError("Conversation not found", recoverable=False)
    return conversation


def _require_listing_id(job: Job) -> str:
    listing_id = str(job.payload.get("listing_id") or "").strip()
    if not listing_id:
        raise JobError("Job payload is missing listing_id", recoverable=False)
    return listing_id


def _require_conversation_payload(job: Job) -> tuple[int | None, str]:
    conversation_id_raw = job.payload.get("conversation_id")
    kleinanzeigen_conversation_id = str(job.payload.get("kleinanzeigen_conversation_id") or "").strip()

    conversation_id = None
    if conversation_id_raw is not None:
        try:
            conversation_id = int(conversation_id_raw)
        except (TypeError, ValueError) as error:
            raise JobError("Job payload has invalid conversation_id", recoverable=False) from error

    if conversation_id is None and not kleinanzeigen_conversation_id:
        raise JobError(
            "Job payload requires conversation_id or kleinanzeigen_conversation_id",
            recoverable=False,
        )

    return conversation_id, kleinanzeigen_conversation_id


def _require_body(job: Job) -> str:
    body = str(job.payload.get("body") or "").strip()
    if not body:
        raise JobError("Job payload is missing body", recoverable=False)
    return body


async def _get_authenticated_page(
    *,
    job: Job,
    db: AsyncSession,
    session_manager: SessionManager,
) -> tuple[KleinanzeigenAccount, Any]:
    account = await _get_account(db, job.account_id)
    if not account.session_encrypted:
        account.status = AccountStatus.SESSION_EXPIRED.value
        account.last_error = "Keine gespeicherte Session vorhanden"
        await db.commit()
        raise JobError("Missing encrypted session", recoverable=False)

    storage_state = get_account_storage_state(account)
    page = await session_manager.get_page(
        account.id,
        headless=True,
        storage_state=storage_state,
        force_new=True,
    )
    return account, page


async def _mark_session_expired(account: KleinanzeigenAccount, db: AsyncSession, *, message: str) -> None:
    account.status = AccountStatus.SESSION_EXPIRED.value
    account.last_error = message
    await db.commit()


async def _handle_start_login(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    account = await _get_account(db, job.account_id)

    async with session_manager.lock(account.id):
        page = await session_manager.get_page(
            account.id,
            headless=False,
            force_new=True,
        )
        login_page = LoginPage(page)

        try:
            await login_page.open()
            context = page.context
            storage_state, user_name = await login_page.wait_for_manual_login_success(context)
            set_account_storage_state(account, storage_state)
            account.status = AccountStatus.ACTIVE.value
            account.kleinanzeigen_user_name = user_name or account.kleinanzeigen_user_name
            account.last_error = None
            account.session_updated_at = datetime.now(timezone.utc)
            await db.commit()
            return {"success": True, "user_name": user_name}
        except TimeoutError:
            account.status = AccountStatus.PENDING_LOGIN.value
            account.last_error = "Login-Timeout"
            await db.commit()
            raise JobError("Login-Timeout", recoverable=False)
        finally:
            await session_manager.close_account(account.id, headless=False)


async def _handle_verify_session(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    account = await _get_account(db, job.account_id)
    if not account.session_encrypted:
        account.status = AccountStatus.SESSION_EXPIRED.value
        account.last_error = "Keine gespeicherte Session vorhanden"
        await db.commit()
        return {"valid": False}

    storage_state = get_account_storage_state(account)

    async with session_manager.lock(account.id):
        page = await session_manager.get_page(
            account.id,
            headless=True,
            storage_state=storage_state,
            force_new=True,
        )

        await page.goto(UrlPatterns.MY_ADS_BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_selector("body", timeout=10000)
        current_url = page.url

        if any(pattern in current_url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
            account.status = AccountStatus.SESSION_EXPIRED.value
            account.last_error = "Session abgelaufen"
            await db.commit()
            return {"valid": False}

        account.status = AccountStatus.ACTIVE.value
        account.last_error = None
        await db.commit()
        return {"valid": True}


async def _handle_scrape_listings(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    account = await _get_account(db, job.account_id)
    if not account.session_encrypted:
        account.status = AccountStatus.SESSION_EXPIRED.value
        account.last_error = "Keine gespeicherte Session vorhanden"
        await db.commit()
        raise JobError("Missing encrypted session", recoverable=False)

    storage_state = get_account_storage_state(account)

    async with session_manager.lock(account.id):
        page = await session_manager.get_page(
            account.id,
            headless=True,
            storage_state=storage_state,
            force_new=True,
        )

        listings_page = ListingsPage(page)
        await listings_page.open()

        if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
            account.status = AccountStatus.SESSION_EXPIRED.value
            account.last_error = "Session abgelaufen"
            await db.commit()
            return {"count": 0, "valid": False}

        if await listings_page.try_selectors(page, Selectors.LOGGED_IN_MARKER, log_missing=True) is None:
            log.warning("Logged-in marker not found for account %s before scraping listings", account.id)

        scraped_items = await listings_page.scrape()

        existing_result = await db.execute(select(Listing).where(Listing.account_id == account.id))
        existing_records = existing_result.scalars().all()
        existing_by_ka_id = {record.kleinanzeigen_id: record for record in existing_records}

        created_or_updated, seen_ids = listings_page.apply_listing_snapshot(
            existing_by_ka_id,
            scraped_items,
            account_id=account.id,
        )

        for record in created_or_updated:
            db.add(record)

        now = datetime.now(timezone.utc)
        for record in existing_records:
            if record.kleinanzeigen_id not in seen_ids:
                record.is_active = False
                record.last_scraped_at = now

        account.status = AccountStatus.ACTIVE.value
        account.last_error = None
        account.last_scraped_at = now
        await db.commit()

        return {"count": len(scraped_items), "valid": True}


async def _handle_scrape_messages(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    account = await _get_account(db, job.account_id)

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        messages_page = MessagesPage(page)

        try:
            await messages_page.open()

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"count": 0, "valid": False}

            if await messages_page.try_selectors(page, Selectors.LOGGED_IN_MARKER, log_missing=True) is None:
                log.warning("Logged-in marker not found for account %s before scraping messages", account.id)

            scraped_items = await messages_page.scrape_conversations()

            existing_result = await db.execute(select(Conversation).where(Conversation.account_id == account.id))
            existing_records = existing_result.scalars().all()
            existing_by_ka_id = {record.kleinanzeigen_id: record for record in existing_records}

            created_or_updated, seen_ids = messages_page.apply_conversation_snapshot(
                existing_by_ka_id,
                scraped_items,
                account_id=account.id,
            )

            for record in created_or_updated:
                db.add(record)

            now = datetime.now(timezone.utc)
            for record in existing_records:
                if record.kleinanzeigen_id not in seen_ids:
                    record.is_archived = True
                    record.last_scraped_at = now

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {"count": len(scraped_items), "valid": True}
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _handle_scrape_conversation(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    conversation_db_id, kleinanzeigen_conversation_id = _require_conversation_payload(job)
    account = await _get_account(db, job.account_id)
    conversation = await _get_conversation(
        db,
        account_id=account.id,
        conversation_id=conversation_db_id,
        kleinanzeigen_conversation_id=kleinanzeigen_conversation_id,
    )

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        conversation_page = ConversationPage(page)

        try:
            await conversation_page.open(conversation.kleinanzeigen_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"count": 0, "valid": False}

            scraped_items = await conversation_page.scrape_messages()

            existing_result = await db.execute(select(Message).where(Message.conversation_id == conversation.id))
            existing_records = existing_result.scalars().all()
            existing_by_ka_id = {record.kleinanzeigen_id: record for record in existing_records}

            created_or_updated, _seen_ids = conversation_page.apply_message_snapshot(
                existing_by_ka_id,
                scraped_items,
                conversation_id=conversation.id,
            )

            for record in created_or_updated:
                db.add(record)

            now = datetime.now(timezone.utc)
            incoming_unread = 0
            latest_message = None
            for item in scraped_items:
                if item.get("direction") == "incoming" and not item.get("is_read", False):
                    incoming_unread += 1
                latest_message = item

            conversation.unread_count = incoming_unread
            conversation.last_scraped_at = now
            if latest_message is not None:
                conversation.last_message_preview = latest_message.get("body")
                conversation.last_message_at = latest_message.get("sent_at") or now

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {"count": len(scraped_items), "valid": True}
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _handle_send_message(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    conversation_db_id, kleinanzeigen_conversation_id = _require_conversation_payload(job)
    body = _require_body(job)
    account = await _get_account(db, job.account_id)
    conversation = await _get_conversation(
        db,
        account_id=account.id,
        conversation_id=conversation_db_id,
        kleinanzeigen_conversation_id=kleinanzeigen_conversation_id,
    )

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        conversation_page = ConversationPage(page)

        try:
            await conversation_page.open(conversation.kleinanzeigen_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"success": False, "valid": False}

            result = await conversation_page.send_message(body)

            now = datetime.now(timezone.utc)
            message_record = Message(
                conversation_id=conversation.id,
                kleinanzeigen_id=f"outgoing-{job.id}",
                direction="outgoing",
                sender_name="Du",
                body=body,
                sent_at=now,
                is_read=True,
            )
            db.add(message_record)

            conversation.last_message_preview = body
            conversation.last_message_at = now
            conversation.last_scraped_at = now

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {
                **result,
                "conversation_id": conversation.id,
                "valid": True,
            }
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _handle_update_listing(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    listing_id = _require_listing_id(job)
    account = await _get_account(db, job.account_id)
    listing = await _get_listing(db, account_id=account.id, listing_id=listing_id)

    title = str(job.payload.get("title") or "").strip()
    if not title:
        raise JobError("Job payload is missing title", recoverable=False)

    price_value = job.payload.get("price")
    description_value = job.payload.get("description")
    price = str(price_value).strip() if price_value is not None else None
    description = str(description_value).strip() if description_value is not None else None

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        edit_page = EditListingPage(page)

        try:
            await edit_page.open(listing_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"success": False, "valid": False}

            result = await edit_page.update_listing(
                title=title,
                price=price,
                description=description,
            )

            now = datetime.now(timezone.utc)
            listing.title = title
            listing.price = price
            listing.description = description
            listing.is_active = True
            listing.last_scraped_at = now
            db.add(listing)

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {
                **result,
                "listing_id": listing_id,
                "valid": True,
            }
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _handle_delete_listing(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    listing_id = _require_listing_id(job)
    account = await _get_account(db, job.account_id)
    listing = await _get_listing(db, account_id=account.id, listing_id=listing_id)

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        edit_page = EditListingPage(page)

        try:
            result = await edit_page.delete_listing(listing_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"success": False, "valid": False}

            now = datetime.now(timezone.utc)
            listing.is_active = False
            listing.last_scraped_at = now
            db.add(listing)

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {
                **result,
                "valid": True,
            }
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _handle_bump_listing(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    listing_id = _require_listing_id(job)
    account = await _get_account(db, job.account_id)
    listing = await _get_listing(db, account_id=account.id, listing_id=listing_id)

    async with session_manager.lock(account.id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)
        edit_page = EditListingPage(page)

        try:
            result = await edit_page.bump_listing(listing_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                return {"success": False, "valid": False}

            now = datetime.now(timezone.utc)
            listing.is_active = True
            listing.last_scraped_at = now
            db.add(listing)

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await db.commit()

            return {
                **result,
                "valid": True,
            }
        finally:
            await session_manager.close_account(account.id, headless=True)


HANDLERS = {
    JobType.START_LOGIN.value: _handle_start_login,
    JobType.SCRAPE_LISTINGS.value: _handle_scrape_listings,
    JobType.SCRAPE_MESSAGES.value: _handle_scrape_messages,
    JobType.SCRAPE_CONVERSATION.value: _handle_scrape_conversation,
    JobType.SEND_MESSAGE.value: _handle_send_message,
    JobType.CREATE_LISTING.value: _not_implemented,
    JobType.UPDATE_LISTING.value: _handle_update_listing,
    JobType.DELETE_LISTING.value: _handle_delete_listing,
    JobType.BUMP_LISTING.value: _handle_bump_listing,
    JobType.VERIFY_SESSION.value: _handle_verify_session,
}


async def dispatch_job(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any] | None:
    handler = HANDLERS.get(job.type)
    if handler is None:
        raise JobError(f"Unknown job type: {job.type}", recoverable=False)
    log.info("Dispatching job %s (type=%s, attempt=%s)", job.id, job.type, job.attempts)
    return await handler(job, db, session_manager)
