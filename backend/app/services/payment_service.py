from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment
from app.models.user import User


def create_payment(order_id: int, user: User, db: Session) -> Payment:
    del order_id, user, db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Online payments are not configured.",
    )


def complete_payment(
    payment_id: int,
    gateway_payment_id: str,
    payment_method: str | None,
    user: User,
    db: Session,
) -> Payment:
    del payment_id, gateway_payment_id, payment_method, user, db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Online payment verification is not configured.",
    )


def fail_payment(payment_id: int, user: User, db: Session) -> Payment:
    try:
        payment = db.scalar(
            select(Payment)
            .join(Order, Payment.order_id == Order.id)
            .where(Payment.id == payment_id, Order.user_id == user.id)
        )
        if payment is None:
            raise HTTPException(status_code=404, detail="Payment not found")
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
            raise HTTPException(status_code=404, detail="Order not found")

        for order_item in order.items:
            inventory = db.scalar(
                select(Inventory)
                .where(Inventory.product_id == order_item.product_id)
                .with_for_update()
            )
            if inventory is None or inventory.reserved_quantity < order_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reserved inventory is insufficient",
                )
            inventory.reserved_quantity -= order_item.quantity

        payment.status = "failed"
        order.payment_status = "failed"
        order.order_status = "cancelled"
        db.add(OrderStatusHistory(
            order_id=order.id,
            status="cancelled",
            note="Payment failed",
        ))
        db.commit()
        db.refresh(payment)
        return payment
    except Exception:
        db.rollback()
        raise
