import hashlib
from datetime import datetime, timezone

from playwright.async_api import Frame, Page

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
        """Type and submit a reply in the currently open conversation."""
        frame = await self.get_messages_frame()

        textarea_selector = await self._wait_for_frame_selector(
            frame, Selectors.CONVERSATION_REPLY_TEXTAREA, timeout=10000
        )
        submit_selector = await self._wait_for_frame_selector(
            frame, Selectors.CONVERSATION_REPLY_SUBMIT, timeout=10000
        )

        textarea = await frame.query_selector(textarea_selector)
        submit = await frame.query_selector(submit_selector)
        if textarea is None or submit is None:
            raise ValueError("Reply form elements not found")

        await textarea.click()
        await textarea.fill("")
        await textarea.fill(body)
        await submit.click()
        await self.page.wait_for_load_state("networkidle")

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
        last_error = None
        for selector in selectors:
            try:
                await frame.wait_for_selector(selector, timeout=timeout)
                return selector
            except Exception as error:
                last_error = error
        if last_error is not None:
            raise last_error
        raise ValueError("No frame selector matched")

    @staticmethod
    def _build_message_id(*, index: int, body: str, meta: str | None, direction: str) -> str:
        base = f"{direction}|{meta or ''}|{body}|{index}"
        return hashlib.sha1(base.encode("utf-8")).hexdigest()[:24]
