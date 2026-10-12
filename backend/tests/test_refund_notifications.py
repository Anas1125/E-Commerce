
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.refunds import router as refunds_router
from app.schemas.admin_refund import RefundRejectRequest
from app.services import refund_service as service
from app.services.dependencies import require_admin


class FakeResult:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


class FakeScalars:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeDB:
    def __init__(
        self,
        scalar_results=None,
        scalars_results=None,
        execute_result=None,
    ):
        self.scalar_results = list(scalar_results or [])
        self.scalars_results = list(scalars_results or [])
        self.execute_result = execute_result
        self.commits = 0
        self.rollbacks = 0

    def scalar(self, statement):
        if not self.scalar_results:
            return None
        return self.scalar_results.pop(0)

    def scalars(self, statement):
        values = (
            self.scalars_results.pop(0)
            if self.scalars_results
            else []
        )
        return FakeScalars(values)

    def execute(self, statement):
        return self.execute_result

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        pass

    def flush(self):
        pass

    def rollback(self):
        self.rollbacks += 1


def make_refund(status="requested"):
    user = SimpleNamespace(
        id=3,
        email="customer@example.com",
        first_name="Test",
        last_name="Customer",
    )

    order = SimpleNamespace(
        id=12,
        user_id=user.id,
        user=user,
        order_number="TL-TEST-001",
        payment_status="paid",
        payment_method="upi",
    )

    payment = SimpleNamespace(
        id=45,
        order_id=order.id,
        payment_gateway="razorpay",
        gateway_payment_id="pay_test_123",
        amount=Decimal("100.00"),
        currency="INR",
        status="paid",
    )

    refund = SimpleNamespace(
        id=5,
        order_id=order.id,
        payment_id=payment.id,
        order=order,
        amount=Decimal("100.00"),
        status=status,
        decision_note=None,
        reviewed_by_id=None,
        reviewed_at=None,
        gateway_refund_id=None,
        completed_at=None,
    )

    return user, order, payment, refund


def test_approval_commits_before_customer_notification(monkeypatch):
    _, _, _, refund = make_refund()
    db = FakeDB(scalar_results=[refund])
    notifications = []

    def fake_notify(**kwargs):
        assert db.commits == 1
        notifications.append(kwargs)

    monkeypatch.setattr(
        service, "_notify_customer_refund_status", fake_notify
    )

    result = service.approve_refund(
        refund_id=refund.id,
        admin=SimpleNamespace(id=99),
        db=db,
    )

    assert result is refund
    assert refund.status == "approved"
    assert refund.reviewed_by_id == 99
    assert refund.reviewed_at is not None
    assert db.commits == 1
    assert notifications[0]["status"] == "approved"
    assert notifications[0]["email"] == "customer@example.com"


def test_rejection_saves_reason_before_customer_notification(monkeypatch):
    _, _, _, refund = make_refund()
    db = FakeDB(scalar_results=[refund])
    notifications = []

    def fake_notify(**kwargs):
        assert db.commits == 1
        notifications.append(kwargs)

    monkeypatch.setattr(
        service, "_notify_customer_refund_status", fake_notify
    )

    result = service.reject_refund(
        refund_id=refund.id,
        reason="Item does not meet refund policy.",
        admin=SimpleNamespace(id=99),
        db=db,
    )

    assert result is refund
    assert refund.status == "rejected"
    assert refund.decision_note == "Item does not meet refund policy."
    assert refund.reviewed_by_id == 99
    assert refund.reviewed_at is not None
    assert db.commits == 1
    assert notifications[0]["status"] == "rejected"
    assert notifications[0]["decision_note"] == (
        "Item does not meet refund policy."
    )


@pytest.mark.parametrize(
    ("operation", "expected_status"),
    [
        ("approve", "approved"),
        ("reject", "rejected"),
    ],
)
def test_notification_exception_does_not_undo_saved_decision(
    monkeypatch, operation, expected_status
):
    _, _, _, refund = make_refund()
    db = FakeDB(scalar_results=[refund])

    def fail_notification(**kwargs):
        raise RuntimeError("Simulated notification failure")

    monkeypatch.setattr(
        service, "_notify_customer_refund_status", fail_notification
    )

    if operation == "approve":
        result = service.approve_refund(
            refund_id=refund.id,
            admin=SimpleNamespace(id=99),
            db=db,
        )
    else:
        result = service.reject_refund(
            refund_id=refund.id,
            reason="Policy reason",
            admin=SimpleNamespace(id=99),
            db=db,
        )

    assert result is refund
    assert refund.status == expected_status
    assert db.commits == 1
    assert db.rollbacks == 0


