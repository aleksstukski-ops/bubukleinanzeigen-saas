import base64
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models import User
from app.schemas.resources import AiCreateListingIn

router = APIRouter(prefix="/listings", tags=["ai-listings"])


class AiListingSuggestionOut(BaseModel):
    title: str
    description: str
    price: str
    category: str


def _build_placeholder_suggestion(
    *,
    file_names: list[str],
    title: str,
    description: str,
    price: str,
    category: str,
) -> AiListingSuggestionOut:
    base_name = "Produkt"
    if file_names:
        first_name = file_names[0].rsplit(".", 1)[0].replace("-", " ").replace("_", " ").strip()
        if first_name:
            base_name = first_name[:60]

    suggested_title = title.strip() or f"{base_name} in gutem Zustand"
    suggested_description = description.strip() or (
        "Automatisch erzeugter Vorschlag. "
        "Bitte Zustand, Lieferumfang und Versanddetails vor dem Veröffentlichen prüfen."
    )
    suggested_price = price.strip() or "49"
    suggested_category = category.strip() or "Haushalt & Freizeit"

    return AiListingSuggestionOut(
        title=suggested_title,
        description=suggested_description,
        price=suggested_price,
        category=suggested_category,
    )


async def _read_images(image: Optional[UploadFile], images: list[UploadFile]) -> list[tuple[str, str]]:
    payloads: list[tuple[str, str]] = []
    uploads = [upload for upload in ([image] if image else []) + list(images or []) if upload is not None]

    for upload in uploads:
        raw = await upload.read()
        if not raw:
            continue
        mime = upload.content_type or "image/jpeg"
        payloads.append((mime, base64.b64encode(raw).decode("utf-8")))

    return payloads


async def _request_openai_suggestion(
    *,
    image_payloads: list[tuple[str, str]],
    title: str,
    description: str,
    price: str,
    category: str,
) -> AiListingSuggestionOut:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or not image_payloads:
        raise RuntimeError("OpenAI vision unavailable")

    text_parts = [
        "Erstelle einen kurzen Kleinanzeigen-/Marketplace-Listing-Vorschlag auf Deutsch.",
        "Antworte nur als JSON mit den Schlüsseln: title, description, price, category.",
        "Der Titel soll prägnant sein.",
        "Die Beschreibung soll 2-4 Sätze haben.",
        "Der Preis soll nur eine Zahl als String sein, ohne Währung.",
        "Die Kategorie soll ein kurzer Klartext sein.",
    ]
    if title.strip():
        text_parts.append(f"Bereits gesetzter Titel: {title.strip()}")
    if description.strip():
        text_parts.append(f"Bereits gesetzte Beschreibung: {description.strip()}")
    if price.strip():
        text_parts.append(f"Bereits gesetzter Preis: {price.strip()}")
    if category.strip():
        text_parts.append(f"Bereits gesetzte Kategorie: {category.strip()}")

    content = [{"type": "input_text", "text": "\n".join(text_parts)}]
    for mime, encoded in image_payloads[:5]:
        content.append({
            "type": "input_image",
            "image_url": f"data:{mime};base64,{encoded}",
        })

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4.1-mini",
                "input": [{
                    "role": "user",
                    "content": content,
                }],
                "text": {
                    "format": {
                        "type": "json_schema",
                        "name": "listing_suggestion",
                        "schema": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "price": {"type": "string"},
                                "category": {"type": "string"},
                            },
                            "required": ["title", "description", "price", "category"],
                        },
                    }
                },
            },
        )
        response.raise_for_status()
        data = response.json()

    output = data.get("output", [])
    for item in output:
        for content_item in item.get("content", []):
            if content_item.get("type") == "output_text":
                return AiListingSuggestionOut.model_validate_json(content_item.get("text", "{}"))

    raise RuntimeError("OpenAI response missing structured output")


@router.post("/ai-create", response_model=AiListingSuggestionOut)
async def ai_create_listing(
    payload: AiCreateListingIn = Depends(AiCreateListingIn.as_form),
    image: Optional[UploadFile] = File(None),
    images: list[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
):
    _ = payload.mode, user

    image_payloads = await _read_images(image, images)
    file_names = [upload.filename or "bild" for upload in ([image] if image else []) + list(images or []) if upload]

    try:
        return await _request_openai_suggestion(
            image_payloads=image_payloads,
            title=payload.title,
            description=payload.description,
            price=payload.price,
            category=payload.category,
        )
    except Exception:
        return _build_placeholder_suggestion(
            file_names=file_names,
            title=payload.title,
            description=payload.description,
            price=payload.price,
            category=payload.category,
        )
