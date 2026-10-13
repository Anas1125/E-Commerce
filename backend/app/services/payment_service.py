import logging
import os
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from html import escape

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
    send_admin_notification,
    send_customer_notification,
    send_low_stock_notification,
    send_out_of_stock_notification,
)
from app.services.inventory_service import (
    release_order_inventory_reservations,
)

logger = logging.getLogger(__name__)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

LOW_STOCK_THRESHOLD = 5
_REFUNDED_STATUSES = {"refunded", "partially_refunded"}


def _notify_payment_succeeded(order: Order, user: User) -> None:
    """Send order confirmation emails after a successful payment commit."""
    try:
        order_number = escape(order.order_number)
        customer_name = escape(
            " ".join(filter(None, [user.first_name, user.last_name]))
            or "Customer"
        )
        amount = f"₹{order.total_amount:,.2f}"

        items_html = "".join(
            f"""
            <tr>
                <td>{escape(item.product_name)}</td>
                <td>{item.quantity}</td>
                <td>₹{item.final_price:,.2f}</td>
            </tr>
            """
            for item in order.items
        )

        send_admin_notification(
            subject=f"New paid TerraLens order — {order.order_number}",
            html=f"""
                <h2>New paid order</h2>
                <p><b>Order:</b> {order_number}</p>
                <p><b>Customer:</b> {customer_name}</p>
                <p><b>Email:</b> {escape(user.email)}</p>
                <p><b>Total:</b> {amount}</p>
                <table>
                    <thead>
                        <tr><th>Product</th><th>Qty</th><th>Amount</th></tr>
                    </thead>
                    <tbody>{items_html}</tbody>
                </table>
            """,
            text=(
                f"New paid order: {order.order_number}\n"
                f"Customer: {user.email}\nTotal: {amount}"
            ),
        )

        recipient = (order.contact_email or user.email or "").strip()

        send_customer_notification(
            email=recipient,
            subject=f"Order confirmed — {order.order_number}",
            html=f"""
                <h2>Thank you for your order, {customer_name}!</h2>
                <p>Your payment has been verified successfully.</p>
                <p><b>Order:</b> {order_number}</p>
                <p><b>Total paid:</b> {amount}</p>
                <p>We'll keep you updated as your order progresses.</p>
            """,
            text=(
                f"Thank you for your order, {user.first_name}!\n"
                f"Order: {order.order_number}\n"
                f"Total paid: {amount}\n"
                "Your payment has been verified successfully."
            ),
        )

    except Exception:
        logger.exception(
            "Order confirmation notification failed for order %s",
            order.id,
        )


def _notify_payment_failed_admin(
    order: Order,
    payment: Payment,
    user: User,
) -> None:
    """Alert the admin about a verified failed payment attempt."""
    try:
        reason = (
            payment.failure_reason
            or "The payment provider could not complete the payment."
        )

        safe_order = escape(order.order_number)
        safe_email = escape(user.email or "Not provided")
        safe_reason = escape(reason)
        amount = f"₹{order.total_amount:,.2f}"

        send_admin_notification(
            subject=f"Payment attempt failed — {order.order_number}",
            html=f"""
                <h2>Payment attempt failed</h2>
                <p><b>Order:</b> {safe_order}</p>
                <p><b>Customer:</b> {safe_email}</p>
                <p><b>Amount:</b> {amount}</p>
                <p><b>Reason reported:</b> {safe_reason}</p>
                <p>The payment status was verified with Razorpay.</p>
            """,
            text=(
                f"Payment attempt failed: {order.order_number}\n"
                f"Customer: {user.email or 'Not provided'}\n"
                f"Amount: {amount}\n"
                f"Reason: {reason}"
            ),
        )

    except Exception:
        logger.exception(
            "Failed to send payment failure alert for order %s",
            order.id,
        )


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
    if _amount_to_paise(payment.amount) != _amount_to_paise(
        order.total_amount
    ):
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
            if payment.gateway_order_creation_state != "created":
                payment.gateway_order_creation_state = "created"
                db.commit()
                db.refresh(payment)

            return payment

        if payment.gateway_order_creation_state != "not_started":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "We could not confirm whether your payment setup "
                    "completed. Do not start another payment attempt. "
                    "Please contact support for reconciliation."
                ),
            )

        client = get_razorpay_client()

        amount_paise = _amount_to_paise(payment.amount)
        currency = payment.currency
        receipt = order.order_number
        order_id_value = str(order.id)
        order_number_value = order.order_number

        payment.gateway_order_creation_state = "attempting"
        db.commit()

        razorpay_order = client.order.create(
            {
                "amount": amount_paise,
                "currency": currency,
                "receipt": receipt,
                "notes": {
                    "order_id": order_id_value,
                    "order_number": order_number_value,
                },
            }
        )

        gateway_order_id = razorpay_order.get("id")

        if (
            not isinstance(gateway_order_id, str)
            or not gateway_order_id.strip()
        ):
            raise RuntimeError(
                "Razorpay order creation response did not contain a valid ID"
            )

        payment.gateway_order_id = gateway_order_id
        payment.gateway_order_creation_state = "created"

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

        if payment.status in _REFUNDED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refunded payment cannot be completed",
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
                    detail=(
                        f"Inventory not found for '{order_item.product_name}'"
                    ),
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

        _notify_payment_succeeded(order, user)

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

        already_failed = (
            payment.status == "failed"
            and order.payment_status == "failed"
        )

        if payment.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Paid payment cannot be marked as failed",
            )

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
            gateway_result = client.order.payments(
                payment.gateway_order_id
            )

        except Exception as exc:
            logger.exception("Unable to retrieve Razorpay order payments")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to verify payment status with Razorpay",
            ) from exc

        gateway_attempts = gateway_result.get("items", [])

        setattr(payment, "_cancellation_safe", False)

        captured_attempts = [
            attempt
            for attempt in gateway_attempts
            if attempt.get("status") == "captured" and attempt.get("id")
        ]

        if len(captured_attempts) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Multiple captured payments require manual reconciliation."
                ),
            )

        if captured_attempts:
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

        # All attempts are confirmed failed by Razorpay.
        # Do not release inventory a second time if the order was cancelled.
        was_already_cancelled = order.order_status == "cancelled"

        latest_attempt = gateway_attempts[-1]

        failure_reason = (
            latest_attempt.get("error_description")
            or latest_attempt.get("error_reason")
            or latest_attempt.get("error_code")
            or "Razorpay confirmed that all payment attempts failed."
        )

        failure_code = latest_attempt.get("error_code") or "payment_failed"

        payment.status = "failed"
        order.payment_status = "failed"
        payment.failure_code = failure_code
        payment.failure_reason = str(failure_reason)[:1000]

        if not was_already_cancelled:
            release_order_inventory_reservations(order.id, db)

            order.order_status = "cancelled"

            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    status="cancelled",
                    note=(
                        "Cancelled after Razorpay confirmed all payment "
                        "attempts failed. Reserved inventory released."
                    ),
                )
            )

        db.commit()
        db.refresh(payment)

        if not was_already_cancelled:
            db.refresh(order)

        if not already_failed:
            _notify_payment_failed_admin(order, payment, user)

        if not was_already_cancelled:
            from app.services.order_service import (
                _notify_customer_order_status,
            )

            _notify_customer_order_status(
                order,
                "cancelled",
                user=user,
            )

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


