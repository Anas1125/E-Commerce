from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import order_service as service


class FakeDB:
    def __init__(self, scalar_results):
        self.scalar_results = list(scalar_results)
        self.scalar_calls = 0
        self.added = []
        self.commits = 0
        self.refreshed = []

    def scalar(self, statement):
        self.scalar_calls += 1
        if not self.scalar_results:
            raise AssertionError("Unexpected database query")
        return self.scalar_results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        self.refreshed.append(obj)


def make_order(*, payment_method="cod", order_status="confirmed", items=None):
    return SimpleNamespace(
        id=10,
        user_id=3,
        order_number="TL-TEST-CANCEL",
        payment_method=payment_method,
        payment_status="pending",
        order_status=order_status,
        total_amount=1998.00,
        items=items or [],
    )


def make_payment(
    *,
    gateway="cod",
    gateway_order_id=None,
    creation_state="not_started",
):
    return SimpleNamespace(
        order_id=10,
        payment_gateway=gateway,
        gateway_order_id=gateway_order_id,
        gateway_order_creation_state=creation_state,
    )


@pytest.mark.parametrize(
    ("creation_state", "gateway_order_id"),
    [
        ("attempting", None),
        ("unknown", None),
        ("created", "order_existing_123"),
    ],
)
def test_admin_cannot_cancel_upi_with_started_or_uncertain_creation(
    creation_state, gateway_order_id
):
    order = make_order(
        payment_method="upi",
        order_status="pending",
        items=[SimpleNamespace(product_id=11, quantity=2)],
    )
    payment = make_payment(
        gateway="razorpay",
        gateway_order_id=gateway_order_id,
        creation_state=creation_state,
    )
    db = FakeDB([order, payment])
    admin = SimpleNamespace(id=99)

    with pytest.raises(HTTPException) as exc:
        service.update_order_status(
            order.id, "cancelled", "test cancellation", admin, db
        )

    assert exc.value.status_code == 409
    assert order.order_status == "pending"
    assert db.scalar_calls == 2  # Order and payment only; no inventory query.
    assert db.commits == 0
    assert db.added == []


def test_admin_cancellation_releases_multiple_product_reservations():
    # Deliberately reverse item order to verify consistent product-ID locking.
    items = [
        SimpleNamespace(product_id=22, quantity=1),
        SimpleNamespace(product_id=11, quantity=2),
    ]
    order = make_order(items=items)
    payment = make_payment()

    inventory_11 = SimpleNamespace(
        product_id=11, reserved_quantity=5
    )
    inventory_22 = SimpleNamespace(
        product_id=22, reserved_quantity=4
    )
    db = FakeDB([order, payment, inventory_11, inventory_22])
    admin = SimpleNamespace(id=99)

    result = service.update_order_status(
        order.id, "cancelled", "test cancellation", admin, db
    )

    assert result is order
    assert order.order_status == "cancelled"
    assert inventory_11.reserved_quantity == 3
    assert inventory_22.reserved_quantity == 3
    assert db.commits == 1
    assert len(db.added) == 1
    assert db.added[0].status == "cancelled"
    assert db.refreshed == [order]


def test_admin_cancellation_does_not_partially_release_inconsistent_inventory():
    items = [
        SimpleNamespace(product_id=11, quantity=2),
        SimpleNamespace(product_id=22, quantity=1),
    ]
    order = make_order(items=items)
    payment = make_payment()

    inventory_11 = SimpleNamespace(
        product_id=11, reserved_quantity=5
    )
    inventory_22 = SimpleNamespace(
        product_id=22, reserved_quantity=0
    )
    db = FakeDB([order, payment, inventory_11, inventory_22])
    admin = SimpleNamespace(id=99)

    with pytest.raises(HTTPException) as exc:
        service.update_order_status(
            order.id, "cancelled", "test cancellation", admin, db
        )

    assert exc.value.status_code == 409
    assert inventory_11.reserved_quantity == 5
    assert inventory_22.reserved_quantity == 0
    assert order.order_status == "confirmed"
    assert db.commits == 0
    assert db.added == []


def test_admin_can_cancel_unstarted_upi_order_and_release_reservation():
    item = SimpleNamespace(product_id=11, quantity=2)
    order = make_order(
        payment_method="upi",
        order_status="pending",
        items=[item],
    )
    payment = make_payment(
        gateway="razorpay",
        gateway_order_id=None,
        creation_state="not_started",
    )
    inventory = SimpleNamespace(
        product_id=11, reserved_quantity=5
    )
    db = FakeDB([order, payment, inventory])
    admin = SimpleNamespace(id=99)

    result = service.update_order_status(
        order.id, "cancelled", "test cancellation", admin, db
    )

    assert result is order
    assert order.order_status == "cancelled"
    assert inventory.reserved_quantity == 3
    assert db.commits == 1


@pytest.mark.parametrize(
    ("creation_state", "gateway_order_id"),
    [
        ("attempting", None),
        ("unknown", None),
        ("created", "order_existing_123"),
    ],
)
def test_customer_cannot_cancel_started_or_uncertain_upi_checkout(
    creation_state, gateway_order_id
):
    order = make_order(
        payment_method="upi",
        order_status="pending",
        items=[SimpleNamespace(product_id=11, quantity=2)],
    )
    payment = make_payment(
        gateway="razorpay",
        gateway_order_id=gateway_order_id,
        creation_state=creation_state,
    )
    user = SimpleNamespace(
        id=3, first_name="Test", last_name="Customer"
    )
    db = FakeDB([order, payment])

    with pytest.raises(HTTPException) as exc:
        service.cancel_order(order.id, user, db)

    assert exc.value.status_code == 409
    assert order.order_status == "pending"
    assert db.commits == 0
    assert db.added == []


def test_customer_can_cancel_unstarted_upi_order_and_release_reservation(
    monkeypatch,
):
    order = make_order(
        payment_method="upi",
        order_status="pending",
        items=[SimpleNamespace(product_id=11, quantity=2)],
    )
    payment = make_payment(
        gateway="razorpay",
        gateway_order_id=None,
        creation_state="not_started",
    )
    inventory = SimpleNamespace(
        product_id=11, reserved_quantity=5
    )
    user = SimpleNamespace(
        id=3, first_name="Test", last_name="Customer", email="test@example.com",
        phone_number="9999999999",
    )
    db = FakeDB([order, payment, inventory])

    monkeypatch.setattr(
        service, "send_admin_notification", lambda **kwargs: None
    )

    result = service.cancel_order(order.id, user, db)

    assert result is order
    assert order.order_status == "cancelled"
    assert inventory.reserved_quantity == 3
    assert db.commits == 1
    assert len(db.added) == 1
    assert db.added[0].status == "cancelled"
    assert db.refreshed == [order]
