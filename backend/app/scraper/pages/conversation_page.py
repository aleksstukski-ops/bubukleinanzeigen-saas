import hashlib
from datetime import datetime, timezone

from playwright.async_api import Frame, FrameLocator, Page

from app.models.domain import Message
from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns


class ConversationPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.conversation")

    async def open(self, conversation_id: str) -> None:
        await self.page.goto(
            f"{UrlPatterns.MESSAGES_URL}?conversationId={conversation_id}",
            wait_until="domcontentloaded",
        )
        await self.wait_until_ready()

    async def get_messages_frame(self) -> Frame | FrameLocator:
        for selector in Selectors.MESSAGES_IFRAME:
            iframe_element = await self.page.query_selector(selector)
            if iframe_element is not None:
                frame = await iframe_element.content_frame()
                if frame is not None:
                    return frame
        return self.page.frame_locator(Selectors.MESSAGES_IFRAME[0])

    async def scrape_messages(self) -> list[dict]:
        frame = await self.get_messages_frame()
        item_selector = await self._wait_for_frame_selector(frame, Selectors.CONVERSATION_MESSAGE_ROW)
        items = await self._query_frame_all(frame, item_selector)

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

    async def send_message(self, body: str) -> dict:
        frame = await self.get_messages_frame()
        textarea_selector = await self._wait_for_frame_selector(frame, Selectors.CONVERSATION_REPLY_TEXTAREA)
        submit_selector = await self._wait_for_frame_selector(frame, Selectors.CONVERSATION_REPLY_SUBMIT)

        if isinstance(frame, FrameLocator):
            textarea = frame.locator(textarea_selector).first
            submit = frame.locator(submit_selector).first
            await textarea.click()
            await textarea.fill("")
            await textarea.fill(body)
            await submit.click()
        else:
            textarea = await frame.query_selector(textarea_selector)
            submit = await frame.query_selector(submit_selector)
            if textarea is None or submit is None:
                raise ValueError("Reply form not found")
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

    async def _wait_for_frame_selector(self, frame: Frame | FrameLocator, selectors: list[str]) -> str:
        last_error = None
        for selector in selectors:
            try:
                if isinstance(frame, FrameLocator):
                    await frame.locator(selector).first.wait_for(timeout=10000)
                else:
                    await frame.wait_for_selector(selector, timeout=10000)
                return selector
            except Exception as error:
                last_error = error
        if last_error is not None:
            raise last_error
        raise ValueError("No frame selector matched")

    async def _query_frame_all(self, frame: Frame | FrameLocator, selector: str):
        if isinstance(frame, FrameLocator):
            locator = frame.locator(selector)
            count = await locator.count()
            return [locator.nth(index) for index in range(count)]
        return await frame.query_selector_all(selector)

    @staticmethod
    def _build_message_id(*, index: int, body: str, meta: str | None, direction: str) -> str:
        base = f"{direction}|{meta or ''}|{body}|{index}"
        return hashlib.sha1(base.encode("utf-8")).hexdigest()[:24]