@pytest.mark.parametrize(
    ("operation", "initial_status"),
    [
        ("approve", "approved"),
        ("reject", "rejected"),
    ],
)
def test_only_requested_refunds_can_be_decided(
    operation, initial_status
):
    _, _, _, refund = make_refund(status=initial_status)
    db = FakeDB(scalar_results=[refund])

    with pytest.raises(HTTPException) as exc:
        if operation == "approve":
            service.approve_refund(
                refund_id=refund.id,
                admin=SimpleNamespace(id=99),
                db=db,
            )
        else:
            service.reject_refund(
                refund_id=refund.id,
                reason=None,
                admin=SimpleNamespace(id=99),
                db=db,
            )

    assert exc.value.status_code == 400
    assert db.commits == 0
    assert db.rollbacks == 1


def test_completed_refund_is_verified_and_notifies_after_commit(
    monkeypatch,
):
    _, order, payment, refund = make_refund(status="approved")

    db = FakeDB(
        scalar_results=[order, payment, refund, None],
        scalars_results=[[refund]],
        execute_result=FakeResult(
            SimpleNamespace(order_id=order.id, payment_id=payment.id)
        ),
    )

    verification_calls = []
    notifications = []

    def fake_verify(refund_arg, payment_arg, gateway_refund_id):
        verification_calls.append(gateway_refund_id)
        assert refund_arg is refund
        assert payment_arg is payment

    def fake_notify(**kwargs):
        assert db.commits == 1
        notifications.append(kwargs)

    monkeypatch.setattr(
        service, "_verify_gateway_refund", fake_verify
    )
    monkeypatch.setattr(
        service, "_notify_customer_refund_status", fake_notify
    )

    result = service.complete_refund(
        refund_id=refund.id,
        gateway_refund_id="rfnd_test_123",
        admin=SimpleNamespace(id=99),
        db=db,
    )

    assert result is refund
    assert verification_calls == ["rfnd_test_123"]
    assert refund.status == "completed"
    assert refund.gateway_refund_id == "rfnd_test_123"
    assert refund.completed_at is not None
    assert payment.status == "refunded"
    assert order.payment_status == "refunded"
    assert db.commits == 1
    assert notifications[0]["status"] == "completed"
    assert notifications[0]["email"] == "customer@example.com"


def test_gateway_verification_failure_does_not_notify_customer(
    monkeypatch,
):
    _, order, payment, refund = make_refund(status="approved")

    db = FakeDB(
        scalar_results=[order, payment, refund, None],
        execute_result=FakeResult(
            SimpleNamespace(order_id=order.id, payment_id=payment.id)
        ),
    )

    notifications = []

    def fail_verification(*args):
        raise HTTPException(
            status_code=409,
            detail="Gateway refund has not been processed",
        )

    monkeypatch.setattr(
        service, "_verify_gateway_refund", fail_verification
    )
    monkeypatch.setattr(
        service,
        "_notify_customer_refund_status",
        lambda **kwargs: notifications.append(kwargs),
    )

    with pytest.raises(HTTPException) as exc:
        service.complete_refund(
            refund_id=refund.id,
            gateway_refund_id="rfnd_unprocessed",
            admin=SimpleNamespace(id=99),
            db=db,
        )

    assert exc.value.status_code == 409
    assert refund.status == "approved"
    assert db.commits == 0
    assert db.rollbacks == 1
    assert notifications == []


def test_rejection_email_escapes_customer_provided_html(monkeypatch):
    emails = []

    monkeypatch.setattr(
        service,
        "send_customer_notification",
        lambda **kwargs: emails.append(kwargs),
    )

    service._notify_customer_refund_status(
        email="customer@example.com",
        customer_name="<script>name</script>",
        order_number="TL-TEST-001",
        amount=Decimal("50.00"),
        status="rejected",
        decision_note="<script>alert(1)</script>",
    )

    assert len(emails) == 1
    assert emails[0]["subject"].startswith("Refund request update")
    assert "&lt;script&gt;" in emails[0]["html"]
    assert "<script>" not in emails[0]["html"]
    assert "alert(1)" in emails[0]["text"]


def test_rejection_reason_is_limited_to_1000_characters():
    valid = RefundRejectRequest(reason="x" * 1000)
    assert len(valid.reason) == 1000

    with pytest.raises(ValidationError):
        RefundRejectRequest(reason="x" * 1001)


def test_rejection_route_requires_admin_dependency():
    route = next(
        route
        for route in refunds_router.routes
        if getattr(route, "name", None) == "reject_refund_request"
    )

    assert any(
        dependency.call is require_admin
        for dependency in route.dependant.dependencies
    )
