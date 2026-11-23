from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.schemas.site_settings import DEFAULT_SITE_NAME, SupportEmailUpdate
from app.services import site_branding, order_service


def test_site_name_reads_current_settings_without_caching(monkeypatch):
    engine = create_engine("sqlite://")
    sessions = sessionmaker(bind=engine)
    monkeypatch.setattr(site_branding, "SessionLocal", sessions)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE site_settings (id INTEGER PRIMARY KEY, site_name TEXT)"))
    assert site_branding.get_site_name() == DEFAULT_SITE_NAME
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO site_settings VALUES (1, 'Custom Shop')"))
    assert site_branding.get_site_name() == "Custom Shop"
    with engine.begin() as conn:
        conn.execute(text("UPDATE site_settings SET site_name = 'New Shop'"))
    assert site_branding.get_site_name() == "New Shop"
    engine.dispose()


def test_customer_order_email_escapes_custom_site_name(monkeypatch):
    monkeypatch.setattr(order_service, "get_site_name", lambda: "A & <Shop>")
    send = Mock()
    monkeypatch.setattr(order_service, "send_customer_notification", send)
    order = SimpleNamespace(
        contact_email="customer@example.com", shipping_name="Customer",
        order_number="ORDER-1", total_amount=Decimal("50"),
    )
    order_service._notify_customer_order_status(order, "confirmed")
    payload = send.call_args.kwargs
    assert "A &amp; &lt;Shop&gt;" in payload["html"]
    assert "A & <Shop>" not in payload["html"]
    assert "A & <Shop>" in payload["text"]
    assert "TerraLens" not in payload["html"]


def test_support_email_validation():
    assert SupportEmailUpdate(support_email="help@example.com").support_email == "help@example.com"
    assert SupportEmailUpdate(support_email=None).support_email is None
    with pytest.raises(ValidationError):
        SupportEmailUpdate(support_email="not-an-email")
