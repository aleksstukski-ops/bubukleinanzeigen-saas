from fastapi import APIRouter, Depends, HTTPException, status
from app.services.email import send_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.auth import PasswordResetIn, PasswordResetRequestIn, RefreshTokenIn, TokenPair, UserLoginIn, UserOut, UserRegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegisterIn, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=data.email, password_hash=hash_password(data.password), full_name=data.full_name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/login", response_model=TokenPair)
async def login(data: UserLoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshTokenIn, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token, expected_type="refresh")
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer valid")
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        is_active=user.is_active, plan=user.plan,
        account_limit=user.account_limit,
        subscription_status=user.subscription_status,
        subscription_expires_at=user.subscription_expires_at,
        created_at=user.created_at,
    )


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequestIn, db: AsyncSession = Depends(get_db)):

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    # Always return success to prevent email enumeration
    if not user:
        return {"success": True}

    token = create_access_token(user.id, expires_minutes=30)
    reset_url = f"https://bubuanzeigen.de/reset-password?token={token}"

    send_email(
        to=user.email,
        subject="BubuKleinanzeigen - Passwort zurücksetzen",
        body_html=f"""
        <h2>Passwort zurücksetzen</h2>
        <p>Klicke auf den Link um dein Passwort zurückzusetzen:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>Der Link ist 30 Minuten gültig.</p>
        <p>Falls du kein Passwort-Reset angefordert hast, ignoriere diese E-Mail.</p>
        """,
    )
    return {"success": True}


@router.post("/reset-password")
async def reset_password(data: PasswordResetIn, db: AsyncSession = Depends(get_db)):

    payload = decode_token(data.token, expected_type="access")
    if payload is None:
        raise HTTPException(status_code=400, detail="Ungültiger oder abgelaufener Link")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Ungültiger Token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Benutzer nicht gefunden")

    user.password_hash = hash_password(data.password)
    await db.commit()
    return {"success": True}
