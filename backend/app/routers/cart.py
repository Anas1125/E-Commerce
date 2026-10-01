from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.user import User
from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
)
from app.services.dependencies import get_current_user


router = APIRouter(
    prefix="/api/cart",
    tags=["Cart"],
)


def get_or_create_cart(
    user: User,
    db: Session,
) -> Cart:
    cart = db.scalar(
        select(Cart).where(Cart.user_id == user.id)
    )

    if cart is None:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.flush()

    return cart


def build_cart_response(cart: Cart) -> CartResponse:
    items = []
    subtotal = Decimal("0.00")

    for item in cart.items:
        line_total = item.product.price * item.quantity
        subtotal += line_total

        items.append(
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                product_name=item.product.name,
                unit_price=item.product.price,
                line_total=line_total,
            )
        )

    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        items=items,
        subtotal=subtotal,
    )


@router.get("/", response_model=CartResponse)
def get_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_cart_item(
    item_data: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == item_data.product_id,
            Product.is_active == True,
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    inventory = db.scalar(
        select(Inventory).where(
            Inventory.product_id == product.id
        )
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product inventory is not available",
        )

    available_quantity = (
        inventory.quantity - inventory.reserved_quantity
    )

    cart = get_or_create_cart(current_user, db)

    existing_item = db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product.id,
        )
    )

    new_quantity = item_data.quantity

    if existing_item:
        new_quantity += existing_item.quantity

    if new_quantity > available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {available_quantity} items are available",
        )

    if existing_item:
        existing_item.quantity = new_quantity
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=item_data.quantity,
        )

        db.add(cart_item)

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


@router.put(
    "/items/{item_id}",
    response_model=CartResponse,
)
def update_cart_item(
    item_id: int,
    item_data: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)

    item = db.scalar(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    inventory = db.scalar(
        select(Inventory).where(
            Inventory.product_id == item.product_id
        )
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product inventory is not available",
        )

    available_quantity = (
        inventory.quantity - inventory.reserved_quantity
    )

    if item_data.quantity > available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {available_quantity} items are available",
        )

    item.quantity = item_data.quantity

    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


@router.delete(
    "/items/{item_id}",
    response_model=CartResponse,
)
def remove_cart_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)

    item = db.scalar(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    db.delete(item)
    db.commit()
    db.refresh(cart)

    return build_cart_response(cart)


@router.delete(
    "/",
    status_code=status.HTTP_204_NO_CONTENT,
)
def clear_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)

    for item in list(cart.items):
        db.delete(item)

    db.commit()