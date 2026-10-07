import hashlib
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserContactUpdate,
)
from app.services.auth import hash_password, verify_password
from app.services.dependencies import get_current_user
from app.services.security import create_access_token
from app.models.password_reset_token import PasswordResetToken
from app.services.email import send_password_reset_email
from app.services.notifications import send_admin_notification

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    existing_email = db.scalar(
        select(User).where(User.email == user_data.email)
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
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=hash_password(user_data.password),
        role="customer",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    customer_name = " ".join(
        part
        for part in [
            user.first_name,
            user.last_name,
        ]
        if part
    ).strip()

    if not customer_name:
        customer_name = "Customer"

    send_admin_notification(
        subject=f"👤 TerraLens new customer — {customer_name}",
        html=f"""
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 680px;
                    margin: 0 auto;
                    padding: 28px;
                    color: #1F2521;
                "
            >
                <div
                    style="
                        padding-bottom: 20px;
                        border-bottom: 1px solid #E3E5DF;
                    "
                >
                    <h2
                        style="
                            margin: 0;
                            color: #486B57;
                        "
                    >
                        👤 New Customer Registered
                    </h2>

                    <p
                        style="
                            margin: 8px 0 0;
                            color: #737A74;
                        "
                    >
                        A new customer has created an account.
                    </p>
                </div>

                <div style="padding: 22px 0;">
                    <p>
                        <strong>Name:</strong>
                        {customer_name}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        {user.email}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        {user.phone_number}
                    </p>

                    <p>
                        <strong>Customer ID:</strong>
                        #{user.id}
                    </p>

                    <p>
                        <strong>Role:</strong>
                        {user.role}
                    </p>

                    <p>
                        <strong>Registered:</strong>
                        {user.created_at.strftime("%d %b %Y, %I:%M %p")}
                    </p>
                </div>

                <div
                    style="
                        margin-top: 10px;
                        padding: 18px;
                        background: #F8F9F6;
                        border-radius: 10px;
                    "
                >
                    <p style="margin: 0;">
                        <strong>Account status:</strong>
                        Active
                    </p>
                </div>

                <p
                    style="
                        margin-top: 24px;
                        font-size: 13px;
                        color: #737A74;
                    "
                >
                    This customer is now available in the TerraLens admin panel.
                </p>
            </div>
        """,
    )

    return user


class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ValidateResetTokenRequest(BaseModel):
    token: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.email == user_data.email)
    )

    if not user or not verify_password(
        user_data.password,
        user.password_hash,
    ):
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
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.email == str(request.email))
    )

    # Always return the same response.
    # This prevents revealing whether an email exists.
    if not user:
        return {
            "message": (
                "If an account with that email exists, "
                "a password reset link has been sent."
            )
        }

    # Invalidate previous unused reset tokens for this user.
    existing_tokens = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        )
    ).all()

    for reset_token in existing_tokens:
        reset_token.used = True

    # Generate a cryptographically secure random token.
    raw_token = secrets.token_urlsafe(48)

    # Store only the hash in the database.
    token_hash = hashlib.sha256(
        raw_token.encode()
    ).hexdigest()

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=30),
        used=False,
    )

    db.add(reset_token)
    db.commit()

    reset_url = (
        f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}"
        f"/reset-password?token={raw_token}"
    )

    try:
        send_password_reset_email(
            email=user.email,
            reset_url=reset_url,
        )
    except Exception:
        db.delete(reset_token)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send password reset email.",
        )

    return {
        "message": (
            "If an account with that email exists, "
            "a password reset link has been sent."
        )
    }

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
        existing_email = db.scalar(
            select(User).where(
                User.email == contact_data.email,
                User.id != current_user.id,
            )
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered",
            )

        current_user.email = str(contact_data.email)

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

    db.commit()
    db.refresh(current_user)

    return current_user

@router.post(
    "/reset-password",
)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(
        request.token.encode()
    ).hexdigest()

    reset_token = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
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

    if reset_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired.",
        )

    user = db.get(User, reset_token.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link.",
        )

    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    user.password_hash = hash_password(
        request.new_password
    )

    reset_token.used = True

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
    token_hash = hashlib.sha256(
        request.token.encode()
    ).hexdigest()

    reset_token = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
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

    if reset_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired.",
        )

    return {
        "valid": True,
    }