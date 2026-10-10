import logging
import os
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

import razorpay
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment
from app.models.product import Product
from app.models.user import User
from app.services.notifications import (
    send_low_stock_notification,
    send_out_of_stock_notification,
)

logger = logging.getLogger(__name__)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

LOW_STOCK_THRESHOLD = 5

_REFUNDED_STATUSES = {"refunded", "partially_refunded"}


def get_razorpay_client():

    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay payment gateway is not configured.",
        )

    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def _amount_to_paise(amount) -> int:

    return int(
        (Decimal(str(amount)) * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def _lock_order_then_payment(
    db: Session,
    *,
    user: User,
    order_id: int | None = None,
    payment_id: int | None = None,
) -> tuple[Order | None, Payment | None]:

    if order_id is None:

        order_id = db.scalar(
            select(Payment.order_id)
            .join(Order, Payment.order_id == Order.id)
            .where(
                Payment.id == payment_id,
                Order.user_id == user.id,
            )
        )

        if order_id is None:
            return None, None

    order = db.scalar(
        select(Order)
        .where(
            Order.id == order_id,
            Order.user_id == user.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    if order is None:
        return None, None

    payment = db.scalar(
        select(Payment)
        .where(Payment.order_id == order.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    return order, payment


def _ensure_amount_matches(order: Order, payment: Payment) -> None:
    if _amount_to_paise(payment.amount) != _amount_to_paise(order.total_amount):
        logger.error(
            "Payment %s amount does not match order %s total",
            payment.id,
            order.id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment amount does not match the order total",
        )


def create_payment(
    order_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        order, payment = _lock_order_then_payment(
            db,
            user=user,
            order_id=order_id,
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if order.payment_method != "upi":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Online payment is only available for UPI orders",
            )

        if order.payment_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order is already paid",
            )

        if order.order_status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot pay for a cancelled order",
            )

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment record not found",
            )

        if payment.payment_gateway != "razorpay":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment gateway",
            )

        if payment.status in {"paid", "failed"} | _REFUNDED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This payment cannot be initiated",
            )

        _ensure_amount_matches(order, payment)

        if payment.gateway_order_id:
            return payment

        client = get_razorpay_client()

        razorpay_order = client.order.create(
            {
                "amount": _amount_to_paise(payment.amount),
                "currency": payment.currency,
                "receipt": order.order_number,
                "notes": {
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                },
            }
        )

        payment.gateway_order_id = razorpay_order["id"]

        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unable to create Razorpay order")

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to create Razorpay order. Please try again.",
        ) from exc


def complete_payment(
    payment_id: int,
    gateway_order_id: str,
    gateway_payment_id: str,
    gateway_signature: str | None,
    payment_method: str | None,  
    user: User,
    db: Session,
    *,
    verify_signature: bool = True,
) -> Payment:
    """Verify a captured Razorpay payment and finalize the order atomically."""
    inventory_alerts = []

    try:
        order, payment = _lock_order_then_payment(
            db,
            user=user,
            payment_id=payment_id,
        )

        if order is None or payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        if payment.payment_gateway != "razorpay":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment gateway",
            )

        if payment.status == "paid":
            return payment

        if payment.status == "failed" or payment.status in _REFUNDED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This payment cannot be completed",
            )

        if not payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay order was not created",
            )

        if gateway_order_id != payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay order ID",
            )

        if not gateway_payment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay payment ID is required",
            )

        client = get_razorpay_client()

        if verify_signature:
            if not gateway_signature:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Razorpay payment signature is required",
                )

            try:
                client.utility.verify_payment_signature(
                    {
                        "razorpay_order_id": gateway_order_id,
                        "razorpay_payment_id": gateway_payment_id,
                        "razorpay_signature": gateway_signature,
                    }
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Razorpay payment verification failed",
                ) from exc

        try:
            gateway_payment = client.payment.fetch(gateway_payment_id)
        except Exception as exc:
            logger.exception("Unable to fetch Razorpay payment")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to verify payment with Razorpay",
            ) from exc

        expected_amount_paise = _amount_to_paise(payment.amount)

        if (
            gateway_payment.get("id") != gateway_payment_id
            or gateway_payment.get("order_id") != payment.gateway_order_id
            or gateway_payment.get("amount") != expected_amount_paise
            or gateway_payment.get("currency") != payment.currency
            or gateway_payment.get("status") != "captured"
            or gateway_payment.get("captured") is not True
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Razorpay payment is not captured "
                    "or does not match the order"
                ),
            )

        if order.order_status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The order is cancelled but Razorpay reports "
                    "a captured payment. Reconciliation is required."
                ),
            )

        if order.payment_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order is already marked as paid",
            )

        _ensure_amount_matches(order, payment)


        order = db.scalar(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order.id)
            .execution_options(populate_existing=True)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        for order_item in sorted(order.items, key=lambda i: i.product_id):
            inventory = db.scalar(
                select(Inventory)
                .where(Inventory.product_id == order_item.product_id)
                .with_for_update()
            )

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Inventory not found for '{order_item.product_name}'",
                )

            if inventory.reserved_quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Reserved inventory is insufficient for "
                        f"'{order_item.product_name}'"
                    ),
                )

            if inventory.quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Insufficient inventory for "
                        f"'{order_item.product_name}'"
                    ),
                )

            old_available_quantity = (
                inventory.quantity - inventory.reserved_quantity
            )

            inventory.quantity -= order_item.quantity
            inventory.reserved_quantity -= order_item.quantity

            new_available_quantity = (
                inventory.quantity - inventory.reserved_quantity
            )


            is_low_stock = (
                old_available_quantity > LOW_STOCK_THRESHOLD
                and 0 < new_available_quantity <= LOW_STOCK_THRESHOLD
            )
            is_out_of_stock = (
                old_available_quantity > 0 and new_available_quantity == 0
            )

            if is_low_stock or is_out_of_stock:
                product = db.get(Product, order_item.product_id)

                if product is not None:
                    alert = {
                        "type": "low_stock" if is_low_stock else "out_of_stock",
                        "product_name": product.name,
                        "quantity": inventory.quantity,
                        "reserved_quantity": inventory.reserved_quantity,
                    }

                    if is_low_stock:
                        alert["available_quantity"] = new_available_quantity

                    inventory_alerts.append(alert)

        payment.gateway_payment_id = gateway_payment_id
        payment.payment_method = gateway_payment.get("method") or "upi"
        payment.status = "paid"
        payment.paid_at = datetime.now(timezone.utc)

        order.order_status = "confirmed"
        order.payment_status = "paid"

        cart = db.scalar(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.user_id == user.id)
        )

        if cart is not None:
            cart_items_by_product = {
                cart_item.product_id: cart_item for cart_item in cart.items
            }

            for order_item in order.items:
                cart_item = cart_items_by_product.get(order_item.product_id)

                if cart_item is None:
                    continue

                if cart_item.quantity <= order_item.quantity:
                    db.delete(cart_item)
                else:
                    cart_item.quantity -= order_item.quantity

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status="confirmed",
                note="UPI payment completed and verified through Razorpay",
            )
        )

        db.commit()
        db.refresh(payment)

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while completing payment")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete payment processing",
        ) from exc

    for alert in inventory_alerts:
        try:
            if alert["type"] == "low_stock":
                send_low_stock_notification(
                    product_name=alert["product_name"],
                    available_quantity=alert["available_quantity"],
                    quantity=alert["quantity"],
                    reserved_quantity=alert["reserved_quantity"],
                )

            elif alert["type"] == "out_of_stock":
                send_out_of_stock_notification(
                    product_name=alert["product_name"],
                    quantity=alert["quantity"],
                    reserved_quantity=alert["reserved_quantity"],
                )

        except Exception:
            logger.exception(
                "Failed to send inventory notification for %s",
                alert["product_name"],
            )

    return payment


