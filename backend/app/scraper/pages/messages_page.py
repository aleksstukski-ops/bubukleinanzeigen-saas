import re
from datetime import datetime, timezone

from playwright.async_api import Frame, Page

from app.models.domain import Conversation
from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns


class MessagesPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.messages")

    async def open(self) -> None:
        await self.page.goto(UrlPatterns.MESSAGES_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()

    async def get_messages_frame(self) -> Frame | Page:
        """Return the messages content frame, or self.page if no iframe is present.

        Kleinanzeigen historically used an iframe for the messages view but has
        migrated to a direct DOM approach.  We try the iframe selectors first;
        if none resolves to a real frame we fall back to the page itself.
        """
        for selector in Selectors.MESSAGES_IFRAME:
            iframe_element = await self.page.query_selector(selector)
            if iframe_element is not None:
                frame = await iframe_element.content_frame()
                if frame is not None:
                    self.log.info("Found messages iframe via selector: %s", selector)
                    return frame

        self.log.warning(
            "No messages iframe found — falling back to direct page DOM"
        )
        return self.page

    async def scrape_conversations(self) -> list[dict]:
        frame = await self.get_messages_frame()

        # Wait for the conversation list container or items to appear
        container_selector = await self._wait_for_conversation_list(frame)
        if container_selector is None:
            self.log.warning("scrape_conversations: conversation list not found")
            return []

        # Find all conversation article elements
        items = await frame.query_selector_all(Selectors.CONVERSATION_LIST_ITEM_ARTICLE)
        if not items:
            # Fallback to broader selector
            items = await frame.query_selector_all(Selectors.CONVERSATION_LIST_ITEM_FALLBACK)

        conversations = []
        for item in items:
            conversation_id = await self._extract_conversation_id(item)
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

    async def _wait_for_conversation_list(self, frame: Frame | Page, timeout: int = 20000) -> str | None:
        """Wait for the conversation list to load. Returns matched selector or None."""
        selectors = Selectors.CONVERSATION_CONTAINER + Selectors.CONVERSATION_LIST_ITEM_ARTICLE_SELECTOR
        last_error = None
        for selector in selectors:
            try:
                await frame.wait_for_selector(selector, timeout=timeout)
                return selector
            except Exception as error:
                last_error = error
        if last_error:
            # Take a debug screenshot
            try:
                screenshot_path = "/app/storage/sessions/messages_debug.png"
                await self.page.screenshot(path=screenshot_path, full_page=False)
                self.log.error(
                    "scrape_conversations: conversation list not found "
                    "(screenshot: %s): %s",
                    screenshot_path,
                    last_error,
                )
            except Exception:
                self.log.error("scrape_conversations: conversation list not found: %s", last_error)
        return None

    async def _extract_conversation_id(self, article) -> str | None:
        """Extract a unique conversation ID from an article element.

        Strategy 1: data-testid on the checkbox input (new SPA DOM).
        Strategy 2: href containing conversationId (old iframe DOM).
        """
        # Strategy 1: checkbox data-testid (new DOM as of 2026-04)
        checkbox = await article.query_selector('input[type="checkbox"][data-testid]')
        if checkbox is not None:
            testid = await checkbox.get_attribute("data-testid")
            if testid:
                return testid.strip()

        # Strategy 2: anchor href (old DOM)
        for selector in Selectors.CONVERSATION_LINK:
            link = await article.query_selector(selector)
            if link is not None:
                href = await link.get_attribute("href")
                if href and "conversationId=" in href:
                    from app.scraper.selectors import extract_conversation_id_from_href
                    cid = extract_conversation_id_from_href(href)
                    if cid:
                        return cid

        return None

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
