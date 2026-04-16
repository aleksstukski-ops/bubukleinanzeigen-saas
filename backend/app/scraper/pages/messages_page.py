import re
from datetime import datetime, timezone

from playwright.async_api import Frame, FrameLocator, Page

from app.models.domain import Conversation
from app.scraper.pages.base import BasePage
from app.scraper.selectors import (
    Selectors,
    UrlPatterns,
    extract_conversation_id_from_href,
)


class MessagesPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.messages")

    async def open(self) -> None:
        await self.page.goto(UrlPatterns.MESSAGES_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()

    async def get_messages_frame(self) -> Frame | FrameLocator:
        for selector in Selectors.MESSAGES_IFRAME:
            iframe_element = await self.page.query_selector(selector)
            if iframe_element is not None:
                frame = await iframe_element.content_frame()
                if frame is not None:
                    return frame
        return self.page.frame_locator(Selectors.MESSAGES_IFRAME[0])

    async def scrape_conversations(self) -> list[dict]:
        frame = await self.get_messages_frame()
        item_selector = await self._wait_for_frame_selector(frame, Selectors.CONVERSATION_LIST_ITEM)
        items = await self._query_frame_all(frame, item_selector)

        conversations = []
        for item in items:
            link_handle = await self.try_selectors(item, Selectors.CONVERSATION_LINK)
            if link_handle is None:
                continue

            href = await link_handle.get_attribute("href")
            conversation_id = extract_conversation_id_from_href(href)
            if not conversation_id:
                continue

            unread_text = await self.try_text(item, Selectors.CONVERSATION_UNREAD)
            conversations.append(
                {
                    "kleinanzeigen_id": conversation_id,
                    "partner_name": await self.try_text(item, Selectors.CONVERSATION_PARTNER),
                    "subject": await self.try_text(item, Selectors.CONVERSATION_SUBJECT),
                    "last_message_preview": await self.try_text(item, Selectors.CONVERSATION_PREVIEW),
                    "last_message_at": datetime.now(timezone.utc),
                    "unread_count": self._parse_unread_count(unread_text),
                }
            )

        return conversations

    @staticmethod
    def apply_conversation_snapshot(
        existing_by_ka_id: dict[str, Conversation],
        scraped_items: list[dict],
        *,
        account_id: int,
    ) -> tuple[list[Conversation], set[str]]:
        now = datetime.now(timezone.utc)
        seen_ids = set()
        created_or_updated = []

        for item in scraped_items:
            ka_id = item["kleinanzeigen_id"]
            seen_ids.add(ka_id)

            record = existing_by_ka_id.get(ka_id)
            if record is None:
                record = Conversation(
                    account_id=account_id,
                    kleinanzeigen_id=ka_id,
                )

            record.partner_name = item.get("partner_name")
            record.subject = item.get("subject")
            record.last_message_preview = item.get("last_message_preview")
            record.last_message_at = item.get("last_message_at") or now
            record.unread_count = int(item.get("unread_count") or 0)
            record.is_archived = False
            record.last_scraped_at = now
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
    def _parse_unread_count(text: str | None) -> int:
        if not text:
            return 0
        match = re.search(r"(\d+)", text.replace(".", ""))
        if match is None:
            return 0
        try:
            return int(match.group(1))
        except ValueError:
            return 0
