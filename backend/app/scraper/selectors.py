import re
from urllib.parse import parse_qs, urlparse


LISTING_ID_REGEX = re.compile(r"/(\d{9,})-")


class Selectors:
    AD_LIST_ITEM = [
        "article.aditem",
        "[data-adid]",
        "li.ad-listitem",
    ]

    AD_LINK = [
        'a[href*="/s-anzeige/"]',
    ]

    AD_TITLE = [
        # Currently matching on live DOM (2026-04-21):
        '[class*="title"] a',
        'li[class*="title"] a',
        # Fallbacks for older/alternate DOM:
        "h2 a",
        "a.ellipsis",
        'article a[href*="/s-anzeige/"]',
    ]

    AD_PRICE = [
        # Currently matching on live DOM (2026-04-21):
        "li.text-title3.text-secondary",
        'li[class*="text-title3"]',
        # Fallbacks for older/alternate DOM:
        ".aditem-main--middle--price-shipping--price",
        '[class*="price-shipping"] span',
        '[class*="price"]',
    ]

    AD_IMAGE = [
        ("img[srcset]", "srcset"),
        ("img[data-srcset]", "data-srcset"),
        ("img[data-src]", "data-src"),
        ("img", "src"),
    ]

    AD_VIEWS = [
        'section.text-onSurfaceNonessential',
        'section[class*="text-bodySmall"][class*="Nonessential"]',
        '.aditem-main--bottom [class*="views"]',
        '[class*="counter-value"]',
    ]

    LOGGED_IN_MARKER = [
        'a[href*="/m-meine-anzeigen"]',
    ]

    LOGIN_REQUIRED_MARKER = [
        "form#login-form",
        'input[name="loginMail"]',
    ]

    LOGIN_USER_NAME = [
        '[data-testid="user-name"]',
        '[class*="user-name"]',
        '[class*="profile-name"]',
        'header a[href*="/m-profil.html"]',
    ]

    PAGE_READY = [
        "body",
    ]

    LISTING_ACTION_MENU_BUTTON = [
        '[data-testid="vip-actions-dropdown-button"]',
        'button[aria-controls*="dropdown"]',
        'button[aria-label*="Option"]',
        'button[aria-label*="Mehr"]',
        'button[title*="Option"]',
    ]

    LISTING_EDIT_LINK = [
        'a[href*="/bearbeiten"]',
        'a[href*="edit"]',
        'a[href*="/m-anzeige-bearbeiten"]',
    ]

    LISTING_DELETE_BUTTON = [
        'button[data-testid*="delete"]',
        'button[aria-label*="Löschen"]',
        'button:has-text("Löschen")',
        'a:has-text("Löschen")',
    ]

    LISTING_BUMP_BUTTON = [
        'button[data-testid*="push"]',
        'button[aria-label*="Hochschieben"]',
        'button:has-text("Hochschieben")',
        'a:has-text("Hochschieben")',
        'button:has-text("Wieder nach oben")',
    ]

    LISTING_DELETE_CONFIRM_BUTTON = [
        'button[data-testid*="confirm-delete"]',
        'button:has-text("Ja, löschen")',
        'button:has-text("Löschen")',
        'button:has-text("Bestätigen")',
    ]

    EDIT_FORM = [
        "form",
        '[data-testid*="edit-form"]',
    ]

    EDIT_TITLE_INPUT = [
        'input[name="title"]',
        'input[name="ad-title"]',
        'input[id*="title"]',
        'input[placeholder*="Titel"]',
    ]

    EDIT_PRICE_INPUT = [
        'input[name="price"]',
        'input[name="ad-price"]',
        'input[id*="price"]',
        'input[inputmode="numeric"]',
    ]

    EDIT_DESCRIPTION_INPUT = [
        'textarea[name="description"]',
        'textarea[id*="description"]',
        'textarea[placeholder*="Beschreibung"]',
    ]

    EDIT_SUBMIT_BUTTON = [
        'button[type="submit"]',
        'button:has-text("Speichern")',
        'button:has-text("Änderungen speichern")',
        'button:has-text("Weiter")',
    ]

    EDIT_SUCCESS_MARKER = [
        'text="Änderungen gespeichert"',
        'text="Anzeige wurde gespeichert"',
        'text="Deine Anzeige ist online"',
    ]

    MESSAGES_IFRAME = [
        'iframe[src*="m-messages"]',
        'iframe[name="messages"]',
        'iframe[src*="messages"]',
        'iframe[src*="nachrichten"]',
    ]

    # Container selector to confirm the conversation list has loaded
    CONVERSATION_CONTAINER = [
        '[data-testid="conversation-list"]',
        '[id="conversation-list"]',
        '[class*="ConversationList"]',
    ]

    # Selector for individual conversation item articles (new SPA DOM, 2026-04)
    CONVERSATION_LIST_ITEM_ARTICLE = 'article[class*="ConversationListItem"]'
    CONVERSATION_LIST_ITEM_ARTICLE_SELECTOR = [
        'article[class*="ConversationListItem"]',
        '[class*="ConversationListItem"]',
    ]

    # Fallback when article selector doesn't match
    CONVERSATION_LIST_ITEM_FALLBACK = 'a[href*="conversationId="]'

    # Legacy list — kept for backwards compatibility
    CONVERSATION_LIST_ITEM = [
        '[data-testid="conversation-list"]',
        'article[class*="ConversationListItem"]',
        '[class*="ConversationListItem"]',
        '[class*="conversation-list-item"]',
        'a[href*="conversationId="]',
    ]

    CONVERSATION_LINK = [
        'a[href*="conversationId="]',
        'a[href*="conversation"]',
    ]

    CONVERSATION_PARTNER = [
        # New SPA DOM (2026-04): partner name is first span inside the first header
        'header span span',
        'header > span > span',
        '[data-testid*="partner"]',
        '[class*="partner"]',
        '[class*="name"]',
        "h2",
    ]

    CONVERSATION_SUBJECT = [
        # New SPA DOM: subject/listing title is in h3
        'h3',
        '[data-testid*="subject"]',
        '[class*="subject"]',
        '[class*="title"]',
    ]

    CONVERSATION_PREVIEW = [
        # New SPA DOM: preview is in .truncate.text-onSurfaceSubdued > span
        '.truncate.text-onSurfaceSubdued span',
        '.truncate.text-onSurfaceSubdued',
        '[data-testid*="preview"]',
        '[class*="preview"]',
        '[class*="snippet"]',
    ]

    CONVERSATION_UNREAD = [
        '[data-testid*="unread"]',
        '[class*="unread"]',
        '[class*="badge"]',
        '[class*="UnreadBadge"]',
    ]

    # Selector string used for waiting / query_selector_all (single selector, not list)
    # New SPA DOM (2026-04): message rows are <li data-testid="UUID">
    CONVERSATION_MESSAGE_ROW_SELECTOR = 'li[data-testid]'

    CONVERSATION_MESSAGE_ROW = [
        # New SPA DOM (2026-04): each message is a <li> with a UUID data-testid
        'li[data-testid]',
        # Legacy selectors
        '[data-testid*="message"]',
        '[class*="message-item"]',
        '[class*="chat-message"]',
    ]

    CONVERSATION_MESSAGE_BODY = [
        # New SPA DOM: message text container
        '[class*="Message--Text"]',
        '[class*="Message-outbound"] [class*="Message--Text"]',
        # Legacy selectors
        '[data-testid*="message-body"]',
        '[class*="message-body"]',
        '[class*="bubble"]',
    ]

    CONVERSATION_MESSAGE_META = [
        # New SPA DOM: date/time for a message
        '[class*="MessageListItem-Date"]',
        '[class*="MessageListItem--Date"]',
        # Legacy selectors
        '[data-testid*="message-meta"]',
        '[class*="message-meta"]',
        "time",
    ]

    CONVERSATION_MESSAGE_OUTGOING = [
        # New SPA DOM: outgoing messages have data-testid="OUTBOUND" inside
        '[data-testid="OUTBOUND"]',
        '[class*="MessageListItem-outbound"]',
        # Legacy selectors
        '[data-testid*="outgoing"]',
        '[class*="outgoing"]',
        '[class*="sent"]',
    ]

    CONVERSATION_REPLY_TEXTAREA = [
        # New SPA DOM: reply textarea has id="nachricht"
        'textarea#nachricht',
        'textarea[id="nachricht"]',
        # Legacy selectors
        'textarea[name="reply"]',
        'textarea[placeholder*="Antwort"]',
        'textarea[placeholder*="Nachricht"]',
        "textarea",
    ]

    CONVERSATION_REPLY_SUBMIT = [
        # New SPA DOM: send button
        'button[data-testid="submit-button"][aria-label="Senden"]',
        'button[data-testid="submit-button"]',
        'button[aria-label="Senden"]',
        # Legacy selectors
        'button[type="submit"]',
    ]


    # Create listing form selectors
    # NOTE: Kleinanzeigen uses a multi-step category wizard before showing the form.
    # Bypass it by passing categoryId= in the URL (see CREATE_LISTING_WITH_CATEGORY_URL).
    # Selectors verified patterns first, then generic fallbacks.
    CREATE_TITLE_INPUT = [
        'input[name="title"]',
        'input[data-testid*="title"]',
        'input[id*="title"]',
        'input[aria-label*="Titel"]',
        'input[placeholder*="Titel"]',
        '#ad-title',
        # Last resort: first visible text input in the form
        'form input[type="text"]:first-of-type',
    ]

    CREATE_DESCRIPTION_INPUT = [
        'textarea[name="description"]',
        'textarea[data-testid*="description"]',
        'textarea[id*="description"]',
        'textarea[aria-label*="Beschreibung"]',
        'textarea[placeholder*="Beschreibung"]',
        '#ad-description',
        'form textarea',
    ]

    CREATE_PRICE_INPUT = [
        'input[name="price"]',
        'input[data-testid*="price"]',
        'input[id*="price"]',
        'input[aria-label*="Preis"]',
        'input[inputmode="numeric"]',
        '#ad-price',
    ]

    CREATE_SUBMIT_BUTTON = [
        'button[type="submit"][data-testid*="submit"]',
        'button[data-testid*="post-ad"]',
        'button[type="submit"]:has-text("Anzeige aufgeben")',
        'button[type="submit"]:has-text("Jetzt einstellen")',
        'button[type="submit"]:has-text("Veröffentlichen")',
        'button[type="submit"]:has-text("Weiter")',
        'button[type="submit"]',
    ]

    CREATE_SUCCESS_MARKER = [
        'text="Anzeige wurde eingestellt"',
        'text="Deine Anzeige ist online"',
        'text="erfolgreich eingestellt"',
        '[class*="success"]',
        '[data-testid*="success"]',
    ]


