import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.db import User, get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponseSchema(BaseModel):
    id: int | None
    email: str
    plan: str
    analyses_this_month: int

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponseSchema


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    """Register a new user with email and password."""
    try:
        statement = select(User).where(User.email == data.email)
        existing_user = session.exec(statement).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account already exists. Please sign in instead.",
            )

        new_user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            plan="free",
            analyses_this_month=0,
            created_date=datetime.now(timezone.utc),
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)

        token = create_access_token(data={"sub": str(new_user.id)})
        return {"access_token": token, "token_type": "bearer", "user": new_user}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Registration failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed")


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    """Authenticate a user and return a JWT access token."""
    statement = select(User).where(User.email == data.email)
    user = session.exec(statement).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


class GoogleAuthRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=AuthResponse)
def google_auth(data: GoogleAuthRequest, session: Session = Depends(get_session)):
    """Authenticate or register with a Google ID token."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured on this server",
        )

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        info = google_id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
        email = info.get("email", "")
        google_id = info.get("sub", "")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google token did not contain an email address",
            )

        user = session.exec(select(User).where(User.email == email)).first()
        if user:
            user.google_id = google_id
            session.add(user)
            session.commit()
        else:
            user = User(
                email=email,
                hashed_password="",
                google_id=google_id,
                plan="free",
                analyses_this_month=0,
                created_date=datetime.now(timezone.utc),
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        token = create_access_token(data={"sub": str(user.id)})
        return {"access_token": token, "token_type": "bearer", "user": user}

    except ValueError as exc:
        logger.warning("Invalid Google ID token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token",
        ) from exc
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth libraries not installed. Run: pip install google-auth google-auth-oauthlib",
        ) from None


@router.get("/me", response_model=UserResponseSchema)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return current_user


@router.get("/google/client-id")
def get_google_client_id():
    """Return the Google OAuth Client ID for frontend Sign-In button. Public endpoint."""
    return {"client_id": settings.GOOGLE_CLIENT_ID}


@router.get("/youtube/url")
def get_youtube_oauth_url(user: User = Depends(get_current_user)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="YouTube OAuth not configured")
    import urllib.parse
    params = urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.APP_URL}/api/auth/youtube/callback",
        "response_type": "code",
        "scope": settings.YOUTUBE_ANALYTICS_SCOPES,
        "access_type": "offline",
        "state": str(user.id),
        "prompt": "consent",
    })
    return {"url": f"https://accounts.google.com/oauth2/v2/auth?{params}"}


class YoutubeCallbackRequest(BaseModel):
    code: str
    state: str = ""


@router.get("/youtube/callback")
def youtube_oauth_callback_get(code: str, state: str = "", session: Session = Depends(get_session)):
    """Handle Google OAuth redirect (GET). Exchanges code for token and redirects to frontend."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="YouTube OAuth not configured")
    try:
        import httpx
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.APP_URL}/api/auth/youtube/callback",
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return RedirectResponse(url=f"{settings.APP_URL}/app#analytics?error=token_exchange_failed")

        token_data = resp.json()
        user_id = int(state) if state.isdigit() else 0
        if user_id:
            from app.db import set_youtube_token
            set_youtube_token(user_id, token_data)
        return RedirectResponse(url=f"{settings.APP_URL}/app#analytics?connected=1")
    except Exception:
        return RedirectResponse(url=f"{settings.APP_URL}/app#analytics?error=oauth_failed")


@router.post("/youtube/callback")
def youtube_oauth_callback(data: YoutubeCallbackRequest, user: User = Depends(get_current_user)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="YouTube OAuth not configured")
    try:
        import httpx
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": data.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.APP_URL}/api/auth/youtube/callback",
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")

        token_data = resp.json()
        from app.db import set_youtube_token
        set_youtube_token(user.id, token_data)
        return {"status": "connected"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="OAuth failed")
