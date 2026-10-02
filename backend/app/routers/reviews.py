from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.review import Review
from app.models.user import User
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.dependencies import get_current_user


router = APIRouter(
    prefix="/api",
    tags=["Reviews"],
)


@router.get(
    "/products/{product_id}/reviews",
    response_model=list[ReviewResponse],
)
def get_product_reviews(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active == True,
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return db.scalars(
        select(Review)
        .where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
        .order_by(Review.created_at.desc())
    ).all()


def update_product_rating(
    product_id: int,
    db: Session,
):
    product = db.get(Product, product_id)

    if product is None:
        return

    reviews = db.scalars(
        select(Review).where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
    ).all()

    if not reviews:
        product.rating = 0
    else:
        average_rating = sum(
            review.rating for review in reviews
        ) / len(reviews)

        product.rating = round(average_rating, 1)


@router.post(
    "/products/{product_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    product_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active == True,
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    existing_review = db.scalar(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.product_id == product_id,
        )
    )

    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this product",
        )

    verified_purchase = db.scalar(
        select(OrderItem.id)
        .join(
            Order,
            Order.id == OrderItem.order_id,
        )
        .where(
            Order.user_id == current_user.id,
            OrderItem.product_id == product_id,
            Order.order_status == "delivered",
            Order.payment_status == "paid",
        )
        .limit(1)
    )

    if verified_purchase is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review products you have purchased and received",
        )

    review = Review(
        user_id=current_user.id,
        product_id=product_id,
        rating=review_data.rating,
        title=review_data.title,
        comment=review_data.comment,
        is_verified_purchase=True,
        status="pending",
    )

    db.add(review)

    update_product_rating(
        product_id=product_id,
        db=db,
    )

    db.commit()
    db.refresh(review)

    return review


@router.put(
    "/reviews/{review_id}",
    response_model=ReviewResponse,
)
def update_review(
    review_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)

    if review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own reviews",
        )

    review.rating = review_data.rating
    review.title = review_data.title
    review.comment = review_data.comment

    update_product_rating(
        product_id=review.product_id,
        db=db,
    )

    db.commit()
    db.refresh(review)

    return review


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.get(Review, review_id)

    if review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    if (
        review.user_id != current_user.id
        and current_user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own reviews",
        )

    product_id = review.product_id

    db.delete(review)
    db.flush()

    update_product_rating(
        product_id=product_id,
        db=db,
    )

    db.commit()