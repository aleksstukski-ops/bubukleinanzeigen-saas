import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AccountStatus, Job, JobType, KleinanzeigenAccount, User
from app.models.domain import ListingStat
from app.services.push import send_push_to_user
from app.models.domain import Conversation, Listing, Message
from app.scraper.pages.conversation_page import ConversationPage
from app.scraper.pages.edit_listing_page import EditListingPage
from app.scraper.pages.listing_detail_page import ListingDetailPage
from app.scraper.pages.listings_page import ListingsPage
from app.scraper.pages.login_page import LoginPage
from app.scraper.pages.messages_page import MessagesPage
from app.scraper.selectors import Selectors, UrlPatterns
from app.scraper.session_manager import SessionManager
from app.services.alerts import send_alert
from app.services.jobs import enqueue_job
from app.services.sessions import get_account_storage_state, set_account_storage_state
from app.shared.events import publish_event

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

    # Notify the account owner via push
    try:
        user_result = await db.execute(
            select(User).join(KleinanzeigenAccount, KleinanzeigenAccount.user_id == User.id)
            .where(KleinanzeigenAccount.id == account.id)
        )
        user = user_result.scalar_one_or_none()
        if user and getattr(user, "notify_push_new_message", True):
            await send_push_to_user(
                db, user.id,
                title="Session abgelaufen",
                body=f"Konto \"{account.label}\" muss neu eingeloggt werden.",
                url="/accounts",
            )
    except Exception:
        log.exception("Failed to send session-expired push for account %s", account.id)


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

        # Canary: 0 results on an active account likely means DOM changed
        if len(scraped_items) == 0:
            log.warning(
                "Canary alert: 0 listings scraped for account %s — possible DOM change",
                account.id,
            )
            snapshot_path = await session_manager.capture_debug_snapshot(account.id, job.id)
            if snapshot_path:
                log.warning("Debug snapshot saved at: %s", snapshot_path)
            import asyncio as _asyncio
            _asyncio.ensure_future(send_alert(
                subject=f"[BubuKA] Canary: 0 listings scraped (account {account.id})",
                body=(
                    f"Account ID: {account.id}\n"
                    f"Label: {account.label}\n"
                    f"Job ID: {job.id}\n\n"
                    "0 listings returned — possible DOM change on Kleinanzeigen."
                    + (f"\nSnapshot: {snapshot_path}" if snapshot_path else "")
                ),
            ))

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

        # Save stat snapshots for active listings (only when counts changed)
        for record in existing_records:
            if record.is_active and (record.view_count is not None or record.bookmark_count is not None):
                stat = ListingStat(
                    listing_id=record.id,
                    scraped_at=now,
                    view_count=record.view_count,
                    bookmark_count=record.bookmark_count,
                )
                db.add(stat)

        account.status = AccountStatus.ACTIVE.value
        account.last_error = None
        account.last_scraped_at = now
        await db.commit()

        # Auto-trigger detail scrape for listings that have a URL but no description yet.
        # Cap per cycle so a fresh account does not flood the queue; 20 strikes a
        # balance between fast backfill on new accounts and queue pressure.
        needs_detail = [
            r for r in created_or_updated
            if r.is_active and r.url and not (r.description and r.description.strip())
        ][:20]
        for record in needs_detail:
            await enqueue_job(
                db,
                JobType.SCRAPE_LISTING_DETAIL,
                account_id=account.id,
                payload={"listing_id": record.kleinanzeigen_id, "url": record.url},
                priority=6,
                deduplicate=False,
            )

        return {"count": len(scraped_items), "valid": True}


