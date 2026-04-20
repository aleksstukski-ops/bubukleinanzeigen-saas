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
        "h2 a",
        "a.ellipsis",
        '[class*="title"] a',
    ]

    AD_PRICE = [
        ".aditem-main--middle--price-shipping--price",
        '[class*="price"]',
        "li.text-title3.text-secondary",
        'li[class*="text-title3"]',
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
    ]

    CONVERSATION_LIST_ITEM = [
        '[data-testid*="conversation"]',
        '[class*="conversation-list-item"]',
        'a[href*="conversationId="]',
    ]

    CONVERSATION_LINK = [
        'a[href*="conversationId="]',
    ]

    CONVERSATION_PARTNER = [
        '[data-testid*="partner"]',
        '[class*="partner"]',
        '[class*="name"]',
        "h2",
        "h3",
    ]

    CONVERSATION_SUBJECT = [
        '[data-testid*="subject"]',
        '[class*="subject"]',
        '[class*="title"]',
    ]

    CONVERSATION_PREVIEW = [
        '[data-testid*="preview"]',
        '[class*="preview"]',
        '[class*="snippet"]',
        "p",
    ]

    CONVERSATION_UNREAD = [
        '[data-testid*="unread"]',
        '[class*="unread"]',
        '[class*="badge"]',
    ]

    CONVERSATION_MESSAGE_ROW = [
        '[data-testid*="message"]',
        '[class*="message-item"]',
        '[class*="chat-message"]',
    ]

    CONVERSATION_MESSAGE_BODY = [
        '[data-testid*="message-body"]',
        '[class*="message-body"]',
        '[class*="bubble"]',
        "p",
    ]

    CONVERSATION_MESSAGE_META = [
        '[data-testid*="message-meta"]',
        '[class*="message-meta"]',
        "time",
    ]

    CONVERSATION_MESSAGE_OUTGOING = [
        '[data-testid*="outgoing"]',
        '[class*="outgoing"]',
        '[class*="sent"]',
    ]

    CONVERSATION_REPLY_TEXTAREA = [
        'textarea[name="reply"]',
        'textarea[placeholder*="Antwort"]',
        'textarea[placeholder*="Nachricht"]',
        "textarea",
    ]

    CONVERSATION_REPLY_SUBMIT = [
        'button[type="submit"]',
        'button:has-text("Senden")',
        'button:has-text("Antworten")',
    ]


    # Create listing form selectors (best-guess, verify against live DOM if needed)
    CREATE_TITLE_INPUT = [
        'input[name="title"]',
        'input[id*="title"]',
        'input[placeholder*="Titel"]',
        '#ad-title',
    ]

    CREATE_DESCRIPTION_INPUT = [
        'textarea[name="description"]',
        'textarea[id*="description"]',
        'textarea[placeholder*="Beschreibung"]',
        '#ad-description',
    ]

    CREATE_PRICE_INPUT = [
        'input[name="price"]',
        'input[id*="price"]',
        'input[inputmode="numeric"]',
        '#ad-price',
    ]

    CREATE_SUBMIT_BUTTON = [
        'button[type="submit"][data-testid*="submit"]',
        'button[type="submit"]:has-text("Anzeige aufgeben")',
        'button[type="submit"]:has-text("Jetzt einstellen")',
        'button[type="submit"]:has-text("Veröffentlichen")',
        'button[type="submit"]',
    ]

    CREATE_SUCCESS_MARKER = [
        'text="Anzeige wurde eingestellt"',
        'text="Deine Anzeige ist online"',
        'text="erfolgreich eingestellt"',
        '[class*="success"]',
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
