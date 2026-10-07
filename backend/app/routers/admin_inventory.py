from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.user import User
from app.services.notifications import (
    send_low_stock_notification,
    send_out_of_stock_notification,
)
from app.schemas.admin_inventory import (
    AdminInventoryResponse,
    AdminInventoryUpdate,
)
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/inventory",
    tags=["Admin Inventory"],
)


@router.get("/", response_model=list[AdminInventoryResponse])
def get_inventory(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    inventories = db.scalars(
        select(Inventory).order_by(Inventory.id.asc())
    ).all()

    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "reserved_quantity": item.reserved_quantity,
            "available_quantity": item.quantity - item.reserved_quantity,
        }
        for item in inventories
    ]


@router.patch(
    "/{product_id}",
    response_model=AdminInventoryResponse,
)
def update_inventory(
    product_id: int,
    data: AdminInventoryUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    inventory = db.scalar(
        select(Inventory).where(
            Inventory.product_id == product_id
        )
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found",
        )

    if data.quantity < inventory.reserved_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be less than reserved quantity",
        )

    product = db.scalar(
        select(Product).where(
            Product.id == product_id
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    old_available_quantity = (
        inventory.quantity - inventory.reserved_quantity
    )

    inventory.quantity = data.quantity

    new_available_quantity = (
        inventory.quantity - inventory.reserved_quantity
    )

    db.commit()
    db.refresh(inventory)

    # Send inventory alert only when a threshold is crossed.
    if (
        old_available_quantity > 5
        and new_available_quantity <= 5
        and new_available_quantity > 0
    ):
        send_low_stock_notification(
            product_name=product.name,
            available_quantity=new_available_quantity,
            quantity=inventory.quantity,
            reserved_quantity=inventory.reserved_quantity,
        )

    elif (
        old_available_quantity > 0
        and new_available_quantity == 0
    ):
        send_out_of_stock_notification(
            product_name=product.name,
            quantity=inventory.quantity,
            reserved_quantity=inventory.reserved_quantity,
        )

    return {
        "id": inventory.id,
        "product_id": inventory.product_id,
        "quantity": inventory.quantity,
        "reserved_quantity": inventory.reserved_quantity,
        "available_quantity": new_available_quantity,
    }