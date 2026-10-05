from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.address import Address
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.discount import Discount
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_status_history import OrderStatusHistory
from app.models.product import Product
from app.models.payment import Payment
from app.models.user import User
from app.schemas.order import OrderCreate
from app.models.coupon import Coupon
from app.models.coupon_usage import CouponUsage
from app.services.notifications import send_admin_notification

def generate_order_number() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(3).upper()

    return f"TL-{timestamp}-{random_part}"


def calculate_discount(
    product: Product,
    price: Decimal,
    db: Session,
) -> Decimal:
    now = datetime.utcnow()

    discounts = db.scalars(
        select(Discount).where(
            Discount.is_active == True,
            Discount.start_date <= now,
            Discount.end_date >= now,
            (
                (Discount.product_id == product.id)
                | (Discount.product_id.is_(None))
            ),
        )
    ).all()

    if not discounts:
        return Decimal("0.00")

    highest_discount = Decimal("0.00")

    for discount in discounts:
        if discount.discount_type == "percentage":
            amount = (
                price * discount.value / Decimal("100")
            )
        else:
            amount = discount.value

        amount = min(amount, price)

        if amount > highest_discount:
            highest_discount = amount

    return highest_discount.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def create_order(
    user: User,
    order_data: OrderCreate,
    db: Session,
) -> Order:

    if order_data.payment_method != "cod":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Online payments are not configured. Choose Cash on Delivery.",
        )

    try:
        address = db.scalar(
            select(Address).where(
                Address.id == order_data.shipping_address_id,
                Address.user_id == user.id,
            )
        )

        if address is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shipping address not found",
            )

        cart = db.scalar(
            select(Cart)
            .options(
                selectinload(Cart.items)
                .selectinload(CartItem.product)
            )
            .where(Cart.user_id == user.id)
        )

        if cart is None or not cart.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty",
            )

        subtotal = Decimal("0.00")
        total_discount = Decimal("0.00")
        order_items = []

        for cart_item in cart.items:
            product = cart_item.product

            if not product.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product '{product.name}' is no longer available",
                )

            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.product_id == product.id
                )
                .with_for_update()
            )

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inventory unavailable for '{product.name}'",
                )

            available_quantity = (
                inventory.quantity - inventory.reserved_quantity
            )

            if cart_item.quantity > available_quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Only {available_quantity} units of "
                        f"'{product.name}' are available"
                    ),
                )

            unit_price = product.price

            line_subtotal = (
                unit_price * cart_item.quantity
            )

            item_discount = calculate_discount(
                product,
                unit_price,
                db,
            )

            line_discount = (
                item_discount * cart_item.quantity
            )

            final_price = (
                unit_price - item_discount
            )

            subtotal += line_subtotal
            total_discount += line_discount

            order_items.append(
                {
                    "product": product,
                    "quantity": cart_item.quantity,
                    "unit_price": unit_price,
                    "discount_amount": line_discount,
                    "final_price": final_price,
                }
            )

        coupon_discount = Decimal("0.00")
        coupon = None

        if order_data.coupon_code:
            coupon_code = order_data.coupon_code.strip().upper()

            coupon = db.scalar(
                select(Coupon)
                .where(
                    Coupon.code == coupon_code,
                    Coupon.is_active == True,
                )
                .with_for_update()
            )

            if coupon is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or inactive coupon",
                )

            now = datetime.utcnow()

            if now < coupon.start_date or now > coupon.end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Coupon is expired or not yet active",
                )

            if (
                coupon.usage_limit is not None
                and coupon.used_count >= coupon.usage_limit
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Coupon usage limit has been reached",
                )

            user_coupon_usage_count = db.scalar(
                select(func.count(CouponUsage.id)).where(
                    CouponUsage.coupon_id == coupon.id,
                    CouponUsage.user_id == user.id,
                )
            ) or 0

            if (
                coupon.per_user_limit is not None
                and user_coupon_usage_count >= coupon.per_user_limit
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have reached the usage limit for this coupon",
                )

            if subtotal < coupon.minimum_order_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Minimum order amount for this coupon is "
                        f"₹{coupon.minimum_order_amount}"
                    ),
                )

            if coupon.discount_type == "percentage":
                coupon_discount = (
                    subtotal * coupon.value / Decimal("100")
                )

                if coupon.maximum_discount is not None:
                    coupon_discount = min(
                        coupon_discount,
                        coupon.maximum_discount,
                    )

            else:
                coupon_discount = coupon.value

            coupon_discount = min(
                coupon_discount,
                subtotal,
            )

            coupon_discount = coupon_discount.quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

        shipping_fee = Decimal("0.00")

        total_discount += coupon_discount

        total_amount = (
            subtotal
            - total_discount
            + shipping_fee
        )

        order = Order(
            order_number=generate_order_number(),
            user_id=user.id,
            shipping_address_id=address.id,

            # Shipping address snapshot
            shipping_address_line1=address.address_line1,
            shipping_address_line2=address.address_line2,
            shipping_city=address.city,
            shipping_state=address.state,
            shipping_postal_code=address.postal_code,
            shipping_country=address.country,

            subtotal=subtotal,
            discount_amount=total_discount,
            shipping_fee=shipping_fee,
            total_amount=total_amount,
            order_status="confirmed",
            payment_status="pending",
            payment_method="cod",
        )

        db.add(order)
        db.flush()

        db.add(Payment(
            order_id=order.id,
            payment_gateway="cod",
            payment_method="cod",
            amount=total_amount,
            currency="INR",
            status="pending",
        ))

        if coupon is not None:
            coupon.used_count += 1

            coupon_usage = CouponUsage(
                coupon_id=coupon.id,
                user_id=user.id,
                order_id=order.id,
            )

            db.add(coupon_usage)

        for item in order_items:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item["product"].id,
                product_name=item["product"].name,
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                discount_amount=item["discount_amount"],
                final_price=item["final_price"],
            )

            db.add(order_item)

            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.product_id == item["product"].id
                )
                .with_for_update()
            )

            if inventory is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inventory unavailable for '{item['product'].name}'",
                )

            inventory.reserved_quantity += item["quantity"]

        status_history = OrderStatusHistory(
            order_id=order.id,
            status="confirmed",
            note="COD order confirmed; payment is due on delivery",
        )

        db.add(status_history)

        for cart_item in list(cart.items):
            db.delete(cart_item)

        db.commit()
        db.refresh(order)

        # Send admin notification after the order is successfully created.
        items_html = ""

        for item in order_items:
            product = item["product"]

            items_html += f"""
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #E3E5DF;">
                        {product.name}
                    </td>

                    <td style="padding: 10px 0; border-bottom: 1px solid #E3E5DF; text-align: center;">
                        {item["quantity"]}
                    </td>

                    <td style="padding: 10px 0; border-bottom: 1px solid #E3E5DF; text-align: right;">
                        ₹{item["final_price"] * item["quantity"]:,.2f}
                    </td>
                </tr>
            """

        customer_name = " ".join(
            part
            for part in [
                user.first_name,
                user.last_name,
            ]
            if part
        ).strip()

        if not customer_name:
            customer_name = "Customer"

        send_admin_notification(
            subject=f"🛒 New TerraLens order — {order.order_number}",
            html=f"""
                <div
                    style="
                        font-family: Arial, sans-serif;
                        max-width: 680px;
                        margin: 0 auto;
                        padding: 28px;
                        color: #1F2521;
                    "
                >
                    <div
                        style="
                            padding-bottom: 20px;
                            border-bottom: 1px solid #E3E5DF;
                        "
                    >
                        <h2
                            style="
                                margin: 0;
                                color: #486B57;
                            "
                        >
                            🛒 New TerraLens Order
                        </h2>

                        <p
                            style="
                                margin: 8px 0 0;
                                color: #737A74;
                            "
                        >
                            A new order has just been placed.
                        </p>
                    </div>

                    <div style="padding: 22px 0;">
                        <p>
                            <strong>Order:</strong>
                            {order.order_number}
                        </p>

                        <p>
                            <strong>Customer:</strong>
                            {customer_name}
                        </p>

                        <p>
                            <strong>Email:</strong>
                            {user.email}
                        </p>

                        <p>
                            <strong>Phone:</strong>
                            {user.phone_number}
                        </p>

                        <p>
                            <strong>Payment:</strong>
                            {order.payment_method.upper()}
                        </p>
                    </div>

                    <h3
                        style="
                            margin-bottom: 10px;
                            color: #1F2521;
                        "
                    >
                        Order items
                    </h3>

                    <table
                        style="
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 14px;
                        "
                    >
                        <thead>
                            <tr>
                                <th
                                    style="
                                        padding: 10px 0;
                                        text-align: left;
                                        border-bottom: 2px solid #486B57;
                                    "
                                >
                                    Product
                                </th>

                                <th
                                    style="
                                        padding: 10px 0;
                                        text-align: center;
                                        border-bottom: 2px solid #486B57;
                                    "
                                >
                                    Qty
                                </th>

                                <th
                                    style="
                                        padding: 10px 0;
                                        text-align: right;
                                        border-bottom: 2px solid #486B57;
                                    "
                                >
                                    Amount
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {items_html}
                        </tbody>
                    </table>

                    <div
                        style="
                            margin-top: 24px;
                            padding: 18px;
                            background: #F0F1EC;
                            border-radius: 10px;
                        "
                    >
                        <p style="margin: 0 0 8px;">
                            <strong>Subtotal:</strong>
                            ₹{order.subtotal:,.2f}
                        </p>

                        <p style="margin: 0 0 8px;">
                            <strong>Discount:</strong>
                            ₹{order.discount_amount:,.2f}
                        </p>

                        <p style="margin: 0 0 8px;">
                            <strong>Shipping:</strong>
                            ₹{order.shipping_fee:,.2f}
                        </p>

                        <p
                            style="
                                margin: 12px 0 0;
                                padding-top: 12px;
                                border-top: 1px solid #D9DDD7;
                                font-size: 18px;
                                color: #486B57;
                            "
                        >
                            <strong>
                                Total: ₹{order.total_amount:,.2f}
                            </strong>
                        </p>
                    </div>

                    <p
                        style="
                            margin-top: 24px;
                            font-size: 13px;
                            color: #737A74;
                        "
                    >
                        This is an automatic TerraLens store notification.
                    </p>
                </div>
            """,
        )

        return order

    except Exception:
        db.rollback()
        raise
    
