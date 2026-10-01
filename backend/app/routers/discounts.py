from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.discount import Discount
from app.models.product import Product
from app.models.user import User
from app.schemas.discount import DiscountCreate, DiscountResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/discounts",
    tags=["Discounts"],
)


@router.get("/", response_model=list[DiscountResponse])
def get_discounts(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Discount)
        .order_by(Discount.id.desc())
    ).all()


@router.get("/{discount_id}", response_model=DiscountResponse)
def get_discount(
    discount_id: int,
    db: Session = Depends(get_db),
):
    discount = db.get(Discount, discount_id)

    if discount is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discount not found",
        )

    return discount


@router.post(
    "/",
    response_model=DiscountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_discount(
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if discount_data.end_date <= discount_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )

    if discount_data.product_id is not None:
        product = db.get(Product, discount_data.product_id)

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product not found",
            )

    if (
        discount_data.discount_type == "percentage"
        and discount_data.value > 100
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Percentage discount cannot exceed 100",
        )

    discount = Discount(
        name=discount_data.name,
        discount_type=discount_data.discount_type,
        value=discount_data.value,
        product_id=discount_data.product_id,
        start_date=discount_data.start_date,
        end_date=discount_data.end_date,
        is_active=discount_data.is_active,
    )

    db.add(discount)
    db.commit()
    db.refresh(discount)

    return discount