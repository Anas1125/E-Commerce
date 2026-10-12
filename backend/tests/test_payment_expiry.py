
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services import payment_expiry as service


class FakeScalars:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeDB:
    def __init__(self, scalar_results, candidate_ids=None):
        self.scalar_results = list(scalar_results)
        self.candidate_ids = candidate_ids or [1]
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def scalars(self, statement):
        return FakeScalars(self.candidate_ids)

    def scalar(self, statement):
        if not self.scalar_results:
            return None
        return self.scalar_results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_case(
    *,
    age_minutes=31,
    gateway_order_id=None,
    reserved_quantity=3,
):
    now = datetime(2026, 10, 12, 14, 0, tzinfo=timezone.utc)

    item = SimpleNamespace(product_id=22, quantity=2)

    order = SimpleNamespace(
        id=1,
        created_at=now - timedelta(minutes=age_minutes),
        order_status="pending",
        payment_status="pending",
        payment_method="upi",
        cancelled_at=None,
        items=[item],
    )

    payment = SimpleNamespace(
        id=2,
        order_id=order.id,
        payment_gateway="razorpay",
        status="pending",
        gateway_order_id=gateway_order_id,
        failure_code=None,
        failure_reason=None,
    )

    inventory = SimpleNamespace(
        product_id=22,
        reserved_quantity=reserved_quantity,
    )

    return now, order, payment, inventory


def test_expiry_cancels_unstarted_order_and_releases_inventory():
    now, order, payment, inventory = make_case()
    db = FakeDB([order, payment, inventory])

    count = service.expire_unstarted_upi_orders(db, now=now)

    assert count == 1
    assert order.order_status == "cancelled"
    assert order.payment_status == "failed"
    assert order.cancelled_at == now
    assert payment.status == "failed"
    assert payment.failure_code == "checkout_expired"
    assert inventory.reserved_quantity == 1
    assert db.commits == 1
    assert db.rollbacks == 0

    history = db.added[0]
    assert history.order_id == order.id
    assert history.status == "cancelled"


def test_expiry_skips_order_with_razorpay_order_id():
    now, order, payment, inventory = make_case(
        gateway_order_id="order_existing_123"
    )
    db = FakeDB([order, payment, inventory])

    count = service.expire_unstarted_upi_orders(db, now=now)

    assert count == 0
    assert order.order_status == "pending"
    assert payment.status == "pending"
    assert inventory.reserved_quantity == 3
    assert db.commits == 0
    assert db.rollbacks == 1


def test_expiry_skips_order_younger_than_30_minutes():
    now, order, payment, inventory = make_case(age_minutes=10)
    db = FakeDB([order, payment, inventory])

    count = service.expire_unstarted_upi_orders(db, now=now)

    assert count == 0
    assert order.order_status == "pending"
    assert inventory.reserved_quantity == 3
    assert db.commits == 0
    assert db.rollbacks == 1


def test_expiry_skips_inconsistent_inventory_reservation():
    now, order, payment, inventory = make_case(
        reserved_quantity=1
    )
    db = FakeDB([order, payment, inventory])

    count = service.expire_unstarted_upi_orders(db, now=now)

    assert count == 0
    assert order.order_status == "pending"
    assert payment.status == "pending"
    assert inventory.reserved_quantity == 1
    assert db.commits == 0
    assert db.rollbacks == 1
