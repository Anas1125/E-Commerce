import os
from datetime import datetime
from decimal import Decimal

import razorpay
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment
from app.models.user import User
from app.services.notifications import (
    send_low_stock_notification,
    send_out_of_stock_notification,
)


RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")


def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay payment gateway is not configured.",
        )

    return razorpay.Client(
        auth=(
            RAZORPAY_KEY_ID,
            RAZORPAY_KEY_SECRET,
        )
    )


def create_payment(
    order_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        order = db.scalar(
            select(Order)
            .options(selectinload(Order.payment))
            .where(
                Order.id == order_id,
                Order.user_id == user.id,
            )
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

        payment = order.payment

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

        # Reuse an existing Razorpay order if one was already created.
        if payment.gateway_order_id:
            return payment

        client = get_razorpay_client()

        amount_in_paise = int(
            (Decimal(str(payment.amount)) * Decimal("100")).quantize(
                Decimal("1")
            )
        )

        razorpay_order = client.order.create(
            {
                "amount": amount_in_paise,
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

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to create Razorpay order: {str(exc)}",
        )


def complete_payment(
    payment_id: int,
    gateway_order_id: str,
    gateway_payment_id: str,
    gateway_signature: str,
    payment_method: str | None,
    user: User,
    db: Session,
) -> Payment:
    try:
        payment = db.scalar(
            select(Payment)
            .join(Order, Payment.order_id == Order.id)
            .where(
                Payment.id == payment_id,
                Order.user_id == user.id,
            )
        )

        if payment is None:
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

        if not payment.gateway_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay order was not created",
            )

        # Never trust the order ID sent by the browser.
        # It must match the order ID stored in our database.
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

        if not gateway_signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay payment signature is required",
            )

        client = get_razorpay_client()

        try:
            client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": gateway_order_id,
                    "razorpay_payment_id": gateway_payment_id,
                    "razorpay_signature": gateway_signature,
                }
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razorpay payment verification failed",
            )

        order = db.scalar(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == payment.order_id)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        # Deduct the actual inventory and release the reservation.
        for order_item in order.items:
            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.product_id == order_item.product_id
                )
                .with_for_update()
            )

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Inventory not found",
                )

            if inventory.reserved_quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reserved inventory is insufficient",
                )

            if inventory.quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient inventory",
                )

            old_available_quantity = (
                inventory.quantity
                - inventory.reserved_quantity
            )

            inventory.quantity -= order_item.quantity
            inventory.reserved_quantity -= order_item.quantity

            new_available_quantity = (
                inventory.quantity
                - inventory.reserved_quantity
            )

            product = db.scalar(
                select(Product).where(
                    Product.id == order_item.product_id
                )
            )

            # Low-stock alert:
            # Only notify when crossing from above 5 to 5 or below,
            # but still above zero.
            if (
                old_available_quantity > 5
                and new_available_quantity <= 5
                and new_available_quantity > 0
                and product is not None
            ):
                send_low_stock_notification(
                    product_name=product.name,
                    available_quantity=new_available_quantity,
                    quantity=inventory.quantity,
                    reserved_quantity=inventory.reserved_quantity,
                )

            # Out-of-stock alert:
            # Only notify when crossing from above zero to zero.
            elif (
                old_available_quantity > 0
                and new_available_quantity == 0
                and product is not None
            ):
                send_out_of_stock_notification(
                    product_name=product.name,
                    quantity=inventory.quantity,
                    reserved_quantity=inventory.reserved_quantity,
                )

        payment.gateway_payment_id = gateway_payment_id
        payment.payment_method = payment_method or "upi"
        payment.status = "paid"
        payment.paid_at = datetime.utcnow()

        order.order_status = "confirmed"
        order.payment_status = "paid"

        # Remove only the items that were actually purchased
        # from the user's cart after successful UPI payment.
        cart = db.scalar(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.user_id == user.id)
        )

        if cart is not None:
            for order_item in order.items:
                for cart_item in list(cart.items):
                    if cart_item.product_id == order_item.product_id:
                        if cart_item.quantity <= order_item.quantity:
                            db.delete(cart_item)
                        else:
                            cart_item.quantity -= order_item.quantity
                        break

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status=order.order_status,
                note="UPI payment completed and verified through Razorpay",
            )
        )

        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

def fail_payment(
    payment_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        payment = db.scalar(
            select(Payment)
            .join(Order, Payment.order_id == Order.id)
            .where(
                Payment.id == payment_id,
                Order.user_id == user.id,
            )
        )

        if payment is None:
            raise HTTPException(
                status_code=404,
                detail="Payment not found",
            )

        if payment.payment_gateway == "cod":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cash on Delivery cannot be failed through the online payment endpoint",
            )

        if payment.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid payment cannot be marked as failed",
            )

        if payment.status == "failed":
            return payment

        order = db.scalar(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == payment.order_id)
        )

        if order is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found",
            )

        for order_item in order.items:
            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.product_id == order_item.product_id
                )
                .with_for_update()
            )

            if inventory is None or (
                inventory.reserved_quantity
                < order_item.quantity
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reserved inventory is insufficient",
                )

            inventory.reserved_quantity -= order_item.quantity

        payment.status = "failed"
        order.payment_status = "failed"
        order.order_status = "cancelled"

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status="cancelled",
                note="UPI payment failed or was cancelled",
            )
        )

        db.commit()
        db.refresh(payment)

        return payment

    except Exception:
        db.rollback()
        raise