def fail_payment(
    payment_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        order, payment = _lock_order_then_payment(
            db,
            user=user,
            payment_id=payment_id,
        )

        if order is None or payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        if payment.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Paid payment cannot be marked as failed",
            )

        if payment.status == "failed":
            return payment

        if payment.status in _REFUNDED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Refunded payment cannot be marked as failed",
            )

        if payment.payment_gateway != "razorpay":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint only supports Razorpay payments",
            )

        if not payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Razorpay order is missing; payment status is unresolved",
            )

        if order.payment_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order is already marked as paid",
            )

        client = get_razorpay_client()

        try:
            gateway_result = client.order.payments(payment.gateway_order_id)
        except Exception as exc:
            logger.exception("Unable to retrieve Razorpay order payments")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to verify payment status with Razorpay",
            ) from exc

        gateway_attempts = gateway_result.get("items", [])

        if not gateway_attempts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Razorpay has no confirmed failed payment attempt. "
                    "The order remains pending until its status is verified."
                ),
            )

        if any(
            attempt.get("status") != "failed"
            for attempt in gateway_attempts
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A Razorpay payment attempt is not confirmed failed. "
                    "The order and inventory have not been cancelled."
                ),
            )

        if order.order_status == "cancelled":
            logger.warning(
                "Order %s already cancelled; marking payment %s failed "
                "without releasing inventory",
                order.id,
                payment.id,
            )

            payment.status = "failed"
            order.payment_status = "failed"

            db.commit()
            db.refresh(payment)

            return payment

        order = db.scalar(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order.id)
            .execution_options(populate_existing=True)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )


        for order_item in sorted(order.items, key=lambda i: i.product_id):
            inventory = db.scalar(
                select(Inventory)
                .where(Inventory.product_id == order_item.product_id)
                .with_for_update()
            )

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Inventory not found for '{order_item.product_name}'",
                )

            if inventory.reserved_quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Reserved inventory is insufficient for "
                        f"'{order_item.product_name}'"
                    ),
                )

            inventory.reserved_quantity -= order_item.quantity

        payment.status = "failed"
        order.payment_status = "failed"
        order.order_status = "cancelled"

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status="cancelled",
                note="Razorpay confirmed all payment attempts failed",
            )
        )

        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while failing payment")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update payment status",
        ) from exc