class UrlPatterns:
    LOGIN_URL = "https://www.kleinanzeigen.de/m-einloggen.html"
    MY_ADS_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html?tab=ADS"
    MY_ADS_BASE_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html"
    CREATE_LISTING_URL = "https://www.kleinanzeigen.de/m-anzeige-aufgeben.html"
    CREATE_LISTING_WITH_CATEGORY_URL = "https://www.kleinanzeigen.de/m-anzeige-aufgeben.html?categoryId={category_id}"
    EDIT_LISTING_URL_TEMPLATE = "https://www.kleinanzeigen.de/m-anzeige-bearbeiten.html?adId={listing_id}"
    MESSAGES_URL = "https://www.kleinanzeigen.de/m-nachrichten.html"

    LOGIN_SUCCESS_PATTERNS = [
        "/m-meine-anzeigen.html",
        "/m-meine-anzeigen/",
    ]

    LOGIN_REQUIRED_PATTERNS = [
        "/m-einloggen.html",
        "/login",
    ]


def extract_listing_id_from_href(href: str | None) -> str | None:
    if not href:
        return None
    match = LISTING_ID_REGEX.search(href)
    if match is None:
        return None
    return match.group(1)


def extract_conversation_id_from_href(href: str | None) -> str | None:
    if not href:
        return None
    parsed = urlparse(href)
    query_params = parse_qs(parsed.query)
    conversation_ids = query_params.get("conversationId") or query_params.get("conversationid")
    if not conversation_ids:
        return None
    value = str(conversation_ids[0]).strip()
    return value or None
