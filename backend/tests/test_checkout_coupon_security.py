from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.schemas.order import OrderCreate
from app.services import order_service


def checkout_fixture(monkeypatch, *, first_order_only=True, previous_order=None,
                     used_count=0, user_usage_count=0, usage_limit=100,
                     per_user_limit=1, payment_method="cod"):
    monkeypatch.setattr(order_service, "get_site_name", lambda: "Test Store")
    monkeypatch.setattr(order_service, "calculate_discount", lambda *args: Decimal("0"))
    user = SimpleNamespace(id=13)
    address = SimpleNamespace(
        id=7, address_line1="Test address", address_line2=None,
        city="Test city", state="Test state", postal_code="123456", country="India",
    )
    product = SimpleNamespace(id=9, name="Test product", is_active=True, price=Decimal("100"))
    cart = SimpleNamespace(items=[SimpleNamespace(product=product, quantity=1)])
    inventory = SimpleNamespace(quantity=10, reserved_quantity=0)
    now = datetime.now(timezone.utc)
    coupon = SimpleNamespace(
        id=5, first_order_only=first_order_only, used_count=used_count,
        usage_limit=usage_limit, per_user_limit=per_user_limit,
        start_date=now - timedelta(days=1), end_date=now + timedelta(days=1),
        minimum_order_amount=Decimal("0"), discount_type="fixed",
        value=Decimal("10"), maximum_discount=None,
    )
    request = OrderCreate(shipping_address_id=7, coupon_code="WELCOME",
                          payment_method=payment_method)
    db = Mock()
    # No idempotency key: lock, unresolved order, address, cart, stock,
    # coupon, per-user usage, then existing order for first-order coupons.
    db.scalar.side_effect = [
        user.id, None, address, cart, inventory, coupon, user_usage_count,
        previous_order,
    ]
    return user, request, db, coupon


def sql(statement):
    return str(statement.compile(dialect=postgresql.dialect())).upper()


@pytest.mark.parametrize("payment_method", ["cod", "upi"])
def test_returning_customer_cannot_use_first_order_coupon(monkeypatch, payment_method):
    user, request, db, coupon = checkout_fixture(
        monkeypatch, previous_order=42, payment_method=payment_method,
    )
    with pytest.raises(HTTPException) as exc:
        order_service.create_order(user=user, order_data=request, db=db)

    assert exc.value.status_code == 400
    assert "first order only" in exc.value.detail
    statements = [sql(call.args[0]) for call in db.scalar.call_args_list]
    assert "FROM USERS" in statements[0] and "FOR UPDATE" in statements[0]
    assert "FROM COUPONS" in statements[5] and "FOR UPDATE" in statements[5]
    assert "FROM ORDERS" in statements[7] and "ORDERS.USER_ID" in statements[7]
    assert "ORDER_STATUS" not in statements[7]
    assert "PAYMENT_STATUS" not in statements[7]
    assert coupon.used_count == 0
    db.add.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_called_once()


@pytest.mark.parametrize("first_order_only, previous_order", [(True, None), (False, 42)])
def test_eligible_coupon_reaches_order_creation(monkeypatch, first_order_only, previous_order):
    user, request, db, coupon = checkout_fixture(
        monkeypatch, first_order_only=first_order_only, previous_order=previous_order,
    )

    # Stop before persisting any rows. This checks the actual checkout
    # eligibility and pricing path, not merely a standalone validator.
    class StopBeforeWrite(Exception):
        pass

    def inspect_order(order):
        assert order.total_amount == Decimal("90.00")
        assert order.discount_amount == Decimal("10.00")
        raise StopBeforeWrite()

    db.add.side_effect = inspect_order
    with pytest.raises(StopBeforeWrite):
        order_service.create_order(user=user, order_data=request, db=db)

    assert db.scalar.call_count == (8 if first_order_only else 7)
    db.add.assert_called_once()
    db.commit.assert_not_called()


@pytest.mark.parametrize(
    "used_count, user_usage_count, usage_limit, expected",
    [(100, 0, 100, "Coupon usage limit"), (1, 1, 100, "You have reached")],
)
def test_existing_redemption_limits_remain_enforced(
    monkeypatch, used_count, user_usage_count, usage_limit, expected
):
    user, request, db, coupon = checkout_fixture(
        monkeypatch, first_order_only=False, used_count=used_count,
        user_usage_count=user_usage_count, usage_limit=usage_limit,
    )
    with pytest.raises(HTTPException) as exc:
        order_service.create_order(user=user, order_data=request, db=db)
    assert exc.value.status_code == 400
    assert expected in exc.value.detail
    assert coupon.used_count == used_count
    db.add.assert_not_called()
    db.commit.assert_not_called()
    db.rollback.assert_called_once()
