from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.review import Review
from app.models.user import User
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.dependencies import get_current_user
from app.services.notifications import send_admin_notification

router = APIRouter(
    prefix="/api",
    tags=["Reviews"],
)


@router.get(
    "/products/{product_id}/reviews",
)
def get_product_reviews(
    product_id: int,
    page: int = 1,
    page_size: int = 5,
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
        .order_by(Review.created_at.desc())
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

    customer_name = " ".join(
        part
        for part in [
            current_user.first_name,
            current_user.last_name,
        ]
        if part
    ).strip()

    if not customer_name:
        customer_name = "Customer"

    send_admin_notification(
        subject=f"⭐ TerraLens new review — {product.name}",
        html=f"""
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 680px;
                    margin: 0 auto;
                    padding: 28px;
                    color: #1F2521;
                "
            >
                <div
                    style="
                        padding-bottom: 20px;
                        border-bottom: 1px solid #E3E5DF;
                    "
                >
                    <h2
                        style="
                            margin: 0;
                            color: #486B57;
                        "
                    >
                        ⭐ New Review Submitted
                    </h2>

                    <p
                        style="
                            margin: 8px 0 0;
                            color: #737A74;
                        "
                    >
                        A customer has submitted a new product review.
                    </p>
                </div>

                <div style="padding: 22px 0;">
                    <p>
                        <strong>Product:</strong>
                        {product.name}
                    </p>

                    <p>
                        <strong>Customer:</strong>
                        {customer_name}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        {current_user.email}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        {current_user.phone_number}
                    </p>

                    <p>
                        <strong>Verified purchase:</strong>
                        Yes
                    </p>
                </div>

                <div
                    style="
                        margin-top: 10px;
                        padding: 18px;
                        background: #FFF8E8;
                        border-radius: 10px;
                    "
                >
                    <p
                        style="
                            margin: 0 0 10px;
                            font-size: 20px;
                        "
                    >
                        {"⭐" * review.rating}
                    </p>

                    <p
                        style="
                            margin: 0 0 8px;
                            font-size: 16px;
                            font-weight: 700;
                        "
                    >
                        {review.title or "No title"}
                    </p>

                    <p
                        style="
                            margin: 0;
                            color: #4A4F4B;
                            white-space: pre-line;
                        "
                    >
                        {review.comment or "No comment provided."}
                    </p>
                </div>

                <div
                    style="
                        margin-top: 20px;
                        padding: 18px;
                        background: #F8F9F6;
                        border-radius: 10px;
                    "
                >
                    <p style="margin: 0;">
                        <strong>Status:</strong>
                        Pending approval
                    </p>
                </div>

                <p
                    style="
                        margin-top: 24px;
                        font-size: 13px;
                        color: #737A74;
                    "
                >
                    Review this submission from the TerraLens admin panel.
                </p>
            </div>
        """,
    )

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