def reconcile_payment_status(
    payment_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        order, payment = _lock_order_then_payment(
            db,
            user=user,
            payment_id=payment_id,
        )

        if order is None or payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
            )

        if payment.payment_gateway != "razorpay":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint only supports Razorpay payments",
            )

        if payment.status == "paid":
            return payment

        if payment.status in _REFUNDED_STATUSES:
            return payment

        if not payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Razorpay order is missing; payment status is unresolved",
            )

        client = get_razorpay_client()

        try:
            gateway_result = client.order.payments(
                payment.gateway_order_id
            )
        except Exception as exc:
            logger.exception("Unable to retrieve Razorpay payment status")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to verify payment status with Razorpay",
            ) from exc

        attempts = gateway_result.get("items", [])

        captured_attempts = [
            attempt
            for attempt in attempts
            if attempt.get("status") == "captured"
            and attempt.get("id")
        ]

        if len(captured_attempts) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Multiple captured payments were found. "
                    "Manual reconciliation is required."
                ),
            )

        if not captured_attempts:
            return payment

        if payment.status == "failed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Razorpay reports a captured payment, but the local "
                    "payment is marked failed. Manual reconciliation is required."
                ),
            )

        gateway_payment = captured_attempts[0]

        return complete_payment(
            payment_id=payment.id,
            gateway_order_id=payment.gateway_order_id,
            gateway_payment_id=gateway_payment["id"],
            gateway_signature=None,
            payment_method=gateway_payment.get("method"),
            user=user,
            db=db,
            verify_signature=False,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error while reconciling payment status")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reconcile payment status",
        ) from exc