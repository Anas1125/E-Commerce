import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.admin_admin import (
    AdminCreate,
    AdminPasswordUpdate,
    AdminResponse,
    AdminStatusUpdate,
)
from app.services.auth import hash_password
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/admins",
    tags=["Admin Management"],
)

logger = logging.getLogger("app.admin_audit")

INDIAN_MOBILE_PATTERN = re.compile(r"^[6-9]\d{9}$")


def _normalize_email(value) -> str:
    return str(value).strip().lower()


def _normalize_phone(value) -> str:
    digits = re.sub(r"\D", "", str(value or ""))

    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    if not INDIAN_MOBILE_PATTERN.match(digits):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid 10-digit Indian mobile number.",
        )

    return digits


def _lock_admins(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.role == "admin")
            .order_by(User.id)
            .with_for_update()
        ).all()
    )


def _find_admin(admins: list[User], admin_id: int) -> User:
    for admin in admins:
        if admin.id == admin_id:
            return admin

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Admin not found",
    )


def _audit(action: str, actor: User, target_id: int | None = None) -> None:

    logger.info(
        "admin_audit action=%s actor_id=%s target_id=%s",
        action,
        actor.id,
        target_id,
    )


@router.get(
    "/",
    response_model=list[AdminResponse],
)
def get_all_admins(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(User)
        .where(User.role == "admin")
        .order_by(User.created_at.desc())
        .limit(200)
    ).all()


@router.post(
    "/",
    response_model=AdminResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin(
    data: AdminCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    email = _normalize_email(data.email)
    phone = _normalize_phone(data.phone_number)

    existing_email = db.scalar(
        select(User.id).where(func.lower(User.email) == email)
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    existing_phone = db.scalar(
        select(User.id).where(User.phone_number == phone)
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already registered",
        )

    admin = User(
        first_name=data.first_name.strip(),
        last_name=(data.last_name or "").strip() or None,
        email=email,
        phone_number=phone,
        password_hash=hash_password(data.password),
        role="admin",
        is_active=True,
    )

    db.add(admin)

    try:
        db.commit()
        db.refresh(admin)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone number is already registered",
        )

    _audit("create_admin", current_admin, admin.id)

    return admin


@router.patch(
    "/{admin_id}/status",
    response_model=AdminResponse,
)
def update_admin_status(
    admin_id: int,
    data: AdminStatusUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admins = _lock_admins(db)
    admin = _find_admin(admins, admin_id)

    if admin.id == current_admin.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    if not data.is_active and admin.is_active:
        active_admin_count = sum(
            1 for item in admins if item.is_active
        )

        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate the last active admin",
            )

    admin.is_active = data.is_active

    db.commit()
    db.refresh(admin)

    _audit(
        "activate_admin" if data.is_active else "deactivate_admin",
        current_admin,
        admin.id,
    )

    return admin


@router.patch(
    "/{admin_id}/password",
)
def update_admin_password(
    admin_id: int,
    data: AdminPasswordUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admins = _lock_admins(db)
    admin = _find_admin(admins, admin_id)

    admin.password_hash = hash_password(data.password)

    db.commit()

    _audit("update_admin_password", current_admin, admin.id)

    return {
        "message": "Admin password updated successfully.",
    }


@router.delete(
    "/{admin_id}",
)
def delete_admin(
    admin_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admins = _lock_admins(db)
    admin = _find_admin(admins, admin_id)

    if admin.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    if admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only inactive admin accounts can be deleted",
        )

    try:
        db.delete(admin)
        db.commit()
    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This account has order or activity history and can't be "
                "deleted. Keep it deactivated instead."
            ),
        )

    _audit("delete_admin", current_admin, admin_id)

    return {
        "message": "Admin account deleted successfully.",
    }