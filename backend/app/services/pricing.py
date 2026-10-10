from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.discount import Discount
from app.models.product import Product

CENT = Decimal("0.01")


def get_active_discounts(db: Session, product_id: int | None = None) -> list[Discount]:
    now = datetime.now(timezone.utc)
    statement = select(Discount).where(
        Discount.is_active.is_(True),
        Discount.start_date <= now,
        Discount.end_date >= now,
    )
    if product_id is not None:
        statement = statement.where(
            or_(Discount.product_id == product_id, Discount.product_id.is_(None))
        )
    return list(db.scalars(statement).all())


def calculate_discount_amount(
    product: Product, price: Decimal, discounts: list[Discount]
) -> Decimal:
    best_amount = Decimal("0.00")
    for discount in discounts:
        if discount.product_id is not None and discount.product_id != product.id:
            continue
        value = Decimal(discount.value)
        if discount.discount_type == "percentage":
            amount = price * value / Decimal("100")
        elif discount.discount_type == "fixed":
            amount = value
        else:
            continue
        amount = min(max(amount, Decimal("0.00")), price)
        if amount > best_amount:
            best_amount = amount
    return best_amount.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_discount(product: Product, price: Decimal, db: Session) -> Decimal:
    return calculate_discount_amount(
        product, price, get_active_discounts(db, product.id)
    )
