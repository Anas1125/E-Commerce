from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.product_image import ProductImage
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


@router.get("/", response_model=WishlistResponse)
def get_wishlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wishlist_items = db.scalars(
        select(WishlistItem)
        .where(WishlistItem.user_id == current_user.id)
        .order_by(WishlistItem.id.desc())
    ).all()

    items = []

    for wishlist_item in wishlist_items:
        product = wishlist_item.product

        if not product.is_active:
            continue

        primary_image = db.scalar(
            select(ProductImage).where(
                ProductImage.product_id == product.id,
                ProductImage.is_primary == True,
            )
        )

        items.append(
            WishlistItemResponse(
                id=wishlist_item.id,
                product_id=product.id,
                product_name=product.name,
                price=product.price,
                image_url=(
                    primary_image.image_url
                    if primary_image
                    else None
                ),
            )
        )

    return WishlistResponse(items=items)


@router.post(
    "/{product_id}",
    response_model=WishlistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_to_wishlist(
    product_id: int,
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

    existing_item = db.scalar(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )

    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product is already in your wishlist",
        )

    wishlist_item = WishlistItem(
        user_id=current_user.id,
        product_id=product_id,
    )

    db.add(wishlist_item)
    db.commit()
    db.refresh(wishlist_item)

    primary_image = db.scalar(
        select(ProductImage).where(
            ProductImage.product_id == product.id,
            ProductImage.is_primary == True,
        )
    )

    return WishlistItemResponse(
        id=wishlist_item.id,
        product_id=product.id,
        product_name=product.name,
        price=product.price,
        image_url=(
            primary_image.image_url
            if primary_image
            else None
        ),
    )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_from_wishlist(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wishlist_item = db.scalar(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )

    if wishlist_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product is not in your wishlist",
        )

    db.delete(wishlist_item)
    db.commit()