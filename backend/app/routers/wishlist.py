from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.brand import Brand
from app.models.inventory import Inventory
from app.models.user import User
from app.models.wishlist_item import WishlistItem
from app.schemas.wishlist import (
    WishlistItemResponse,
    WishlistResponse,
)
from app.services.dependencies import get_current_user

router = APIRouter(
    prefix="/api/wishlist",
    tags=["Wishlist"],
)

MAX_WISHLIST_ITEMS_RETURNED = 200


def _primary_image_url_subquery():
    return (
        select(ProductImage.image_url)
        .where(ProductImage.product_id == Product.id)
        .order_by(
            ProductImage.is_primary.desc(),
            ProductImage.display_order,
            ProductImage.id,
        )
        .limit(1)
        .scalar_subquery()
    )


def _wishlist_query(user_id: int):
    available_stock = func.coalesce(
        Inventory.quantity - Inventory.reserved_quantity,
        0,
    )

    return (
        select(
            WishlistItem.id.label("id"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.price.label("price"),
            Brand.name.label("brand"),
            available_stock.label("available_stock"),
            Product.is_active.label("is_active"),
            _primary_image_url_subquery().label("image_url"),
        )
        .join(Product, Product.id == WishlistItem.product_id)
        .outerjoin(Brand, Brand.id == Product.brand_id)
        .outerjoin(Inventory, Inventory.product_id == Product.id)
        .where(
            WishlistItem.user_id == user_id,
            Product.is_active.is_(True),
        )
    )


@router.get(
    "/",
    response_model=WishlistResponse,
    summary="List the current user's wishlist, newest first",
)
def get_wishlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        _wishlist_query(current_user.id)
        .order_by(WishlistItem.id.desc())
        .limit(MAX_WISHLIST_ITEMS_RETURNED)
    ).all()

    return WishlistResponse(
        items=[WishlistItemResponse.model_validate(row) for row in rows]
    )


@router.post(
    "/{product_id}",
    response_model=WishlistItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a product to the wishlist (safe to repeat)",
)
def add_to_wishlist(
    product_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product_exists = db.scalar(
        select(Product.id).where(
            Product.id == product_id,
            Product.is_active.is_(True),
        )
    )

    if product_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    already_saved = db.scalar(
        select(WishlistItem.id).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )

    if already_saved is not None:
        response.status_code = status.HTTP_200_OK
    else:
        db.add(WishlistItem(user_id=current_user.id, product_id=product_id))

        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    row = db.execute(
        _wishlist_query(current_user.id).where(
            WishlistItem.product_id == product_id
        )
    ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return WishlistItemResponse.model_validate(row)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a product from the wishlist (safe to repeat)",
)
def remove_from_wishlist(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        delete(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(status_code=status.HTTP_204_NO_CONTENT)