def cancel_order(
    order_id: int,
    user: User,
    db: Session,
) -> Order:
    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items)
        )
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

    if order.order_status in {"cancelled", "delivered"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order cannot be cancelled",
        )

    if order.payment_status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid orders require a refund process",
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

    order.order_status = "cancelled"

    status_history = OrderStatusHistory(
        order_id=order.id,
        status="cancelled",
        note="Order cancelled by customer",
    )

    db.add(status_history)

    db.commit()
    db.refresh(order)

    customer_name = " ".join(
        part
        for part in [
            user.first_name,
            user.last_name,
        ]
        if part
    ).strip()

    if not customer_name:
        customer_name = "Customer"

    send_admin_notification(
        subject=f"❌ TerraLens order cancelled — {order.order_number}",
        html=f"""
            <div
                style="
                    font-family: Arial, sans-serif;
                    max-width: 680px;
                    margin: 0 auto;
                    padding: 28px;
                    color: #1F2521;
                "
            >
                <div
                    style="
                        padding-bottom: 20px;
                        border-bottom: 1px solid #E3E5DF;
                    "
                >
                    <h2
                        style="
                            margin: 0;
                            color: #C62828;
                        "
                    >
                        ❌ Order Cancelled
                    </h2>

                    <p
                        style="
                            margin: 8px 0 0;
                            color: #737A74;
                        "
                    >
                        A customer has cancelled an order.
                    </p>
                </div>

                <div style="padding: 22px 0;">
                    <p>
                        <strong>Order:</strong>
                        {order.order_number}
                    </p>

                    <p>
                        <strong>Customer:</strong>
                        {customer_name}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        {user.email}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        {user.phone_number}
                    </p>

                    <p>
                        <strong>Payment:</strong>
                        {order.payment_method.upper()}
                    </p>
                </div>

                <div
                    style="
                        margin-top: 10px;
                        padding: 18px;
                        background: #FFF1F1;
                        border-radius: 10px;
                    "
                >
                    <p style="margin: 0;">
                        <strong>Order total:</strong>
                        ₹{order.total_amount:,.2f}
                    </p>
                </div>

                <p
                    style="
                        margin-top: 24px;
                        font-size: 13px;
                        color: #737A74;
                    "
                >
                    The reserved inventory has been released.
                </p>
            </div>
        """,
    )

    return order

