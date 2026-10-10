import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.user import User
from app.schemas.admin_inventory import (
    AdminInventoryResponse,
    AdminInventoryUpdate,
)
from app.services.dependencies import require_admin
from app.services.notifications import (
    send_low_stock_notification,
    send_out_of_stock_notification,
)
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(
    prefix="/api/admin/inventory",
    tags=["Admin Inventory"],
)

logger = logging.getLogger("app.admin_audit")

LOW_STOCK_THRESHOLD = 5

DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 200

MAX_QUANTITY = 1_000_000


def _available(inventory: Inventory) -> int:
    return inventory.quantity - inventory.reserved_quantity


def _serialize(inventory: Inventory) -> dict:
    return {
        "id": inventory.id,
        "product_id": inventory.product_id,
        "quantity": inventory.quantity,
        "reserved_quantity": inventory.reserved_quantity,
        "available_quantity": _available(inventory),
    }


def _send_alert_safely(sender, **kwargs) -> None:
    try:
        sender(**kwargs)
    except Exception:
        logger.exception("Inventory notification failed")


@router.get("/", response_model=list[AdminInventoryResponse])
def get_inventory(
    response: Response,
    low_stock_only: bool = Query(
        default=False,
        description=f"Only items with {LOW_STOCK_THRESHOLD} or fewer available",
    ),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = []

    if low_stock_only:
        filters.append(
            (Inventory.quantity - Inventory.reserved_quantity) <= LOW_STOCK_THRESHOLD
        )

    total = db.scalar(select(func.count()).select_from(Inventory).where(*filters))

    response.headers["X-Total-Count"] = str(total or 0)

    inventories = db.scalars(
        select(Inventory)
        .where(*filters)
        .order_by(Inventory.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()

    return [_serialize(item) for item in inventories]


@router.patch(
    "/{product_id}",
    response_model=AdminInventoryResponse,
)
def update_inventory(
    product_id: int,
    data: AdminInventoryUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if data.quantity < 0 or data.quantity > MAX_QUANTITY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantity must be between 0 and {MAX_QUANTITY}",
        )
    
    row = db.execute(
        select(Inventory, Product)
        .join(Product, Product.id == Inventory.product_id)
        .where(Inventory.product_id == product_id)
        .with_for_update(of=Inventory)
    ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found",
        )

    inventory, product = row

    if data.quantity < inventory.reserved_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be less than reserved quantity",
        )

    old_quantity = inventory.quantity
    old_available = _available(inventory)

    if data.quantity == old_quantity:
        return _serialize(inventory)

    try:
        inventory.quantity = data.quantity

        new_available = _available(inventory)

        # Save plain values before committing.
        product_name = product.name
        new_quantity = inventory.quantity
        reserved_quantity = inventory.reserved_quantity

        db.commit()
        db.refresh(inventory)

    except SQLAlchemyError:
        db.rollback()

        logger.exception(
            "Failed to update inventory for product_id=%s",
            product_id,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update inventory.",
        )

    logger.info(
        "admin_audit action=update_inventory actor_id=%s product_id=%s "
        "old_quantity=%s new_quantity=%s reserved=%s",
        current_user.id,
        product_id,
        old_quantity,
        new_quantity,
        reserved_quantity,
    )

    if 0 < new_available <= LOW_STOCK_THRESHOLD < old_available:
        background_tasks.add_task(
            _send_alert_safely,
            send_low_stock_notification,
            product_name=product_name,
            available_quantity=new_available,
            quantity=new_quantity,
            reserved_quantity=reserved_quantity,
        )

    elif new_available == 0 and old_available > 0:
        background_tasks.add_task(
            _send_alert_safely,
            send_out_of_stock_notification,
            product_name=product_name,
            quantity=new_quantity,
            reserved_quantity=reserved_quantity,
        )

    return _serialize(inventory)