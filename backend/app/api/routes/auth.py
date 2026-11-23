import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_password,
)
from app.db.session import get_db
from app.models import User, UserSession
from app.schemas.entities import LoginRequest, TokenResponse, UserRead

router = APIRouter()
refresh_cookie_name = "nexiot_refresh"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=refresh_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/api/auth",
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    database: Session = Depends(get_db),
) -> TokenResponse:
    user = database.query(User).filter(User.username == payload.username.lower()).one_or_none()
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    session = UserSession(
        user_id=user.id,
        refresh_token_hash="pending",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    database.add(session)
    database.flush()
    refresh_token = create_refresh_token(user.id, session.id)
    session.refresh_token_hash = hash_token(refresh_token)
    user.last_access = datetime.now(UTC)
    database.commit()
    database.refresh(user)
    set_refresh_cookie(response, refresh_token)
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=refresh_cookie_name),
    database: Session = Depends(get_db),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No existe una sesión renovable")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        session_id = uuid.UUID(payload["sid"])
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise HTTPException(status_code=401, detail="Refresh token inválido") from error

    session = database.get(UserSession, session_id)
    user = database.get(User, user_id)
    now = datetime.now(UTC)
    if (
        session is None
        or user is None
        or not user.active
        or session.revoked_at is not None
        or session.expires_at < now
        or session.refresh_token_hash != hash_token(refresh_token)
    ):
        raise HTTPException(status_code=401, detail="La sesión expiró o fue revocada")

    new_refresh_token = create_refresh_token(user.id, session.id)
    session.refresh_token_hash = hash_token(new_refresh_token)
    database.commit()
    set_refresh_cookie(response, new_refresh_token)
    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=refresh_cookie_name),
    database: Session = Depends(get_db),
) -> Response:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            session = database.get(UserSession, uuid.UUID(payload["sid"]))
            if session and session.revoked_at is None:
                session.revoked_at = datetime.now(UTC)
                database.commit()
        except (jwt.PyJWTError, KeyError, ValueError):
            pass
    response.delete_cookie(refresh_cookie_name, path="/api/auth")
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Response:
    database.execute(
        update(UserSession)
        .where(UserSession.user_id == current_user.id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    database.commit()
    response.delete_cookie(refresh_cookie_name, path="/api/auth")
    return response


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
