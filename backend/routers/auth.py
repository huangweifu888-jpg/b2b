import logging
import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from urllib.parse import urlencode

import httpx
from core.auth import (
    IDTokenValidationError,
    build_authorization_url,
    build_logout_url,
    create_access_token,
    decode_access_token,
    generate_code_challenge,
    generate_code_verifier,
    generate_nonce,
    generate_state,
    validate_id_token,
)
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from models.auth import RefreshSession, User
from models.platform import LocalAccount, Membership, Organization, Role
from schemas.auth import (
    PlatformTokenExchangeRequest,
    TokenExchangeResponse,
    UserResponse,
)
from services.auth import AuthService
from services.audit import record_audit_event
from services.membership_invites import claim_membership_invite
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


class LocalRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = None
    invite_code: Optional[str] = None


REFRESH_COOKIE_NAME = "tradepro_refresh"


def issue_refresh_token(user: User, session_id: str) -> str:
    """Opaque-to-JS, signed renewal credential for formal OIDC sessions only."""
    return create_access_token({"sub": user.id, "role": user.role, "sid": session_id, "token_use": "refresh"}, expires_minutes=60 * 24 * 7)


async def create_refresh_session(db: AsyncSession, user: User) -> tuple[str, str]:
    session_id = secrets.token_urlsafe(24)
    raw_token = issue_refresh_token(user, session_id)
    db.add(RefreshSession(id=session_id, user_id=user.id, token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(), expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    return session_id, raw_token


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(REFRESH_COOKIE_NAME, raw_token, max_age=60 * 60 * 24 * 7, httponly=True, secure=not settings.is_development_environment, samesite="lax", path="/api/v1/auth")


class LocalLoginRequest(BaseModel):
    email: EmailStr
    password: str


class LocalAuthResponse(BaseModel):
    token: str
    token_type: str = "Bearer"
    user: UserResponse
    expires_at: Optional[int] = None


class LocalDemoSessionRequest(BaseModel):
    """The local UI role to use for an account-free development session."""

    scope: Literal["hq", "agency", "client"]


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, expected = stored.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    return secrets.compare_digest(hash_password(password, salt), stored)


def _local_patch(url: str) -> str:
    """Patch URL for local development."""
    if os.getenv("LOCAL_PATCH", "").lower() not in ("true", "1"):
        return url

    patched_url = url.replace("https://", "http://").replace(":8000", ":3000")
    logger.debug("[get_dynamic_backend_url] patching URL from %s to %s", url, patched_url)
    return patched_url


def get_dynamic_backend_url(request: Request) -> str:
    """Get backend URL dynamically from request headers.

    Priority: mgx-external-domain > x-forwarded-host > host > settings.backend_url
    """
    mgx_external_domain = request.headers.get("mgx-external-domain")
    x_forwarded_host = request.headers.get("x-forwarded-host")
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", "https")

    effective_host = mgx_external_domain or x_forwarded_host or host
    if not effective_host:
        logger.warning("[get_dynamic_backend_url] No host found, fallback to %s", settings.backend_url)
        return settings.backend_url

    dynamic_url = _local_patch(f"{scheme}://{effective_host}")
    logger.debug(
        "[get_dynamic_backend_url] mgx-external-domain=%s, x-forwarded-host=%s, host=%s, scheme=%s, dynamic_url=%s",
        mgx_external_domain,
        x_forwarded_host,
        host,
        scheme,
        dynamic_url,
    )
    return dynamic_url


def get_frontend_callback_url(request: Request, backend_url: str) -> str:
    """Resolve the browser callback target without sending local users back to the API port."""
    configured = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if configured:
        return configured

    host = (request.headers.get("host") or "").lower()
    if host in {"127.0.0.1:8000", "localhost:8000"}:
        return "http://127.0.0.1:3003"

    return backend_url.rstrip("/")


def derive_name_from_email(email: str) -> str:
    return email.split("@", 1)[0] if email else ""


def is_loopback_development_request(request: Request) -> bool:
    """Keep account-free sessions unavailable outside an explicit local dev server."""
    client_host = request.client.host if request.client else ""
    return settings.is_development_environment and client_host in {"127.0.0.1", "::1"}


@router.post("/local/demo-session", response_model=LocalAuthResponse)
async def local_demo_session(
    payload: LocalDemoSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Issue an account-free session for the local B2B demonstration only.

    This route is deliberately restricted to loopback requests in an explicit
    development environment.  It must never become a production login path.
    """
    if not is_loopback_development_request(request):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    labels = {
        "hq": ("本地演示总部", "demo-hq@local.invalid"),
        "agency": ("本地演示代理端", "demo-agency@local.invalid"),
        "client": ("本地演示客户端", "demo-client@local.invalid"),
    }
    name, email = labels[payload.scope]
    user_id = f"local:demo:{payload.scope}"
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        # Platform pages require headquarters-level visibility during local UI
        # verification, so the temporary local identity uses the admin role.
        user = User(id=user_id, email=email, name=name, role="admin")
        db.add(user)
    else:
        user.email = email
        user.name = name
        user.role = "admin"

    from datetime import datetime, timezone

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    token, expires_at, _ = await AuthService(db).issue_app_token(user)
    return LocalAuthResponse(
        token=token,
        expires_at=int(expires_at.timestamp()),
        user=UserResponse(id=user.id, email=user.email, name=user.name, role=user.role, last_login=user.last_login),
    )


@router.post("/local/register", response_model=LocalAuthResponse)
async def local_register(payload: LocalRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register with email/password for local development and deployable SaaS auth."""
    existing = await db.scalar(select(LocalAccount).where(LocalAccount.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    org = None
    member_invite = None
    if payload.invite_code:
        try:
            member_invite = await claim_membership_invite(db, raw_code=payload.invite_code, email=payload.email)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        org = await db.scalar(select(Organization).where(Organization.id == member_invite.org_id, Organization.status == "active"))
        if not org:
            raise HTTPException(status_code=400, detail="Invitation organization is unavailable")

    user_id = f"local:{payload.email.lower()}"
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        user = User(
            id=user_id,
            email=payload.email.lower(),
            name=payload.name or derive_name_from_email(payload.email),
            role="user",
        )
        db.add(user)
        await db.flush()

    account = LocalAccount(
        user_id=user.id,
        org_id=org.id if org else None,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(account)

    if org and member_invite:
        member_invite.accepted_by = user.id
        existing_membership = await db.scalar(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.org_id == org.id,
                Membership.project_id == member_invite.project_id,
            )
        )
        if existing_membership:
            raise HTTPException(status_code=409, detail="User already has this tenant membership")
        db.add(
            Membership(
                user_id=user.id,
                org_id=org.id,
                project_id=member_invite.project_id,
                role_id=member_invite.role_id,
                is_default=True,
            )
        )

    await db.commit()
    await db.refresh(user)

    auth_service = AuthService(db)
    token, _, _ = await auth_service.issue_app_token(user)
    return LocalAuthResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, role=user.role, last_login=user.last_login),
    )


@router.post("/local/login", response_model=LocalAuthResponse)
async def local_login(payload: LocalLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email/password and receive the app JWT."""
    account = await db.scalar(select(LocalAccount).where(LocalAccount.email == payload.email.lower()))
    if not account or account.status != "active" or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user = await db.scalar(select(User).where(User.id == account.user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    from datetime import datetime, timezone

    user.last_login = datetime.now(timezone.utc)
    account.last_login = user.last_login
    await db.commit()
    await db.refresh(user)

    auth_service = AuthService(db)
    token, _, _ = await auth_service.issue_app_token(user)
    return LocalAuthResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, role=user.role, last_login=user.last_login),
    )


@router.get("/login")
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    """Start OIDC login flow with PKCE."""
    state = generate_state()
    nonce = generate_nonce()
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)

    # Store state, nonce, and code verifier in database
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, code_verifier)

    # Build redirect_uri dynamically from request
    backend_url = get_dynamic_backend_url(request)
    redirect_uri = f"{backend_url}/api/v1/auth/callback"
    logger.info("[login] Starting OIDC flow with redirect_uri=%s", redirect_uri)

    auth_url = build_authorization_url(state, nonce, code_challenge, redirect_uri=redirect_uri)
    return RedirectResponse(
        url=auth_url,
        status_code=status.HTTP_302_FOUND,
        headers={"X-Request-ID": state},
    )


@router.get("/callback")
async def callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle OIDC callback."""
    backend_url = get_dynamic_backend_url(request)
    frontend_callback_url = get_frontend_callback_url(request, backend_url)

    def redirect_with_error(message: str) -> RedirectResponse:
        fragment = urlencode({"msg": message})
        return RedirectResponse(
            url=f"{frontend_callback_url}/auth/error?{fragment}",
            status_code=status.HTTP_302_FOUND,
        )

    if error:
        return redirect_with_error(f"OIDC error: {error}")

    if not code or not state:
        return redirect_with_error("Missing code or state parameter")

    # Validate state using database
    auth_service = AuthService(db)
    temp_data = await auth_service.get_and_delete_oidc_state(state)
    if not temp_data:
        return redirect_with_error("Invalid or expired state parameter")

    nonce = temp_data["nonce"]
    code_verifier = temp_data.get("code_verifier")

    try:
        # Build redirect_uri dynamically from request
        redirect_uri = f"{backend_url}/api/v1/auth/callback"
        logger.info("[callback] Exchanging code for tokens with redirect_uri=%s", redirect_uri)

        # Exchange authorization code for tokens with PKCE
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
        }

        # Add PKCE code verifier if available
        if code_verifier:
            token_data["code_verifier"] = code_verifier

        token_url = f"{settings.oidc_issuer_url}/token"
        try:
            async with httpx.AsyncClient() as client:
                token_response = await client.post(
                    token_url,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded", "X-Request-ID": state},
                )
        except httpx.HTTPError as e:
            logger.error(
                "[callback] Token exchange HTTP error: url=%s, error=%s",
                token_url,
                str(e),
                exc_info=True,
            )
            return redirect_with_error(f"Token exchange failed: {e}")

        if token_response.status_code != 200:
            logger.error(
                "[callback] Token exchange failed: url=%s, status_code=%s, response=%s",
                token_url,
                token_response.status_code,
                token_response.text,
            )
            return redirect_with_error(f"Token exchange failed: {token_response.text}")

        tokens = token_response.json()

        # Validate ID token
        id_token = tokens.get("id_token")
        if not id_token:
            return redirect_with_error("No ID token received")

        id_claims = await validate_id_token(id_token)

        # Validate nonce
        if id_claims.get("nonce") != nonce:
            return redirect_with_error("Invalid nonce")

        # Get or create user
        email = id_claims.get("email", "")
        name = id_claims.get("name") or derive_name_from_email(email)
        user = await auth_service.get_or_create_user(platform_sub=id_claims["sub"], email=email, name=name)

        # Issue application JWT token encapsulating user information
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
        record_audit_event(
            db,
            action="oidc_login_succeeded",
            actor_user_id=user.id,
            target_type="user",
            target_id=user.id,
            ip_address=request.client.host if request.client else None,
            detail={"provider": "oidc"},
        )
        _session_id, refresh_token = await create_refresh_session(db, user)
        await db.commit()

        fragment = urlencode(
            {
                "token": app_token,
                "expires_at": int(expires_at.timestamp()),
                "token_type": "Bearer",
            }
        )

        redirect_url = f"{frontend_callback_url}/auth/callback?{fragment}"
        logger.info("[callback] OIDC callback successful, redirecting to %s", redirect_url)
        redirect_response = RedirectResponse(
            url=redirect_url,
            status_code=status.HTTP_302_FOUND,
        )
        set_refresh_cookie(redirect_response, refresh_token)
        return redirect_response

    except IDTokenValidationError as e:
        # Redirect to error page with validation details
        return redirect_with_error(f"Authentication failed: {e.message}")
    except HTTPException as e:
        # Redirect to error page with the original detail message
        return redirect_with_error(str(e.detail))
    except Exception as e:
        logger.exception(f"Unexpected error in OIDC callback: {e}")
        return redirect_with_error(
            "Authentication processing failed. Please try again or contact support if the issue persists."
        )


@router.post("/token/exchange", response_model=TokenExchangeResponse)
async def exchange_platform_token(
    payload: PlatformTokenExchangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange Platform token for app token. Admin gets admin role, team members get user role."""
    logger.info("[token/exchange] Received platform token exchange request")

    verify_url = f"{settings.oidc_issuer_url}/platform/tokens/verify"
    logger.debug(f"[token/exchange] Verifying token with issuer: {verify_url}")

    try:
        async with httpx.AsyncClient() as client:
            verify_response = await client.post(
                verify_url,
                json={"platform_token": payload.platform_token},
                headers={"Content-Type": "application/json"},
            )
        logger.debug(f"[token/exchange] Issuer response status: {verify_response.status_code}")
    except httpx.HTTPError as exc:
        logger.error(f"[token/exchange] HTTP error verifying platform token: {exc}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to verify platform token") from exc

    try:
        verify_body = verify_response.json()
        logger.debug(f"[token/exchange] Issuer response body: {verify_body}")
    except ValueError:
        logger.error(f"[token/exchange] Failed to parse issuer response as JSON: {verify_response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from platform token verification service",
        )

    if not isinstance(verify_body, dict):
        logger.error(f"[token/exchange] Unexpected response type: {type(verify_body)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unexpected response from platform token verification service",
        )

    if verify_response.status_code != status.HTTP_200_OK or not verify_body.get("success"):
        message = verify_body.get("message", "") if isinstance(verify_body, dict) else ""
        logger.warning(
            f"[token/exchange] Token verification failed: status={verify_response.status_code}, message={message}"
        )
        raise HTTPException(
            status_code=verify_response.status_code,
            detail=message or "Platform token verification failed",
        )

    payload_data = verify_body.get("data") or {}
    raw_user_id = payload_data.get("user_id")
    logger.info(f"[token/exchange] Token verified, platform_user_id={raw_user_id}, email={payload_data.get('email')}")

    if not raw_user_id:
        logger.error("[token/exchange] Platform token payload missing user_id")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform token payload missing user_id")

    platform_user_id = str(raw_user_id)
    is_admin = platform_user_id == str(settings.admin_user_id)
    role = "admin" if is_admin else "user"

    logger.info(f"[token/exchange] User verified: platform_user_id={platform_user_id}, role={role}")
    auth_service = AuthService(db)

    user_email = payload_data.get("email", "") or (getattr(settings, "admin_user_email", "") if is_admin else "")
    user_name = payload_data.get("name") or payload_data.get("username")
    if not user_name:
        user_name = derive_name_from_email(user_email)

    user = User(id=platform_user_id, email=user_email, name=user_name, role=role)
    logger.debug(
        f"[token/exchange] User object for token issuance: id={user.id}, email={user.email}, role={user.role}"
    )

    app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
    logger.info(f"[token/exchange] Token issued successfully for user_id={user.id}, expires_at={expires_at}")

    return TokenExchangeResponse(
        token=app_token,
    )


@router.post("/refresh", response_model=TokenExchangeResponse)
async def refresh_oidc_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Renew an access token from an HttpOnly refresh cookie; never read it in JS."""
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session missing")
    try:
        payload = decode_access_token(raw_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session invalid") from exc
    if payload.get("token_use") != "refresh" or not payload.get("sub") or not payload.get("sid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session invalid")
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    session = await db.scalar(select(RefreshSession).where(RefreshSession.id == str(payload["sid"]), RefreshSession.token_hash == token_hash))
    session_expires_at = session.expires_at.replace(tzinfo=timezone.utc) if session and session.expires_at.tzinfo is None else (session.expires_at if session else None)
    if not session or session.revoked_at or not session_expires_at or session_expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session invalid")
    user = await db.scalar(select(User).where(User.id == str(payload["sub"])))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session invalid")
    session.revoked_at = datetime.now(timezone.utc)
    _new_session_id, new_refresh_token = await create_refresh_session(db, user)
    token, expires_at, _ = await AuthService(db).issue_app_token(user)
    record_audit_event(db, action="oidc_access_token_refreshed", actor_user_id=user.id, target_type="user", target_id=user.id, ip_address=request.client.host if request.client else None, detail={"provider": "oidc"})
    await db.commit()
    set_refresh_cookie(response, new_refresh_token)
    return TokenExchangeResponse(token=token, expires_at=int(expires_at.timestamp()))


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/sessions")
async def list_refresh_sessions(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    sessions = (await db.execute(select(RefreshSession).where(RefreshSession.user_id == current_user.id).order_by(RefreshSession.created_at.desc()))).scalars().all()
    return {"items": [{"id": item.id, "created_at": item.created_at, "expires_at": item.expires_at, "revoked_at": item.revoked_at} for item in sessions]}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_refresh_session(session_id: str, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    session = await db.scalar(select(RefreshSession).where(RefreshSession.id == session_id, RefreshSession.user_id == current_user.id))
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.revoked_at = datetime.now(timezone.utc)
    record_audit_event(db, action="oidc_session_revoked", actor_user_id=current_user.id, target_type="refresh_session", target_id=session_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Logout user."""
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token:
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        session = await db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash))
        if session and not session.revoked_at:
            session.revoked_at = datetime.now(timezone.utc)
            await db.commit()
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/v1/auth")
    logout_url = build_logout_url()
    return {"redirect_url": logout_url}
