"""Stripe billing — checkout session, customer portal, webhook handler."""
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import User
from app.models.user import SubscriptionPlan

log = logging.getLogger("api.billing")
router = APIRouter(prefix="/billing", tags=["billing"])

VALID_PLANS = {"starter", "pro", "business"}


def _plan_price_id(plan: str) -> str:
    """Return the Stripe price ID for the given plan name."""
    return {
        "starter": settings.STRIPE_PRICE_STARTER,
        "pro": settings.STRIPE_PRICE_PRO,
        "business": settings.STRIPE_PRICE_BUSINESS,
    }[plan]


def _configure_stripe() -> None:
    stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/checkout-session")
async def create_checkout_session(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for the requested plan."""
    _configure_stripe()
    data = await request.json()
    plan = str(data.get("plan", "")).lower()

    if plan not in VALID_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ungueltiger Plan: {plan}. Erlaubt: {sorted(VALID_PLANS)}",
        )

    price_id = _plan_price_id(plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe-Preise noch nicht konfiguriert",
        )

    try:
        # Create Stripe customer on first checkout
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                metadata={"user_id": str(user.id)},
            )
            user.stripe_customer_id = customer.id
            await db.commit()
            customer_id = customer.id

        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/billing?success=1&plan={plan}",
            cancel_url=f"{settings.FRONTEND_URL}/billing?cancelled=1",
            metadata={"user_id": str(user.id), "plan": plan},
            allow_promotion_codes=True,
        )
    except stripe.AuthenticationError:
        log.error("Stripe API key invalid — check STRIPE_SECRET_KEY in .env")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe-Konfiguration fehlerhaft. Bitte Administrator kontaktieren.",
        )
    except stripe.StripeError as exc:
        log.error("Stripe error during checkout: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe-Fehler: {exc.user_message or str(exc)}",
        )

    return {"url": session.url}


@router.post("/portal")
async def create_portal_session(
    user: User = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session so users can manage their subscription."""
    _configure_stripe()
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kein aktives Abonnement gefunden",
        )

    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/billing",
        )
    except stripe.AuthenticationError:
        log.error("Stripe API key invalid — check STRIPE_SECRET_KEY in .env")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe-Konfiguration fehlerhaft. Bitte Administrator kontaktieren.",
        )
    except stripe.StripeError as exc:
        log.error("Stripe error during portal session: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe-Fehler: {exc.user_message or str(exc)}",
        )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events. Must receive raw body for signature verification."""
    _configure_stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        log.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as exc:
        log.warning("Stripe webhook parse error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

    event_type: str = event["type"]
    log.info("Stripe webhook received: %s", event_type)

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(event["data"]["object"], db)
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        await _handle_subscription_change(event["data"]["object"], db)

    return {"received": True}


async def _handle_checkout_completed(session: dict, db: AsyncSession) -> None:
    customer_id = session.get("customer")
    plan = (session.get("metadata") or {}).get("plan")

    if not customer_id or not plan:
        log.warning("checkout.session.completed missing customer or plan metadata")
        return

    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()
    if user is None:
        log.warning("No user found for Stripe customer %s", customer_id)
        return

    user.plan = plan
    user.subscription_status = "active"
    await db.commit()
    log.info("User %s upgraded to plan '%s' via checkout", user.id, plan)


async def _handle_subscription_change(subscription: dict, db: AsyncSession) -> None:
    customer_id = subscription.get("customer")
    sub_status = subscription.get("status", "")

    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()
    if user is None:
        log.warning("No user found for Stripe customer %s", customer_id)
        return

    user.subscription_status = sub_status

    if sub_status in ("canceled", "unpaid", "incomplete_expired"):
        user.plan = SubscriptionPlan.FREE.value
        user.subscription_expires_at = None
    elif sub_status == "active":
        period_end = subscription.get("current_period_end")
        if period_end:
            user.subscription_expires_at = datetime.fromtimestamp(
                int(period_end), tz=timezone.utc
            )

    await db.commit()
    log.info(
        "User %s subscription status -> '%s' (plan: %s)",
        user.id, sub_status, user.plan,
    )
