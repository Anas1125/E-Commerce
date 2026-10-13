from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.schemas.order import OrderCreate
from app.services import order_service


def make_existing_order():
    return SimpleNamespace(
        id=42,
        user_id=13,
        idempotency_key="test-idempotency-key-123",
        shipping_address_id=7,
        payment_method="upi",
    )


def make_request(
    *,
    address_id=7,
    payment_method="upi",
    coupon_code=None,
):
    return OrderCreate(
        shipping_address_id=address_id,
        payment_method=payment_method,
        coupon_code=coupon_code,
        idempotency_key="test-idempotency-key-123",
    )


def test_create_order_locks_customer_before_idempotency_lookup(monkeypatch):
    user = SimpleNamespace(id=13)
    existing_order = make_existing_order()
    db = Mock()
    db.scalar.return_value = user.id

    def lookup_existing(**kwargs):
        # The customer lock must have been acquired before the lookup.
        assert db.scalar.call_count == 1

        statement = db.scalar.call_args.args[0]
        compiled_sql = str(
            statement.compile(dialect=postgresql.dialect())
        ).upper()

        assert "FROM USERS" in compiled_sql
        assert "FOR UPDATE" in compiled_sql

        assert kwargs["user"] is user
        assert kwargs["order_data"].idempotency_key == (
            "test-idempotency-key-123"
        )
        assert kwargs["db"] is db

        return existing_order

    monkeypatch.setattr(
        order_service,
        "_get_existing_idempotent_order",
        lookup_existing,
    )

    result = order_service.create_order(
        user=user,
        order_data=make_request(),
        db=db,
    )

    assert result is existing_order
    assert db.scalar.call_count == 1
    db.commit.assert_not_called()


def test_same_idempotency_key_and_details_reuse_existing_order():
    existing_order = make_existing_order()
    db = Mock()
    db.scalar.side_effect = [existing_order, None]

    result = order_service._get_existing_idempotent_order(
        user=SimpleNamespace(id=13),
        order_data=make_request(),
        db=db,
    )

    assert result is existing_order
    assert db.scalar.call_count == 2


def test_same_idempotency_key_with_different_address_returns_409():
    existing_order = make_existing_order()
    db = Mock()
    db.scalar.side_effect = [existing_order, None]

    with pytest.raises(HTTPException) as exc:
        order_service._get_existing_idempotent_order(
            user=SimpleNamespace(id=13),
            order_data=make_request(address_id=8),
            db=db,
        )

    assert exc.value.status_code == 409
    assert "different checkout details" in exc.value.detail
    assert db.scalar.call_count == 2

def test_create_order_blocks_new_order_when_upi_checkout_is_pending(
    monkeypatch,
):
    user = SimpleNamespace(id=13)
    unresolved_order = SimpleNamespace(
        id=84,
        order_number="TL-PENDING-084",
    )

    db = Mock()
    db.scalar.side_effect = [user.id, unresolved_order]

    monkeypatch.setattr(
        order_service,
        "_get_existing_idempotent_order",
        lambda **kwargs: None,
    )

    with pytest.raises(HTTPException) as exc:
        order_service.create_order(
            user=user,
            order_data=make_request(),
            db=db,
        )

    assert exc.value.status_code == 409
    assert unresolved_order.order_number in exc.value.detail
    db.add.assert_not_called()
    db.rollback.assert_called_once()