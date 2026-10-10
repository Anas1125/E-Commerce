from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

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
        select(Cart).where(Cart.user_id == user.id).with_for_update()
    )

    if cart is not None:
        return cart

    try:
        with db.begin_nested():
            cart = Cart(user_id=user.id)
            db.add(cart)
    except IntegrityError:
        cart = db.scalar(
            select(Cart).where(Cart.user_id == user.id).with_for_update()
        )

        if cart is None:
            raise

    return cart


def build_cart_response(cart: Cart) -> CartResponse:
    items = []
    subtotal = Decimal("0.00")

    for item in sorted(cart.items, key=lambda cart_item: cart_item.id):
        product = item.product
        if product is None or not product.is_active:
            continue

        line_total = product.price * item.quantity
        subtotal += line_total

        items.append(
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                product_name=product.name,
                unit_price=product.price,
                line_total=line_total,
            )
        )

    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        items=items,
        subtotal=subtotal,
    )


def _load_cart_response(db: Session, cart_id: int) -> CartResponse:
    cart = db.scalar(
        select(Cart)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .where(Cart.id == cart_id)
        .execution_options(populate_existing=True)
    )

    if cart is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart not found",
        )

    return build_cart_response(cart)



def _available_quantity(inventory: Inventory) -> int:
    return max(0, inventory.quantity - inventory.reserved_quantity)


@router.get("/", response_model=CartResponse)
def get_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)
    cart_id = cart.id

    db.execute(
        delete(CartItem).where(
            CartItem.cart_id == cart_id,
            CartItem.product_id.in_(
                select(Product.id).where(Product.is_active.is_(False))
            ),
        )
    )

    db.commit()

    return _load_cart_response(db, cart_id)


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
    if item_data.quantity < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be at least 1",
        )

    product = db.scalar(
        select(Product).where(
            Product.id == item_data.product_id,
            Product.is_active.is_(True),
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    inventory = db.scalar(
        select(Inventory).where(Inventory.product_id == product.id)
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product inventory is not available",
        )

    available_quantity = _available_quantity(inventory)

    cart = get_or_create_cart(current_user, db)
    cart_id = cart.id

    existing_item = db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart_id,
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
        db.add(
            CartItem(
                cart_id=cart_id,
                product_id=product.id,
                quantity=item_data.quantity,
            )
        )

    db.commit()

    return _load_cart_response(db, cart_id)


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
    if item_data.quantity < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be at least 1",
        )

    cart = get_or_create_cart(current_user, db)
    cart_id = cart.id

    item = db.scalar(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart_id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    inventory = db.scalar(
        select(Inventory).where(Inventory.product_id == item.product_id)
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product inventory is not available",
        )

    available_quantity = _available_quantity(inventory)

    if item_data.quantity > available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {available_quantity} items are available",
        )

    item.quantity = item_data.quantity

    db.commit()

    return _load_cart_response(db, cart_id)


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
    cart_id = cart.id

    item = db.scalar(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart_id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )

    db.delete(item)
    db.commit()

    return _load_cart_response(db, cart_id)


@router.delete(
    "/",
    status_code=status.HTTP_204_NO_CONTENT,
)
def clear_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = get_or_create_cart(current_user, db)

    db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))

    db.commit()