def update_order_status(
    order_id: int,
    new_status: str,
    note: str | None,
    admin: User,
    db: Session,
) -> Order:

    order = db.scalar(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.payment),
        )
        .where(Order.id == order_id)
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    allowed_transitions = {
        "pending": {"confirmed", "cancelled"},
        "confirmed": {"processing", "cancelled"},
        "processing": {"shipped", "cancelled"},
        "shipped": {"out_for_delivery"},
        "out_for_delivery": {"delivered"},
        "delivered": set(),
        "cancelled": set(),
    }

    current_status = order.order_status

    if new_status not in allowed_transitions.get(
        current_status,
        set(),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot change order status from "
                f"'{current_status}' to '{new_status}'"
            ),
        )

    # COD payment is collected when the order is delivered.
    if new_status == "delivered":
        if order.payment_method == "cod":
            if order.payment is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="COD payment record not found",
                )

            if order.payment.status != "paid":
                order.payment.status = "paid"

            order.payment_status = "paid"

        elif order.payment_status != "paid":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An unpaid order cannot be marked as delivered",
            )

    order.order_status = new_status

    status_history = OrderStatusHistory(
        order_id=order.id,
        status=new_status,
        note=note,
    )

    db.add(status_history)

    db.commit()
    db.refresh(order)

    return order