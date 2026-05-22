import asyncio
import hashlib
from datetime import datetime, timezone

from playwright.async_api import Frame, Page, TimeoutError as PlaywrightTimeoutError

from app.models.domain import Message
from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns


class ConversationPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.conversation")

    async def open(self, conversation_id: str) -> None:
        """Navigate to the specified conversation.

        Strategy 1: direct URL with conversationId param (works for numeric IDs).
        Strategy 2: navigate to the list and click the matching conversation item
                    (required for the new data-testid ID format like 'lnjz:1s2bvvw:2p77kc1cg').
        """
        # Try direct URL first (works if the ID is a legacy numeric conversation ID)
        direct_url = f"{UrlPatterns.MESSAGES_URL}?conversationId={conversation_id}"
        await self.page.goto(direct_url, wait_until="domcontentloaded")
        await self.wait_until_ready()

        # Check if messages loaded — if there's a message in the right panel we are done
        messages_loaded = await self._is_conversation_open()
        if messages_loaded:
            self.log.info("Opened conversation via direct URL: %s", conversation_id)
            return

        # Fallback: navigate to messages list and click the conversation
        self.log.info(
            "Direct URL did not open conversation; trying click-based navigation for %s",
            conversation_id,
        )
        await self.page.goto(UrlPatterns.MESSAGES_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()
        await self._click_conversation_item(conversation_id)

    async def _is_conversation_open(self) -> bool:
        """Return True if the right-side conversation panel has messages loaded."""
        try:
            await self.page.wait_for_selector(
                Selectors.CONVERSATION_MESSAGE_ROW_SELECTOR,
                timeout=5000,
            )
            return True
        except Exception:
            return False

    async def _click_conversation_item(self, conversation_id: str) -> None:
        """Find the conversation in the list by its kleinanzeigen_id and click it."""
        # Wait for conversation list to be ready
        try:
            await self.page.wait_for_selector(
                Selectors.CONVERSATION_CONTAINER[0], timeout=15000
            )
        except Exception:
            self.log.warning("Conversation list not ready for click navigation")
            return

        # Find the checkbox whose data-testid matches the conversation_id
        # CSS attribute selectors support colon characters in quoted values
        checkbox = await self.page.query_selector(
            f'input[data-testid="{conversation_id}"]'
        )
        if checkbox is None:
            self.log.warning(
                "Could not find conversation item for id=%s — using default",
                conversation_id,
            )
            return

        # Click the parent article element
        article = await checkbox.evaluate_handle(
            "node => node.closest('article')"
        )
        if article:
            await article.click()
            try:
                await self.page.wait_for_selector(
                    Selectors.CONVERSATION_MESSAGE_ROW_SELECTOR, timeout=10000
                )
            except Exception:
                self.log.warning("Messages did not load after clicking conversation")

    async def scrape_messages(self) -> list[dict]:
        """Scrape all messages from the currently open conversation."""
        frame = await self.get_messages_frame()

        # Wait for at least one message to be present
        try:
            await self._wait_for_frame_selector(
                frame, Selectors.CONVERSATION_MESSAGE_ROW, timeout=15000
            )
        except Exception as exc:
            try:
                path = "/app/storage/sessions/conversation_debug.png"
                await self.page.screenshot(path=path, full_page=False)
                self.log.warning(
                    "No messages found in conversation (screenshot: %s): %s", path, exc
                )
            except Exception:
                self.log.warning("No messages found in conversation: %s", exc)
            return []

        items = await frame.query_selector_all(Selectors.CONVERSATION_MESSAGE_ROW_SELECTOR)

        messages = []
        for index, item in enumerate(items):
            body = await self.try_text(item, Selectors.CONVERSATION_MESSAGE_BODY)
            if not body:
                continue

            meta = await self.try_text(item, Selectors.CONVERSATION_MESSAGE_META)
            outgoing_marker = await self.try_selectors(item, Selectors.CONVERSATION_MESSAGE_OUTGOING)
            direction = "outgoing" if outgoing_marker is not None else "incoming"
            message_id = self._build_message_id(index=index, body=body, meta=meta, direction=direction)

            messages.append(
                {
                    "kleinanzeigen_id": message_id,
                    "direction": direction,
                    "sender_name": "Du" if direction == "outgoing" else None,
                    "body": body,
                    "sent_at": datetime.now(timezone.utc),
                    "is_read": direction == "outgoing",
                }
            )

        return messages

    async def get_messages_frame(self) -> Frame | Page:
        """Return the messages content frame, or self.page if no iframe is present."""
        for selector in Selectors.MESSAGES_IFRAME:
            iframe_element = await self.page.query_selector(selector)
            if iframe_element is not None:
                frame = await iframe_element.content_frame()
                if frame is not None:
                    self.log.info("Found messages iframe via selector: %s", selector)
                    return frame
        return self.page

    async def send_message(self, body: str) -> dict:
        """Type and submit a reply, then verify the submission actually went through.

        Kleinanzeigen clears the reply textarea on a successful POST. We use
        that as the success signal — if the textarea still contains the body
        after a short wait, the submit silently failed (validation, rate limit,
        network blip) and we raise ValueError so the worker can retry.
        """
        frame = await self.get_messages_frame()

        textarea_selector = await self._wait_for_frame_selector(
            frame, Selectors.CONVERSATION_REPLY_TEXTAREA, timeout=10000
        )
        textarea = await frame.query_selector(textarea_selector)
        if textarea is None:
            raise ValueError("Reply textarea not found")

        await textarea.click()
        await textarea.fill("")
        await textarea.fill(body)

        # Re-fetch submit element AFTER filling — React-style SPAs may have
        # re-rendered the button (enabling it because input is non-empty);
        # the handle we grabbed before fill() can be a detached node.
        submit_selector = await self._wait_for_frame_selector(
            frame, Selectors.CONVERSATION_REPLY_SUBMIT, timeout=10000
        )
        submit = await frame.query_selector(submit_selector)
        if submit is None:
            raise ValueError("Reply submit button not found")
        await submit.click()

        # Persistent SPA socket means networkidle never resolves — bound it.
        try:
            await self.page.wait_for_load_state("networkidle", timeout=8000)
        except PlaywrightTimeoutError:
            self.log.debug("send_message: networkidle timeout, continuing")

        # Success verification: poll the textarea up to ~3 s; Kleinanzeigen
        # clears it on a successful send. If it is still populated, treat as
        # failure so the job retries instead of marking it shipped.
        cleared = False
        for _ in range(15):
            try:
                current_value = await textarea.input_value()
            except Exception:
                # Element was detached — common on success because the form re-renders.
                cleared = True
                break
            if (current_value or "").strip() == "":
                cleared = True
                break
            await self.page.wait_for_timeout(200)

        if not cleared:
            raise ValueError(
                "Reply textarea still contains the message after submit — "
                "send likely failed (validation/rate-limit/network)."
            )

        return {"success": True, "body": body}

    @staticmethod
    def apply_message_snapshot(
        existing_by_ka_id: dict[str, Message],
        scraped_items: list[dict],
        *,
        conversation_id: int,
    ) -> tuple[list[Message], set[str]]:
        seen_ids = set()
        created_or_updated = []

        for item in scraped_items:
            ka_id = item["kleinanzeigen_id"]
            seen_ids.add(ka_id)

            record = existing_by_ka_id.get(ka_id)
            if record is None:
                record = Message(
                    conversation_id=conversation_id,
                    kleinanzeigen_id=ka_id,
                    direction=item["direction"],
                    body=item["body"],
                )

            record.direction = item["direction"]
            record.sender_name = item.get("sender_name")
            record.body = item["body"]
            record.sent_at = item.get("sent_at")
            record.is_read = bool(item.get("is_read", False))
            created_or_updated.append(record)

        return created_or_updated, seen_ids

    async def _wait_for_frame_selector(
        self,
        frame: Frame | Page,
        selectors: list[str],
        *,
        timeout: int = 10000,
    ) -> str:
        """Race a fallback selector list in parallel.

        The previous sequential approach blocked up to timeout*N when no
        selector matched (60s for 6 fallbacks at 10s each). Now total wait
        equals a single selector timeout.
        """
        selector_list = list(selectors)
        if not selector_list:
            raise ValueError("selectors must not be empty")

        if len(selector_list) == 1:
            await frame.wait_for_selector(selector_list[0], timeout=timeout)
            return selector_list[0]

        async def _try(sel: str) -> str:
            await frame.wait_for_selector(sel, timeout=timeout)
            return sel

        tasks = [asyncio.create_task(_try(sel)) for sel in selector_list]
        winner: str | None = None
        try:
            done, _ = await asyncio.wait(
                tasks,
                return_when=asyncio.FIRST_COMPLETED,
                timeout=timeout / 1000,
            )
            for task in done:
                if not task.cancelled() and task.exception() is None:
                    winner = task.result()
                    break
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*[t for t in tasks if not t.done()], return_exceptions=True)

        if winner is None:
            raise PlaywrightTimeoutError(
                f"None of the frame selectors matched within timeout: {selector_list}"
            )
        if selector_list.index(winner) > 0:
            self.log.warning("Frame selector fallback hit: %s", winner)
        return winner

    @staticmethod
    def _build_message_id(*, index: int, body: str, meta: str | None, direction: str) -> str:
        base = f"{direction}|{meta or ''}|{body}|{index}"
        return hashlib.sha1(base.encode("utf-8")).hexdigest()[:24]
