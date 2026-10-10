from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.discount import Discount
from app.models.product import Product
from app.schemas.discount import DiscountCreate, DiscountResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/discounts",
    tags=["Discounts"],
)

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


def _validated_fields(db: Session, data: DiscountCreate) -> dict:
    name = " ".join(data.name.split())

    if not name:
        raise _bad_request("Discount name is required")

    start_date = _to_utc(data.start_date)
    end_date = _to_utc(data.end_date)

    if end_date <= start_date:
        raise _bad_request("End date must be after start date")

    if data.value <= 0:
        raise _bad_request("Discount value must be greater than zero")

    if data.discount_type == "percentage" and data.value > 100:
        raise _bad_request("Percentage discount cannot exceed 100")

    if data.product_id is not None:
        product = db.get(Product, data.product_id)

        if product is None:
            raise _bad_request("Product not found")

        if (
            data.discount_type == "fixed"
            and product.price is not None
            and data.value > product.price
        ):
            raise _bad_request(
                "A fixed discount cannot be larger than the product price"
            )

    return {
        "name": name,
        "discount_type": data.discount_type,
        "value": data.value,
        "product_id": data.product_id,
        "start_date": start_date,
        "end_date": end_date,
        "is_active": data.is_active,
    }


def _get_discount_or_404(db: Session, discount_id: int) -> Discount:
    discount = db.get(Discount, discount_id)

    if discount is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount not found",
        )

    return discount

@router.get(
    "/",
    response_model=list[DiscountResponse],
    dependencies=[Depends(require_admin)],
)
def get_discounts(
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Discount)
        .order_by(Discount.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

@router.get("/active", response_model=list[DiscountResponse])
def get_active_discounts(
    db: Session = Depends(get_db),
):
    """Public: only discounts that are active right now."""
    now = _utcnow()

    return db.scalars(
        select(Discount)
        .where(
            Discount.is_active.is_(True),
            Discount.start_date <= now,
            Discount.end_date >= now,
        )
        .order_by(Discount.id.desc())
    ).all()


@router.get(
    "/{discount_id}",
    response_model=DiscountResponse,
    dependencies=[Depends(require_admin)],
)
def get_discount(
    discount_id: int,
    db: Session = Depends(get_db),
):
    return _get_discount_or_404(db, discount_id)


@router.post(
    "/",
    response_model=DiscountResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_discount(
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    
):
    discount = Discount(**_validated_fields(db, discount_data))


    db.add(discount)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create discount because of a database constraint.",
        )

    db.refresh(discount)
    return discount

@router.patch(
    "/{discount_id}/status",
    response_model=DiscountResponse,
    dependencies=[Depends(require_admin)],
)
def update_discount_status(
    discount_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
):
    discount = _get_discount_or_404(db, discount_id)
    discount.is_active = is_active

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to update discount status because of a database constraint.",
        )

    db.refresh(discount)
    return discount


@router.patch(
    "/{discount_id}/status",
    response_model=DiscountResponse,
    dependencies=[Depends(require_admin)],
)
def update_discount_status(
    discount_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
):
    discount = _get_discount_or_404(db, discount_id)

    discount.is_active = is_active

    db.commit()
    db.refresh(discount)

    return discount

@router.delete(
    "/{discount_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_discount(
    discount_id: int,
    db: Session = Depends(get_db),
):
    discount = _get_discount_or_404(db, discount_id)

    db.delete(discount)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This discount is still referenced and cannot be deleted. Deactivate it instead.",
        )

    return None