async def _handle_scrape_listing_detail(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    listing_id = _require_listing_id(job)
    account = await _get_account(db, job.account_id)
    listing = await _get_listing(db, account_id=account.id, listing_id=listing_id)

    url = str(job.payload.get("url") or listing.url or "").strip()
    if not url:
        raise JobError("Job payload is missing url for listing detail", recoverable=False)

    if not account.session_encrypted:
        raise JobError("Missing encrypted session", recoverable=False)
    storage_state = get_account_storage_state(account)

    async with session_manager.lock(account.id):
        page = await session_manager.get_page(
            account.id,
            headless=True,
            storage_state=storage_state,
            force_new=True,
        )

        detail_page = ListingDetailPage(page)
        await detail_page.open(url)

        description = await detail_page.extract_description()

        now = datetime.now(timezone.utc)
        if description:
            listing.description = description
        listing.last_scraped_at = now
        db.add(listing)

        account.last_scraped_at = now
        await db.commit()

        return {
            "listing_id": listing_id,
            "description_length": len(description) if description else 0,
            "valid": True,
        }


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

            # Canary: 0 conversations may indicate DOM change
            if len(scraped_items) == 0:
                log.warning(
                    "Canary alert: 0 conversations scraped for account %s — possible DOM change",
                    account.id,
                )
                snapshot_path = await session_manager.capture_debug_snapshot(account.id, job.id)
                if snapshot_path:
                    log.warning("Debug snapshot saved at: %s", snapshot_path)
                import asyncio as _asyncio
                _asyncio.ensure_future(send_alert(
                    subject=f"[BubuKA] Canary: 0 messages scraped (account {account.id})",
                    body=(
                        f"Account ID: {account.id}\n"
                        f"Label: {account.label}\n"
                        f"Job ID: {job.id}\n\n"
                        "0 conversations returned — possible DOM change on Kleinanzeigen."
                        + (f"\nSnapshot: {snapshot_path}" if snapshot_path else "")
                    ),
                ))

            existing_result = await db.execute(select(Conversation).where(Conversation.account_id == account.id))
            existing_records = existing_result.scalars().all()
            existing_by_ka_id = {record.kleinanzeigen_id: record for record in existing_records}

            # Snapshot previous unread counts before apply_conversation_snapshot
            # overwrites them — needed to detect "unread_count grew" notifications.
            previous_unread_by_ka_id = {
                record.kleinanzeigen_id: int(record.unread_count or 0)
                for record in existing_records
            }

            created_or_updated, seen_ids = messages_page.apply_conversation_snapshot(
                existing_by_ka_id,
                scraped_items,
                account_id=account.id,
            )

            # Blocklist: conversations from blocked partners land in spam
            from app.models import BlockedPartner
            blocked_result = await db.execute(
                select(BlockedPartner.partner_name).where(BlockedPartner.user_id == account.user_id)
            )
            blocked_names = {name for (name,) in blocked_result.all()}
            if blocked_names:
                for record in created_or_updated:
                    if (record.partner_name or "").strip() in blocked_names:
                        record.is_spam = True

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

            # Push notification covers both brand-new conversations with unread > 0
            # AND existing conversations where unread_count grew since last scrape.
            new_unread = 0
            triggering_items: list[dict] = []
            for item in scraped_items:
                ka_id = item["kleinanzeigen_id"]
                current_unread = int(item.get("unread_count") or 0)
                if current_unread <= 0:
                    continue
                previous_unread = previous_unread_by_ka_id.get(ka_id, 0)
                delta = 0
                if ka_id not in previous_unread_by_ka_id:
                    delta = current_unread
                elif current_unread > previous_unread:
                    delta = current_unread - previous_unread
                if delta > 0:
                    new_unread += delta
                    triggering_items.append(item)

            # Realtime: tell the frontend the conversation list changed.
            # Fired on every scrape (not only on new unread) so previews,
            # ordering and archived flags stay fresh without polling.
            await publish_event(account.user_id, "conversations.updated", {
                "account_id": account.id,
                "new_unread": new_unread,
            })

            if new_unread > 0:
                user_result = await db.execute(
                    select(User).join(KleinanzeigenAccount, KleinanzeigenAccount.user_id == User.id)
                    .where(KleinanzeigenAccount.id == account.id)
                )
                user = user_result.scalar_one_or_none()
                if user:
                    # When a single conversation changed, show partner + preview;
                    # otherwise a roll-up by account.
                    if new_unread == 1 and len(triggering_items) == 1:
                        single = triggering_items[0]
                        partner = (single.get("partner_name") or "Unbekannt").strip() or "Unbekannt"
                        preview = (single.get("last_message_preview") or "").strip()
                        push_title = f"Neue Nachricht von {partner}"
                        push_body = preview[:140] if preview else f"Auf {account.label}"
                        email_subject = f"[BubuBay] Neue Nachricht von {partner}"
                        email_html = (
                            f"<p><strong>{partner}</strong> ({account.label})</p>"
                            f"<p>{preview or 'Keine Vorschau verfuegbar.'}</p>"
                            f"<p><a href='https://bububay.de/messages'>Jetzt ansehen</a></p>"
                        )
                    else:
                        push_title = "Neue Nachrichten"
                        push_body = (
                            f"{new_unread} neue Nachricht"
                            f"{'en' if new_unread > 1 else ''} auf {account.label}"
                        )
                        email_subject = f"[BubuBay] {push_body}"
                        email_html = (
                            f"<p>{push_body}</p>"
                            f"<p><a href='https://bububay.de/messages'>Jetzt ansehen</a></p>"
                        )

                    if getattr(user, "notify_push_new_message", True):
                        try:
                            await send_push_to_user(
                                db, user.id,
                                title=push_title,
                                body=push_body,
                                url="/messages",
                            )
                        except Exception as exc:
                            # Push delivery must never break the scrape job
                            log.warning("send_push_to_user failed for user %s: %s", user.id, exc)
                    if getattr(user, "notify_email_new_message", False):
                        import asyncio as _asyncio
                        from app.services.email import send_email as _send_email
                        _asyncio.ensure_future(asyncio.to_thread(
                            _send_email,
                            to=user.email,
                            subject=email_subject,
                            body_html=email_html,
                        ))

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

            await publish_event(account.user_id, "conversation.updated", {
                "conversation_id": conversation.id,
                "account_id": account.id,
                "message_count": len(scraped_items),
            })

            # Auto-reply: brand-new incoming messages whose body matches a rule
            # get a SEND_MESSAGE job enqueued. We only fire on messages that
            # were not in existing_by_ka_id before this scrape, so re-scraping
            # a conversation does not re-trigger replies.
            await _maybe_trigger_auto_replies(
                db,
                account=account,
                conversation=conversation,
                fresh_incoming=[
                    item for item in scraped_items
                    if item.get("direction") == "incoming"
                    and item["kleinanzeigen_id"] not in existing_by_ka_id
                ],
            )

            return {"count": len(scraped_items), "valid": True}
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _maybe_trigger_auto_replies(
    db: AsyncSession,
    *,
    account: KleinanzeigenAccount,
    conversation: Conversation,
    fresh_incoming: list[dict],
) -> None:
    """Enqueue SEND_MESSAGE jobs for any active rule that matches a new message.

    Match rules:
      - rule must belong to the account owner (user_id)
      - rule.account_id is either NULL (all accounts) or equals account.id
      - rule.is_active is True
      - case-insensitive substring match: trigger_text in message.body

    Each fresh incoming message can fire at most one auto-reply (the first
    matching rule in created_at-asc order) — keeps the inbox from flooding
    when a user wrote two overlapping rules.
    """
    if not fresh_incoming:
        return

    # Import locally to avoid widening the module-level dependency surface;
    # AutoReplyRule is already in app.models via __init__ re-export.
    from app.models import AutoReplyRule
    from app.services.jobs import enqueue_job as _enqueue_job
    from app.models import JobType as _JobType

    rules_result = await db.execute(
        select(AutoReplyRule).where(
            AutoReplyRule.user_id == account.user_id,
            AutoReplyRule.is_active.is_(True),
            (AutoReplyRule.account_id.is_(None)) | (AutoReplyRule.account_id == account.id),
        ).order_by(AutoReplyRule.created_at.asc())
    )
    rules = rules_result.scalars().all()
    if not rules:
        return

    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_reply_result = await db.execute(
        select(Job.id).where(
            Job.account_id == account.id,
            Job.type == _JobType.SEND_MESSAGE.value,
            Job.created_at >= cutoff,
            Job.payload.contains({
                "conversation_id": conversation.id,
                "auto_reply": True,
            }),
        ).limit(1)
    )
    if recent_reply_result.scalar_one_or_none() is not None:
        return

    for message in fresh_incoming:
        body = (message.get("body") or "").lower()
        if not body:
            continue
        if message.get("direction") != "incoming":
            continue
        sender_name = (message.get("sender_name") or "").strip().lower()
        if sender_name in {"du", "ich", "me", "self"}:
            continue
        for rule in rules:
            if (rule.trigger_text or "").lower() in body:
                await _enqueue_job(
                    db,
                    _JobType.SEND_MESSAGE,
                    account_id=account.id,
                    payload={
                        "conversation_id": conversation.id,
                        "kleinanzeigen_conversation_id": conversation.kleinanzeigen_id,
                        "body": rule.reply_text,
                        "auto_reply": True,
                    },
                    priority=4,
                    deduplicate=False,
                )
                return  # max one auto-reply per conversation per hour


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

            await publish_event(account.user_id, "conversation.updated", {
                "conversation_id": conversation.id,
                "account_id": account.id,
                "sent": True,
            })

            return {
                **result,
                "conversation_id": conversation.id,
                "valid": True,
            }
        finally:
            await session_manager.close_account(account.id, headless=True)


async def _update_scheduled_draft(
    db: AsyncSession,
    job: Job,
    *,
    status: str,
    error: str | None = None,
    posted_at: datetime | None = None,
) -> None:
    """Sync the auto-posting draft (if any) with the outcome of its CREATE_LISTING job."""
    scheduled_id = job.payload.get("scheduled_listing_id")
    if not scheduled_id:
        return
    from app.models import ScheduledListing
    result = await db.execute(select(ScheduledListing).where(ScheduledListing.id == scheduled_id))
    draft = result.scalar_one_or_none()
    if draft is None:
        return
    draft.status = status
    draft.error = error
    if posted_at is not None:
        draft.posted_at = posted_at
    db.add(draft)


async def _handle_create_listing(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    title = str(job.payload.get("title") or "").strip()
    if not title:
        raise JobError("Job payload is missing title", recoverable=False)

    description_value = job.payload.get("description")
    price_value = job.payload.get("price")
    category_id = str(job.payload.get("category_id") or "").strip() or None
    location_value = job.payload.get("location")

    description = str(description_value).strip() if description_value is not None else None
    price = str(price_value).strip() if price_value is not None else None
    location = str(location_value).strip() if location_value is not None else None

    async with session_manager.lock(job.account_id):
        account, page = await _get_authenticated_page(job=job, db=db, session_manager=session_manager)

        from app.scraper.pages.create_listing_page import CreateListingPage
        create_page = CreateListingPage(page)

        try:
            await create_page.open(category_id=category_id)

            if any(pattern in page.url for pattern in UrlPatterns.LOGIN_REQUIRED_PATTERNS):
                await _mark_session_expired(account, db, message="Session abgelaufen")
                # Put the auto-post draft back in the queue so it publishes
                # automatically after the user re-logs in.
                await _update_scheduled_draft(db, job, status="queued")
                await db.commit()
                return {"success": False, "valid": False}

            result = await create_page.create_listing(
                title=title,
                description=description,
                price=price,
                location=location,
            )

            now = datetime.now(timezone.utc)

            # If we got a new listing ID back, save a stub record
            new_ka_id = result.get("new_listing_id")
            if new_ka_id:
                new_listing = Listing(
                    account_id=account.id,
                    kleinanzeigen_id=new_ka_id,
                    title=title,
                    price=price,
                    description=description,
                    location=location,
                    is_active=True,
                    last_scraped_at=now,
                )
                db.add(new_listing)

            account.status = AccountStatus.ACTIVE.value
            account.last_error = None
            account.last_scraped_at = now
            await _update_scheduled_draft(db, job, status="posted", posted_at=now)
            await db.commit()

            await publish_event(account.user_id, "listing.created", {
                "account_id": account.id,
                "title": title,
                "kleinanzeigen_id": new_ka_id,
                "auto_post": bool(job.payload.get("auto_post")),
            })

            return {
                **result,
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


async def _handle_check_category(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any]:
    """Snapshot a Kleinanzeigen public search and push when new results appear.

    Payload: {"watch_id": int}. Reads CategoryWatch, navigates to the public
    search URL (no login required — uses a fresh anonymous Playwright context),
    extracts the visible listing IDs from search-result tiles, and diffs
    against watch.last_seen_listing_ids (a JSON-encoded list of strings).

    First run: just records the current snapshot, no push (otherwise the
    very first check would notify about every listing on the page).
    """
    import json as _json
    from app.models import CategoryWatch as _CategoryWatch, User as _User
    from app.scraper.selectors import LISTING_ID_REGEX as _LISTING_ID_REGEX

    watch_id_raw = job.payload.get("watch_id")
    if watch_id_raw is None:
        raise JobError("CHECK_CATEGORY payload is missing watch_id", recoverable=False)
    try:
        watch_id = int(watch_id_raw)
    except (TypeError, ValueError) as exc:
        raise JobError("CHECK_CATEGORY watch_id must be an integer", recoverable=False) from exc

    result = await db.execute(select(_CategoryWatch).where(_CategoryWatch.id == watch_id))
    watch = result.scalar_one_or_none()
    if watch is None:
        raise JobError(f"CategoryWatch {watch_id} not found", recoverable=False)
    if not watch.is_active:
        return {"skipped": True, "reason": "watch inactive"}

    from urllib.parse import quote
    search_url = f"https://www.kleinanzeigen.de/s-suchanfrage.html?keywords={quote(watch.search_query)}"

    # Anonymous browser context — public search does not need our session
    page = await session_manager.get_page(0, headless=True, storage_state=None, force_new=True)
    try:
        await page.goto(search_url, wait_until="domcontentloaded")
        await page.wait_for_selector("body", timeout=10000)

        anchors = await page.query_selector_all('a[href*="/s-anzeige/"]')
        seen_ids: list[str] = []
        for anchor in anchors:
            href = await anchor.get_attribute("href")
            if not href:
                continue
            match = _LISTING_ID_REGEX.search(href)
            if match is None:
                continue
            ka_id = match.group(1)
            if ka_id not in seen_ids:
                seen_ids.append(ka_id)
            if len(seen_ids) >= 30:
                break
    finally:
        await session_manager.close_account(0, headless=True)

    now = datetime.now(timezone.utc)
    previous_raw = watch.last_seen_listing_ids
    previous_ids: list[str] = []
    if previous_raw:
        try:
            parsed = _json.loads(previous_raw)
            if isinstance(parsed, list):
                previous_ids = [str(x) for x in parsed]
        except _json.JSONDecodeError:
            log.warning("CategoryWatch %s: previous snapshot JSON invalid, resetting", watch.id)

    new_ids = [i for i in seen_ids if i not in previous_ids] if previous_ids else []

    watch.last_seen_listing_ids = _json.dumps(seen_ids)
    watch.last_checked_at = now
    await db.commit()

    if new_ids and watch.notify_push:
        user_result = await db.execute(select(_User).where(_User.id == watch.user_id))
        user = user_result.scalar_one_or_none()
        if user is not None and getattr(user, "notify_push_new_message", True):
            try:
                await send_push_to_user(
                    db, user.id,
                    title=f"Neue Treffer fuer '{watch.search_query}'",
                    body=f"{len(new_ids)} neue{'r Treffer' if len(new_ids) == 1 else ' Treffer'} gefunden.",
                    url="/watches",
                )
            except Exception as exc:
                log.warning("CategoryWatch push failed for watch %s: %s", watch.id, exc)

    return {"seen": len(seen_ids), "new": len(new_ids), "first_run": not previous_ids}


HANDLERS = {
    JobType.START_LOGIN.value: _handle_start_login,
    JobType.SCRAPE_LISTINGS.value: _handle_scrape_listings,
    JobType.SCRAPE_LISTING_DETAIL.value: _handle_scrape_listing_detail,
    JobType.SCRAPE_MESSAGES.value: _handle_scrape_messages,
    JobType.SCRAPE_CONVERSATION.value: _handle_scrape_conversation,
    JobType.SEND_MESSAGE.value: _handle_send_message,
    JobType.CREATE_LISTING.value: _handle_create_listing,
    JobType.UPDATE_LISTING.value: _handle_update_listing,
    JobType.DELETE_LISTING.value: _handle_delete_listing,
    JobType.BUMP_LISTING.value: _handle_bump_listing,
    JobType.VERIFY_SESSION.value: _handle_verify_session,
    JobType.CHECK_CATEGORY.value: _handle_check_category,
}


async def dispatch_job(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any] | None:
    handler = HANDLERS.get(job.type)
    if handler is None:
        raise JobError(f"Unknown job type: {job.type}", recoverable=False)
    log.info("Dispatching job %s (type=%s, attempt=%s)", job.id, job.type, job.attempts)
    return await handler(job, db, session_manager)