def retry_payment(
    payment_id: int,
    user: User,
    db: Session,
) -> Payment:
    """Safely prepare an existing UPI order for another payment attempt."""
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

        if (
            payment.payment_gateway != "razorpay"
            or order.payment_method != "upi"
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Retry is only available for Razorpay UPI orders",
            )

        if payment.status in _REFUNDED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A refunded payment cannot be retried",
            )

        if payment.status == "paid" and order.payment_status == "paid":
            return payment

        if payment.status == "paid" or order.payment_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Payment and order statuses do not match. "
                    "Retry is blocked until the payment is reconciled."
                ),
            )

        if order.order_status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This order has been cancelled",
            )

        if not payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The Razorpay order is missing; "
                    "payment cannot be retried safely"
                ),
            )

        _ensure_amount_matches(order, payment)

        client = get_razorpay_client()

        try:
            gateway_order = client.order.fetch(payment.gateway_order_id)
            gateway_result = client.order.payments(payment.gateway_order_id)

        except Exception as exc:
            logger.exception("Unable to verify Razorpay order before retry")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Unable to verify payment status with Razorpay. "
                    "Please try again shortly."
                ),
            ) from exc

        attempts = gateway_result.get("items", [])

        captured_attempts = [
            attempt
            for attempt in attempts
            if attempt.get("status") == "captured" and attempt.get("id")
        ]

        if len(captured_attempts) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Multiple captured payments require manual reconciliation"
                ),
            )

        if captured_attempts:
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

        gateway_status = gateway_order.get("status")

        if gateway_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Razorpay reports a paid order but no captured payment "
                    "was returned. Please check payment status again."
                ),
            )

        if gateway_status not in {"created", "attempted"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Razorpay order is not in a retryable state",
            )

        if not attempts:
            if gateway_status != "created":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Payment attempts could not be verified. "
                        "Please check status again before retrying."
                    ),
                )

        elif any(
            attempt.get("status") != "failed"
            for attempt in attempts
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A payment attempt may still be processing. "
                    "Check payment status before retrying."
                ),
            )

        payment.status = "pending"
        payment.failure_code = None
        payment.failure_reason = None
        order.payment_status = "pending"

        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Unable to prepare payment retry")

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to prepare payment retry",
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
                detail=(
                    "Razorpay order is missing; "
                    "payment status is unresolved"
                ),
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
            if attempts and all(
                attempt.get("status") == "failed"
                for attempt in attempts
            ):
                failed_payment = fail_payment(
                    payment_id=payment.id,
                    user=user,
                    db=db,
                )
                setattr(failed_payment, "_cancellation_safe", True)
                return failed_payment

            if not attempts:
                try:
                    gateway_order = client.order.fetch(
                        payment.gateway_order_id
                    )
                except Exception:
                    logger.warning(
                        "Unable to verify Razorpay order status for cancellation "
                        "eligibility; payment_id=%s",
                        payment.id,
                    )
                else:
                    if gateway_order.get("status") == "created":
                        setattr(payment, "_cancellation_safe", True)
                        return payment

            setattr(payment, "_cancellation_safe", False)
            return payment

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