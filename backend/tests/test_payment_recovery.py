from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import payment_service as service


class FakeDB:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        pass

    def rollback(self):
        self.rollbacks += 1


class FakeRazorpayOrder:
    def __init__(self, gateway_status, attempts):
        self.gateway_status = gateway_status
        self.attempts = attempts

    def fetch(self, order_id):
        assert order_id == "order_test_1"
        return {"status": self.gateway_status}

    def payments(self, order_id):
        assert order_id == "order_test_1"
        return {"items": self.attempts}


def make_order(payment_status="failed", order_status="pending"):
    return SimpleNamespace(
        id=12,
        user_id=3,
        payment_method="upi",
        payment_status=payment_status,
        order_status=order_status,
        total_amount=Decimal("100.00"),
    )


def make_payment(status="failed"):
    return SimpleNamespace(
        id=45,
        order_id=12,
        payment_gateway="razorpay",
        status=status,
        gateway_order_id="order_test_1",
        amount=Decimal("100.00"),
        currency="INR",
        failure_code="payment_failed",
        failure_reason="Previous attempt failed",
    )


def prepare_test(monkeypatch, order, payment, gateway_status, attempts):
    db = FakeDB()
    user = SimpleNamespace(id=3)

    monkeypatch.setattr(
        service,
        "_lock_order_then_payment",
        lambda db, **kwargs: (order, payment),
    )

    client = SimpleNamespace(
        order=FakeRazorpayOrder(gateway_status, attempts)
    )

    monkeypatch.setattr(
        service,
        "get_razorpay_client",
        lambda: client,
    )

    return db, user


@pytest.mark.parametrize(
    ("payment_status", "order_payment_status"),
    [
        ("pending", "paid"),
        ("paid", "pending"),
        ("failed", "paid"),
    ],
)
def test_retry_blocks_inconsistent_paid_states(
    monkeypatch, payment_status, order_payment_status
):
    order = make_order(payment_status=order_payment_status)
    payment = make_payment(status=payment_status)

    db, user = prepare_test(
        monkeypatch, order, payment, "attempted", []
    )

    with pytest.raises(HTTPException) as exc:
        service.retry_payment(payment.id, user, db)

    assert exc.value.status_code == 409
    assert db.commits == 0


def test_retry_allows_confirmed_failed_attempt_on_existing_order(
    monkeypatch,
):
    order = make_order(payment_status="failed")
    payment = make_payment(status="failed")

    db, user = prepare_test(
        monkeypatch,
        order,
        payment,
        "attempted",
        [{"id": "pay_failed_1", "status": "failed"}],
    )

    result = service.retry_payment(payment.id, user, db)

    assert result is payment
    assert payment.status == "pending"
    assert payment.failure_code is None
    assert payment.failure_reason is None
    assert order.payment_status == "pending"
    assert payment.gateway_order_id == "order_test_1"
    assert order.order_status == "pending"
    assert db.commits == 1


def test_retry_rejects_attempt_that_may_still_be_processing(
    monkeypatch,
):
    order = make_order(payment_status="failed")
    payment = make_payment(status="failed")

    db, user = prepare_test(
        monkeypatch,
        order,
        payment,
        "attempted",
        [{"id": "pay_uncertain_1", "status": "authorized"}],
    )

    with pytest.raises(HTTPException) as exc:
        service.retry_payment(payment.id, user, db)

    assert exc.value.status_code == 409
    assert payment.status == "failed"
    assert order.payment_status == "failed"
    assert db.commits == 0


def test_retry_reconciles_captured_payment_instead_of_reopening_checkout(
    monkeypatch,
):
    order = make_order(payment_status="failed")
    payment = make_payment(status="failed")
    db, user = prepare_test(
        monkeypatch,
        order,
        payment,
        "paid",
        [{"id": "pay_captured_1", "status": "captured"}],
    )

    completed_payment = make_payment(status="paid")

    def fake_complete_payment(**kwargs):
        assert kwargs["gateway_payment_id"] == "pay_captured_1"
        assert kwargs["verify_signature"] is False
        return completed_payment

    monkeypatch.setattr(
        service, "complete_payment", fake_complete_payment
    )

    result = service.retry_payment(payment.id, user, db)

    assert result is completed_payment
    assert db.commits == 0


def test_fail_payment_does_not_mark_unresolved_attempt_as_failed(
    monkeypatch,
):
    order = make_order(payment_status="pending")
    payment = make_payment(status="pending")

    db, user = prepare_test(
        monkeypatch,
        order,
        payment,
        "attempted",
        [{"id": "pay_uncertain_2", "status": "authorized"}],
    )

    with pytest.raises(HTTPException) as exc:
        service.fail_payment(payment.id, user, db)

    assert exc.value.status_code == 409
    assert payment.status == "pending"
    assert order.payment_status == "pending"
    assert db.commits == 0


def test_confirmed_failure_retains_active_order_for_retry(
    monkeypatch,
):
    order = make_order(payment_status="pending", order_status="pending")
    payment = make_payment(status="pending")

    db, user = prepare_test(
        monkeypatch,
        order,
        payment,
        "attempted",
        [{"id": "pay_failed_2", "status": "failed"}],
    )

    result = service.fail_payment(payment.id, user, db)

    assert result is payment
    assert payment.status == "failed"
    assert order.payment_status == "failed"
    assert order.order_status == "pending"
    assert db.commits == 1


def test_captured_payment_for_cancelled_order_requires_reconciliation(
    monkeypatch,
):
    order = make_order(
        payment_status="failed",
        order_status="cancelled",
    )
    payment = make_payment(status="failed")
    db = FakeDB()
    user = SimpleNamespace(id=3)

    monkeypatch.setattr(
        service,
        "_lock_order_then_payment",
        lambda db, **kwargs: (order, payment),
    )

    gateway_payment = {
        "id": "pay_captured_cancelled",
        "order_id": payment.gateway_order_id,
        "amount": 10000,
        "currency": "INR",
        "status": "captured",
        "captured": True,
        "method": "upi",
    }

    def fetch_payment(payment_id):
        assert payment_id == "pay_captured_cancelled"
        return gateway_payment

    client = SimpleNamespace(
        payment=SimpleNamespace(fetch=fetch_payment)
    )

    monkeypatch.setattr(
        service,
        "get_razorpay_client",
        lambda: client,
    )

    with pytest.raises(HTTPException) as exc:
        service.complete_payment(
            payment_id=payment.id,
            gateway_order_id=payment.gateway_order_id,
            gateway_payment_id="pay_captured_cancelled",
            gateway_signature=None,
            payment_method="upi",
            user=user,
            db=db,
            verify_signature=False,
        )

    assert exc.value.status_code == 409
    assert order.order_status == "cancelled"
    assert order.payment_status == "failed"
    assert payment.status == "failed"
    assert db.commits == 0
    assert db.rollbacks == 1
