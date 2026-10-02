from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.review import Review
from app.models.user import User
from app.models.product import Product
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/reviews",
    tags=["Admin Reviews"],
)


@router.get("/")
def get_admin_reviews(
    review_status: str | None = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(Review)
        .options(
            selectinload(Review.user),
            selectinload(Review.product),
        )
        .order_by(Review.created_at.desc())
    )

    if review_status:
        if review_status not in {
            "pending",
            "approved",
            "rejected",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid review status",
            )

        query = query.where(
            Review.status == review_status
        )

    return db.scalars(query).all()


@router.patch("/{review_id}/status")
def update_review_status(
    review_id: int,
    review_status: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if review_status not in {"pending", "approved", "rejected"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid review status",
        )

    review = db.get(Review, review_id)

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found",
        )

    review.status = review_status

    db.flush()

    # Recalculate product rating using approved reviews only
    reviews = db.scalars(
        select(Review).where(
            Review.product_id == review.product_id,
            Review.status == "approved",
        )
    ).all()

    product = db.get(Product, review.product_id)

    if product is not None:
        if reviews:
            product.rating = round(
                sum(r.rating for r in reviews) / len(reviews),
                1,
            )
        else:
            product.rating = 0

    db.commit()
    db.refresh(review)

    return review


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_admin_review(
    review_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)

    if review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    product_id = review.product_id

    db.delete(review)
    db.commit()

    # Recalculate product rating after deletion.
    reviews = db.scalars(
        select(Review).where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
    ).all()

    product = db.get(Product, product_id)

    if product is not None:
        if reviews:
            product.rating = round(
                sum(review.rating for review in reviews)
                / len(reviews),
                1,
            )
        else:
            product.rating = 0

        db.commit()