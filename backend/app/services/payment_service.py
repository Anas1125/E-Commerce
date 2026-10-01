from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment
from app.models.user import User


def create_payment(
    order_id: int,
    user: User,
    db: Session,
) -> Payment:
    try:
        order = db.scalar(
            select(Order).where(
                Order.id == order_id,
                Order.user_id == user.id,
            )
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if order.payment_status == "paid":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order has already been paid",
            )

        existing_payment = db.scalar(
            select(Payment).where(
                Payment.order_id == order.id,
                Payment.status == "pending",
            )
        )

        if existing_payment is not None:
            return existing_payment

        payment = Payment(
            order_id=order.id,
            payment_gateway="razorpay",
            amount=order.total_amount,
            currency="INR",
            status="pending",
        )

        db.add(payment)
        db.commit()
        db.refresh(payment)

        return payment

    except Exception:
        db.rollback()
        raise


def complete_payment(
    payment_id: int,
    gateway_payment_id: str,
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

        if payment.status == "paid":
            return payment

        if payment.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment cannot be completed",
            )

        order = db.scalar(
            select(Order)
            .options(
                selectinload(Order.items)
            )
            .where(Order.id == payment.order_id)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        inventory_items = []

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

            inventory_items.append(
                (inventory, order_item.quantity)
            )

        for inventory, quantity in inventory_items:
            inventory.quantity -= quantity
            inventory.reserved_quantity -= quantity

        payment.status = "paid"
        payment.gateway_payment_id = gateway_payment_id
        payment.payment_method = payment_method
        payment.paid_at = datetime.utcnow()

        order.payment_status = "paid"
        order.order_status = "confirmed"

        status_history = OrderStatusHistory(
            order_id=order.id,
            status="confirmed",
            note="Payment completed successfully",
        )

        db.add(status_history)

        db.commit()
        db.refresh(payment)

        return payment

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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found",
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
            .options(
                selectinload(Order.items)
            )
            .where(Order.id == payment.order_id)
        )

        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
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

            inventory.reserved_quantity -= order_item.quantity

        payment.status = "failed"

        order.payment_status = "failed"
        order.order_status = "cancelled"

        status_history = OrderStatusHistory(
            order_id=order.id,
            status="cancelled",
            note="Payment failed",
        )

        db.add(status_history)

        db.commit()
        db.refresh(payment)

        return payment

    except Exception:
        db.rollback()
        raise