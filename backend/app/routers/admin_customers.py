import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
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

logger = logging.getLogger("app.admin_audit")

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def _escape_like(value: str) -> str:
    """Escape special characters used in SQL LIKE patterns."""
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _customer_filters(
    is_active: bool | None,
    q: str | None,
) -> list:
    filters = [
        User.role == "customer",
    ]

    if is_active is not None:
        filters.append(User.is_active.is_(is_active))

    term = (q or "").strip()

    if term:
        escaped_term = _escape_like(term.lower())
        pattern = f"%{escaped_term}%"

        conditions = [
            func.lower(User.email).like(pattern, escape="\\"),
            func.lower(User.first_name).like(pattern, escape="\\"),
            func.lower(
                func.coalesce(User.last_name, "")
            ).like(pattern, escape="\\"),
        ]

        digits = re.sub(r"\D", "", term)

        if digits:
            phone_pattern = f"%{_escape_like(digits)}%"
            conditions.append(
                User.phone_number.like(phone_pattern, escape="\\")
            )

        filters.append(or_(*conditions))

    return filters


def _get_customer_or_404(
    db: Session,
    customer_id: int,
    lock: bool = False,
) -> User:
    query = select(User).where(
        User.id == customer_id,
        User.role == "customer",
    )

    if lock:
        query = query.with_for_update()

    customer = db.scalar(query)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    return customer


def _audit(
    action: str,
    actor: User,
    target_id: int | None = None,
) -> None:
    logger.info(
        "admin_audit action=%s actor_id=%s target_id=%s",
        action,
        actor.id,
        target_id,
    )


@router.get("/", response_model=list[AdminCustomerResponse])
def get_all_customers(
    response: Response,
    is_active: bool | None = Query(default=None),
    q: str | None = Query(
        default=None,
        max_length=100,
        description="Search customers by name, email, or phone number",
    ),
    limit: int = Query(
        default=DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
    ),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = _customer_filters(is_active, q)

    total = db.scalar(
        select(func.count())
        .select_from(User)
        .where(*filters)
    )

    response.headers["X-Total-Count"] = str(total or 0)

    customers = db.scalars(
        select(User)
        .where(*filters)
        .order_by(
            User.created_at.desc(),
            User.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    ).all()

    _audit("list_customers", current_user)

    return customers


@router.get(
    "/{customer_id}",
    response_model=AdminCustomerResponse,
)
def get_customer(
    customer_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = _get_customer_or_404(db, customer_id)

    _audit("view_customer", current_user, customer.id)

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
    customer = _get_customer_or_404(
        db,
        customer_id,
        lock=True,
    )

    if customer.is_active == data.is_active:
        return customer

    customer.is_active = data.is_active

    try:
        db.commit()
        db.refresh(customer)

    except SQLAlchemyError:
        db.rollback()

        logger.exception(
            "Failed to update customer status for customer_id=%s",
            customer_id,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update customer status.",
        )

    _audit(
        "activate_customer" if data.is_active else "deactivate_customer",
        current_user,
        customer.id,
    )

    return customer