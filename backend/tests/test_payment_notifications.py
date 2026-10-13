
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

from app.services import payment_service as service


def make_payment_objects():
    user = SimpleNamespace(
        id=1,
        first_name="Test",
        last_name="Customer",
        email="customer@example.com",
    )

    order = SimpleNamespace(
        id=101,
        order_number="TL-TEST-101",
        total_amount=Decimal("1000.00"),
        payment_status="pending",
        order_status="pending",
        contact_email="customer@example.com",
        items=[
            SimpleNamespace(
                product_name="Test iPhone",
                quantity=1,
                final_price=Decimal("1000.00"),
            )
        ],
    )

    payment = SimpleNamespace(
        id=201,
        status="created",
        payment_gateway="razorpay",
        gateway_order_id="order_test_123",
        failure_code=None,
        failure_reason=None,
    )

    return order, payment, user


def test_failed_payment_notifies_admin_only_once(monkeypatch):
    order, payment, user = make_payment_objects()
    db = Mock()

    monkeypatch.setattr(
        service,
        "_lock_order_then_payment",
        lambda db, **kwargs: (order, payment),
    )

    gateway = SimpleNamespace(
        order=SimpleNamespace(
            payments=Mock(
                return_value={
                    "items": [
                        {
                            "id": "pay_failed_123",
                            "status": "failed",
                            "error_code": "BAD_REQUEST_ERROR",
                            "error_description": "Bank declined the payment",
                        }
                    ]
                }
            )
        )
    )

    monkeypatch.setattr(
        service,
        "get_razorpay_client",
        lambda: gateway,
    )

    notify_admin = Mock()
    monkeypatch.setattr(
        service,
        "_notify_payment_failed_admin",
        notify_admin,
    )

    # First confirmed failure should notify the admin.
    result = service.fail_payment(
        payment_id=payment.id,
        user=user,
        db=db,
    )

    assert result.status == "failed"
    assert order.payment_status == "failed"
    assert payment.failure_code == "BAD_REQUEST_ERROR"
    assert payment.failure_reason == "Bank declined the payment"
    notify_admin.assert_called_once_with(order, payment, user)

    # A duplicate callback must not send another notification.
    service.fail_payment(
        payment_id=payment.id,
        user=user,
        db=db,
    )

    assert notify_admin.call_count == 1
    assert db.commit.call_count == 2


def test_success_notification_sends_admin_and_customer_emails(monkeypatch):
    order, payment, user = make_payment_objects()

    send_admin = Mock()
    send_customer = Mock()

    monkeypatch.setattr(
        service,
        "send_admin_notification",
        send_admin,
    )
    monkeypatch.setattr(
        service,
        "send_customer_notification",
        send_customer,
    )

    service._notify_payment_succeeded(order, user)

    send_admin.assert_called_once()
    send_customer.assert_called_once()

    assert send_admin.call_args.kwargs["subject"].startswith(
        "New paid TerraLens order"
    )
    assert send_customer.call_args.kwargs["email"] == (
        "customer@example.com"
    )
