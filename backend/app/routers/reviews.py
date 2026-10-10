import logging
from html import escape

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException,Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.dependencies import get_current_user
from app.services.notifications import send_admin_notification

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["Reviews"],
)


class ReviewPage(BaseModel):
    reviews: list[ReviewResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get(
    "/products/{product_id}/reviews",
    response_model=ReviewPage,
    summary="List approved reviews for a product",
)
def get_product_reviews(
    product_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    page = max(page, 1)
    page_size = min(max(page_size, 1), 20)

    total = db.scalar(
        select(func.count(Review.id)).where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
    ) or 0

    offset = (page - 1) * page_size

    reviews = db.scalars(
        select(Review)
        .where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return {
        "reviews": reviews,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


def update_product_rating(
    product_id: int,
    db: Session,
):

    product = db.get(Product, product_id)

    if product is None:
        return

    average_rating = db.scalar(
        select(func.avg(Review.rating)).where(
            Review.product_id == product_id,
            Review.status == "approved",
        )
    )

    product.rating = round(float(average_rating), 1) if average_rating else 0


def _notify_new_review(
    *,
    product_name: str,
    customer_name: str,
    email: str,
    phone: str,
    rating: int,
    title: str | None,
    comment: str | None,
) -> None:

    try:
        stars = "⭐" * max(0, min(5, int(rating)))

        send_admin_notification(
            subject=f"⭐ TerraLens new review — {escape(product_name)}",
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 28px; color: #1F2521;">
                <div style="padding-bottom: 20px; border-bottom: 1px solid #E3E5DF;">
                    <h2 style="margin: 0; color: #486B57;">⭐ New Review Submitted</h2>
                    <p style="margin: 8px 0 0; color: #737A74;">
                        A customer has submitted a new product review.
                    </p>
                </div>

                <div style="padding: 22px 0;">
                    <p><strong>Product:</strong> {escape(product_name)}</p>
                    <p><strong>Customer:</strong> {escape(customer_name)}</p>
                    <p><strong>Email:</strong> {escape(email)}</p>
                    <p><strong>Phone:</strong> {escape(phone)}</p>
                    <p><strong>Verified purchase:</strong> Yes</p>
                </div>

                <div style="margin-top: 10px; padding: 18px; background: #FFF8E8; border-radius: 10px;">
                    <p style="margin: 0 0 10px; font-size: 20px;">{stars}</p>
                    <p style="margin: 0 0 8px; font-size: 16px; font-weight: 700;">
                        {escape(title or "No title")}
                    </p>
                    <p style="margin: 0; color: #4A4F4B; white-space: pre-line;">
                        {escape(comment or "No comment provided.")}
                    </p>
                </div>

                <div style="margin-top: 20px; padding: 18px; background: #F8F9F6; border-radius: 10px;">
                    <p style="margin: 0;"><strong>Status:</strong> Pending approval</p>
                </div>

                <p style="margin-top: 24px; font-size: 13px; color: #737A74;">
                    Review this submission from the TerraLens admin panel.
                </p>
            </div>
            """,
        )
    except Exception:
        logger.exception("Failed to send review notification for %s", product_name)


@router.post(
    "/products/{product_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Review a product you have received",
)
def create_review(
    product_id: int,
    review_data: ReviewCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    existing_review = db.scalar(
        select(Review.id).where(
            Review.user_id == current_user.id,
            Review.product_id == product_id,
        )
    )

    if existing_review is not None:
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
            # A partly refunded order still counts as a purchase.
            Order.payment_status.in_(["paid", "partially_refunded"]),
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

    product_name = product.name
    customer_name = (
        " ".join(
            part
            for part in [current_user.first_name, current_user.last_name]
            if part
        ).strip()
        or "Customer"
    )
    email = current_user.email or ""
    phone = (
        str(current_user.phone_number)
        if current_user.phone_number
        else "Not provided"
    )

    db.add(review)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this product",
        )

    db.refresh(review)

    background_tasks.add_task(
        _notify_new_review,
        product_name=product_name,
        customer_name=customer_name,
        email=email,
        phone=phone,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
    )

    return review


@router.put(
    "/reviews/{review_id}",
    response_model=ReviewResponse,
    summary="Edit your own review",
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

    changed = (
        review.rating != review_data.rating
        or review.title != review_data.title
        or review.comment != review_data.comment
    )

    review.rating = review_data.rating
    review.title = review_data.title
    review.comment = review_data.comment

    if changed and review.status == "approved":
        review.status = "pending"

    db.flush()

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
    summary="Delete your own review (admins can delete any)",
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