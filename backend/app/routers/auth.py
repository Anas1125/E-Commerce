import hashlib
import html
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.user import (
    UserContactUpdate,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth import hash_password, verify_password
from app.services.dependencies import get_current_user
from app.services.email import send_password_reset_email
from app.services.notifications import send_admin_notification
from app.services.security import create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

RESET_TOKEN_TTL = timedelta(minutes=30)
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

FORGOT_PASSWORD_MESSAGE = (
    "If an account with that email exists, "
    "a password reset link has been sent."
)
_DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))



def _utcnow() -> datetime:
    """Naive UTC now (same value utcnow() returned, without the deprecation)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_email(email) -> str:
    return str(email).strip().lower()


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _get_valid_reset_token(db: Session, raw_token: str) -> PasswordResetToken:
    reset_token = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_token(raw_token),
        )
    )

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link.",
        )

    if reset_token.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has already been used.",
        )

    if reset_token.expires_at < _utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired.",
        )

    return reset_token


def _notify_admin_new_customer(
    customer_name: str,
    email: str,
    phone_number: str | None,
    customer_id: int,
    role: str,
    created_at: datetime | None,
) -> None:

    name = html.escape(customer_name)
    safe_email = html.escape(email or "")
    safe_phone = html.escape(phone_number or "—")
    safe_role = html.escape(str(role))
    registered = (
        created_at.strftime("%d %b %Y, %I:%M %p") if created_at else "—"
    )

    subject_name = " ".join(customer_name.split())

    body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 680px;
                    margin: 0 auto; padding: 28px; color: #1F2521;">
            <div style="padding-bottom: 20px; border-bottom: 1px solid #E3E5DF;">
                <h2 style="margin: 0; color: #486B57;">
                    👤 New Customer Registered
                </h2>
                <p style="margin: 8px 0 0; color: #737A74;">
                    A new customer has created an account.
                </p>
            </div>

            <div style="padding: 22px 0;">
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Email:</strong> {safe_email}</p>
                <p><strong>Phone:</strong> {safe_phone}</p>
                <p><strong>Customer ID:</strong> #{customer_id}</p>
                <p><strong>Role:</strong> {safe_role}</p>
                <p><strong>Registered:</strong> {registered}</p>
            </div>

            <div style="margin-top: 10px; padding: 18px;
                        background: #F8F9F6; border-radius: 10px;">
                <p style="margin: 0;">
                    <strong>Account status:</strong> Active
                </p>
            </div>

            <p style="margin-top: 24px; font-size: 13px; color: #737A74;">
                This customer is now available in the TerraLens admin panel.
            </p>
        </div>
    """

    try:
        send_admin_notification(
            subject=f"👤 TerraLens new customer — {subject_name}",
            html=body,
        )
    except Exception:
        logger.exception("Failed to send new-customer admin notification")


def _send_reset_email(email: str, reset_url: str) -> None:
    try:
        send_password_reset_email(email=email, reset_url=reset_url)
    except Exception:
        logger.exception("Failed to send password reset email")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ValidateResetTokenRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    new_password: str = Field(max_length=MAX_PASSWORD_LENGTH)




@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = _normalize_email(user_data.email)

    existing_email = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    existing_phone = db.scalar(
        select(User).where(User.phone_number == user_data.phone_number)
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already registered",
        )

    user = User(
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=email,
        phone_number=user_data.phone_number,
        password_hash=hash_password(user_data.password),
        role="customer",
        is_active=True,
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone number is already registered",
        )

    db.refresh(user)

    customer_name = (
        " ".join(
            part for part in [user.first_name, user.last_name] if part
        ).strip()
        or "Customer"
    )

    background_tasks.add_task(
        _notify_admin_new_customer,
        customer_name,
        user.email,
        user.phone_number,
        user.id,
        user.role,
        user.created_at,
    )

    return user


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    email = _normalize_email(user_data.email)

    user = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )

    password_ok = verify_password(
        user_data.password,
        user.password_hash if user else _DUMMY_PASSWORD_HASH,
    )

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post(
    "/forgot-password",
)
def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = _normalize_email(request.email)

    user = db.scalar(
        select(User).where(func.lower(User.email) == email)
    )
    if user is None or not user.is_active:
        return {"message": FORGOT_PASSWORD_MESSAGE}

    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        )
        .values(used=True)
    )
    raw_token = secrets.token_urlsafe(48)

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=_utcnow() + RESET_TOKEN_TTL,
            used=False,
        )
    )
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    reset_url = f"{frontend_url}/reset-password?token={raw_token}"

    background_tasks.add_task(_send_reset_email, user.email, reset_url)

    return {"message": FORGOT_PASSWORD_MESSAGE}


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.patch(
    "/me/contact",
    response_model=UserResponse,
)
def update_my_contact(
    contact_data: UserContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if contact_data.email is None and contact_data.phone_number is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide an email or phone number to update",
        )

    if contact_data.email is not None:
        email = _normalize_email(contact_data.email)

        existing_email = db.scalar(
            select(User).where(
                func.lower(User.email) == email,
                User.id != current_user.id,
            )
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered",
            )

        current_user.email = email

    if contact_data.phone_number is not None:
        existing_phone = db.scalar(
            select(User).where(
                User.phone_number == contact_data.phone_number,
                User.id != current_user.id,
            )
        )

        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is already registered",
            )

        current_user.phone_number = contact_data.phone_number

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or phone number is already registered",
        )

    db.refresh(current_user)

    return current_user


@router.post(
    "/reset-password",
)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if not (MIN_PASSWORD_LENGTH <= len(request.new_password) <= MAX_PASSWORD_LENGTH):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Password must be between {MIN_PASSWORD_LENGTH} and "
                f"{MAX_PASSWORD_LENGTH} characters long."
            ),
        )

    reset_token = _get_valid_reset_token(db, request.token)

    user = db.get(User, reset_token.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link.",
        )
    
    
    consumed = db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.id == reset_token.id,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at >= _utcnow(),
        )
        .values(used=True)
    )

    if consumed.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already-used password reset link.",
        )


    user.password_hash = hash_password(request.new_password)
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        )
        .values(used=True)
    )

    db.commit()

    return {
        "message": "Password has been reset successfully.",
    }


@router.post(
    "/validate-reset-token",
)
def validate_reset_token(
    request: ValidateResetTokenRequest,
    db: Session = Depends(get_db),
):
    _get_valid_reset_token(db, request.token)

    return {
        "valid": True,
    }