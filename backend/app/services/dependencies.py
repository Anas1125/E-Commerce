from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.security import JWT_ALGORITHM, JWT_SECRET_KEY
from app.services.cookie_session import (bearer_disabled, cookie_enabled, cookie_name, require_proxy, require_same_origin, session_role)


security = HTTPBearer(auto_error=False)


def resolve_credentials(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> HTTPAuthorizationCredentials:
    if credentials is not None:
        if bearer_disabled():
            raise HTTPException(401, "Bearer authentication is disabled")
        return credentials
    if cookie_enabled() and request.headers.get("x-session-role"):
        require_proxy(request)
        require_same_origin(request)
        role = session_role(request)
        token = request.cookies.get(cookie_name(role))
        if token:
            return HTTPAuthorizationCredentials(scheme=f"Cookie-{role}", credentials=token)
    raise HTTPException(401, "Authentication required")



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(resolve_credentials),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )

        cookie_role = (
            credentials.scheme.removeprefix("Cookie-")
            if credentials.scheme.startswith("Cookie-") else None
        )
        if cookie_role:
            if payload.get("session_kind") != "cookie" or payload.get("role") != cookie_role:
                raise HTTPException(401, "Invalid session")
        elif payload.get("session_kind") == "cookie":
            raise HTTPException(401, "Invalid authentication token")

        user_id = payload.get("sub")

        if not isinstance(user_id, str) or not user_id.isdigit():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        if int(user_id) <= 0 or int(user_id) > 2**63 - 1:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        user = db.scalar(
            select(User).where(User.id == int(user_id))
        )

    except (InvalidTokenError, ValueError, OverflowError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if cookie_role and user.role != cookie_role:
        raise HTTPException(401, "Invalid session role")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user