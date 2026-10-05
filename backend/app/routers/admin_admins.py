from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
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


@router.get(
    "/",
    response_model=list[AdminResponse],
)
def get_all_admins(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admins = db.scalars(
        select(User)
        .where(User.role == "admin")
        .order_by(User.created_at.desc())
    ).all()

    return admins


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
    existing_email = db.scalar(
        select(User).where(User.email == str(data.email))
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    existing_phone = db.scalar(
        select(User).where(
            User.phone_number == data.phone_number
        )
    )

    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already registered",
        )

    admin = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=str(data.email),
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        role="admin",
        is_active=True,
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

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
    admin = db.scalar(
        select(User).where(
            User.id == admin_id,
            User.role == "admin",
        )
    )

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    if admin.id == current_admin.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    if not data.is_active and admin.is_active:
        active_admin_count = db.scalar(
            select(func.count(User.id)).where(
                User.role == "admin",
                User.is_active == True,
            )
        )

        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate the last active admin",
            )

    admin.is_active = data.is_active

    db.commit()
    db.refresh(admin)

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
    admin = db.scalar(
        select(User).where(
            User.id == admin_id,
            User.role == "admin",
        )
    )

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    admin.password_hash = hash_password(data.password)

    db.commit()

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
    admin = db.scalar(
        select(User).where(
            User.id == admin_id,
            User.role == "admin",
        )
    )

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

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

    db.delete(admin)
    db.commit()

    return {
        "message": "Admin account deleted successfully.",
    }