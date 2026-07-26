import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.config import settings
from app.db import User, get_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-SHA256 (no bcrypt dependency issues)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"pbkdf2:sha256:100000:{salt}:{dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a PBKDF2-SHA256 hash."""
    try:
        parts = hashed.split(":")
        if len(parts) != 5 or parts[0] != "pbkdf2" or parts[1] != "sha256":
            return False
        iterations = int(parts[2])
        salt = parts[3]
        expected = parts[4]
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), iterations)
        return dk.hex() == expected
    except (ValueError, IndexError):
        return False


def create_access_token(data: dict) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> User | None:
    """Decode a JWT token and return the user, or None on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        uid: str | None = payload.get("sub")
        if uid is None:
            return None
        from app.db import get_session, User
        from sqlmodel import select
        with next(get_session()) as session:
            user = session.get(User, int(uid))
            return user
    except Exception:
        return None


def get_current_user(
    token: str | None = Depends(oauth2_scheme), session: Session = Depends(get_session)
) -> User:
    """Dependency to retrieve the currently authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        uid: str | None = payload.get("sub")
        if uid is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user = session.get(User, int(uid))
    except (ValueError, TypeError):
        raise credentials_exception
    if user is None:
        raise credentials_exception

    return user


def require_plan(min_plan: str):
    """Dependency factory checking if the user's plan meets the minimum level required."""
    plan_levels = {"free": 0, "pro": 1, "business": 2}
    min_level = plan_levels.get(min_plan.lower(), 0)

    def dependency(user: User = Depends(get_current_user)) -> User:
        user_plan = user.plan or "free"
        user_level = plan_levels.get(user_plan.lower(), 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Subscription plan '{min_plan}' or higher is required to access this resource",
            )
        return user

    return dependency
