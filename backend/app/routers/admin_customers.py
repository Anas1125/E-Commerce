from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.admin_customer import (
    AdminCustomerResponse,
    AdminCustomerStatusUpdate,
)
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/customers",
    tags=["Admin Customers"],
)


@router.get("/", response_model=list[AdminCustomerResponse])
def get_all_customers(
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(User)
        .where(User.role == "customer")
        .order_by(User.created_at.desc())
    )

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    customers = db.scalars(query).all()

    return customers


@router.get("/{customer_id}", response_model=AdminCustomerResponse)
def get_customer(
    customer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = db.scalar(
        select(User).where(
            User.id == customer_id,
            User.role == "customer",
        )
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return customer


@router.patch(
    "/{customer_id}/status",
    response_model=AdminCustomerResponse,
)
def update_customer_status(
    customer_id: int,
    data: AdminCustomerStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = db.scalar(
        select(User).where(
            User.id == customer_id,
            User.role == "customer",
        )
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    customer.is_active = data.is_active

    db.commit()
    db.refresh(customer)

    return customer