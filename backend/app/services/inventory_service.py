
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.order_item import OrderItem


def release_order_inventory_reservations(
    order_id: int,
    db: Session,
) -> None:
    """Release the stock reserved for an order, without underflowing stock."""

    items = db.scalars(
        select(OrderItem)
        .where(OrderItem.order_id == order_id)
        .order_by(OrderItem.product_id)
    ).all()

    # Combine quantities in case an order contains duplicate product rows.
    required_by_product: dict[int, int] = {}

    for item in items:
        required_by_product[item.product_id] = (
            required_by_product.get(item.product_id, 0)
            + item.quantity
        )

    locked_inventory: dict[int, Inventory] = {}

    # Lock and validate every inventory row before changing any of them.
    for product_id, required_quantity in sorted(
        required_by_product.items()
    ):
        inventory = db.scalar(
            select(Inventory)
            .where(Inventory.product_id == product_id)
            .with_for_update()
        )

        if (
            inventory is None
            or inventory.reserved_quantity < required_quantity
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Inventory reservation is inconsistent. "
                    "The order was not cancelled and stock was not released."
                ),
            )

        locked_inventory[product_id] = inventory

    for product_id, required_quantity in required_by_product.items():
        locked_inventory[product_id].reserved_quantity -= required_quantity
