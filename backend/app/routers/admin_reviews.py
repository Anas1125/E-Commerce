from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query,Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.product import Product
from app.models.review import Review
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/reviews",
    tags=["Admin Reviews"],
)

ReviewStatus = Literal["pending", "approved", "rejected"]

class ReviewUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None


class ReviewProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None = None


class AdminReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    title: str | None = None
    comment: str | None = None
    status: str
    is_verified_purchase: bool = False
    created_at: datetime | None = None
    user: ReviewUserOut | None = None
    product: ReviewProductOut | None = None

def _load_review(db: Session, review_id: int) -> Review | None:
    return db.scalar(
        select(Review)
        .options(
            selectinload(Review.user),
            selectinload(Review.product),
        )
        .where(Review.id == review_id)
    )



def _recalculate_product_rating(db: Session, product_id: int) -> None:
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .with_for_update()
    )

    if product is None:
        return

    average = db.scalar(
        select(func.avg(Review.rating)).where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
    )

    product.rating = (
        round(float(average), 1)
        if average is not None
        else 0
    )


@router.get(
    "/",
    response_model=list[AdminReviewResponse],
    dependencies=[Depends(require_admin)],
)
def get_admin_reviews(
    review_status: ReviewStatus | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(Review).options(
        selectinload(Review.user),
        selectinload(Review.product),
    )

    if review_status:
        query = query.where(Review.status == review_status)

    return db.scalars(
        query
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()


@router.patch(
    "/{review_id}/status",
    response_model=AdminReviewResponse,
    dependencies=[Depends(require_admin)],
)

@router.patch(
    "/{review_id}/status",
    response_model=AdminReviewResponse,
    dependencies=[Depends(require_admin)],
)
def update_review_status(
    review_id: int,
    review_status: ReviewStatus,
    db: Session = Depends(get_db),
):
    try:
        review = db.scalar(
            select(Review)
            .where(Review.id == review_id)
            .with_for_update()
        )

        if review is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found",
            )

        product_id = review.product_id
        product = db.scalar(
            select(Product)
            .where(Product.id == product_id)
            .with_for_update()
        )

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Review product not found",
            )

        review.status = review_status
        db.flush()

        _recalculate_product_rating(db, product_id)

        db.commit()

        return _load_review(db, review_id)

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise




@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_admin_review(
    review_id: int,
    db: Session = Depends(get_db),
):
    try:
        review = db.scalar(
            select(Review)
            .where(Review.id == review_id)
            .with_for_update()
        )

        if review is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found",
            )

        product_id = review.product_id

        product = db.scalar(
            select(Product)
            .where(Product.id == product_id)
            .with_for_update()
        )

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Review product not found",
            )

        db.delete(review)
        db.flush()

        _recalculate_product_rating(db, product_id)

        db.commit()

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise
