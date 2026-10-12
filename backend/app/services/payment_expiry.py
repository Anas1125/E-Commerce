
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment


logger = logging.getLogger(__name__)

UPI_ORDER_EXPIRY_MINUTES = 30
UPI_EXPIRY_SWEEP_INTERVAL_SECONDS = 300
UPI_EXPIRY_BATCH_SIZE = 100


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def expire_unstarted_upi_orders(
    db: Session,
    *,
    now: datetime | None = None,
    batch_size: int = UPI_EXPIRY_BATCH_SIZE,
) -> int:
    """Cancel expired UPI orders only when no Razorpay order was created."""

    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")

    now = _as_utc(now or datetime.now(timezone.utc))
    cutoff = now - timedelta(minutes=UPI_ORDER_EXPIRY_MINUTES)

    candidates = db.scalars(
        select(Order.id)
        .join(Payment, Payment.order_id == Order.id)
        .where(
            Order.created_at <= cutoff,
            Order.order_status == "pending",
            Order.payment_status == "pending",
            Order.payment_method == "upi",
            Payment.payment_gateway == "razorpay",
            Payment.status == "pending",
            Payment.gateway_order_id.is_(None),
            Payment.gateway_order_creation_state == "not_started",
        )
        .order_by(Order.created_at.asc(), Order.id.asc())
        .limit(batch_size)
    ).all()

    expired_count = 0

    for order_id in candidates:
        try:
            # Lock the order first, matching the existing payment flow.
            order = db.scalar(
                select(Order)
                .options(selectinload(Order.items))
                .where(Order.id == order_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )

            if order is None:
                db.rollback()
                continue

            payment = db.scalar(
                select(Payment)
                .where(Payment.order_id == order.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )

            # Re-check eligibility after acquiring the locks.
            if (
                order.created_at is None
                or _as_utc(order.created_at) > cutoff
                or order.order_status != "pending"
                or order.payment_status != "pending"
                or order.payment_method != "upi"
                or payment is None
                or payment.gateway_order_creation_state != "not_started"
                or payment.payment_gateway != "razorpay"
                or payment.status != "pending"
                or payment.gateway_order_id is not None
            ):
                db.rollback()
                continue

            # Aggregate quantities in case an order contains multiple
            # lines for the same product.
            quantities: dict[int, int] = {}

            for item in order.items:
                quantities[item.product_id] = (
                    quantities.get(item.product_id, 0)
                    + item.quantity
                )

            # Lock and validate every inventory row before changing any.
            locked_inventory = {}
            inventory_is_valid = True

            for product_id, quantity in sorted(quantities.items()):
                inventory = db.scalar(
                    select(Inventory)
                    .where(Inventory.product_id == product_id)
                    .with_for_update()
                )

                if (
                    inventory is None
                    or inventory.reserved_quantity < quantity
                ):
                    logger.warning(
                        "Skipping expiry for order %s: reservation "
                        "is inconsistent for product %s",
                        order.id,
                        product_id,
                    )
                    inventory_is_valid = False
                    break

                locked_inventory[product_id] = inventory

            if not inventory_is_valid:
                db.rollback()
                continue

            # Release only the reservations belonging to this order.
            for product_id, quantity in quantities.items():
                locked_inventory[product_id].reserved_quantity -= quantity

            order.order_status = "cancelled"
            order.payment_status = "failed"
            order.cancelled_at = now

            payment.status = "failed"
            payment.failure_code = "checkout_expired"
            payment.failure_reason = (
                "UPI checkout expired after 30 minutes before a "
                "Razorpay order was created."
            )

            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    status="cancelled",
                    note=(
                        "Automatically cancelled after 30 minutes "
                        "because no Razorpay order was created. "
                        "Reserved inventory was released."
                    ),
                )
            )

            db.commit()
            expired_count += 1

            logger.info(
                "Expired unstarted UPI order %s and released its inventory",
                order.id,
            )

        except Exception:
            db.rollback()
            logger.exception(
                "Unable to expire unstarted UPI order %s",
                order_id,
            )

    return expired_count


def run_upi_expiry_sweep() -> int:
    """Run one sweep with its own database session."""
    with SessionLocal() as db:
        return expire_unstarted_upi_orders(db)


async def upi_order_expiry_loop() -> None:
    """Periodically expire unstarted UPI orders while the API is running."""
    while True:
        try:
            expired_count = await asyncio.to_thread(run_upi_expiry_sweep)

            if expired_count:
                logger.info(
                    "UPI expiry sweep cancelled %s abandoned order(s)",
                    expired_count,
                )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception("UPI order expiry sweep failed")

        await asyncio.sleep(UPI_EXPIRY_SWEEP_INTERVAL_SECONDS)
