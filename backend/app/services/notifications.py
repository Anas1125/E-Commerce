import logging
import os
from html import escape

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SANDBOX_FROM_EMAIL = "onboarding@resend.dev"


def _admin_recipients() -> list[str]:
    raw = os.getenv("ADMIN_NOTIFICATION_EMAIL", "")

    return [address.strip() for address in raw.split(",") if address.strip()]


def _single_line(value: str) -> str:
    """Collapses newlines and extra spaces so a name can't mangle a subject."""
    return " ".join(str(value).split())


def send_admin_notification(
    subject: str,
    html: str,
    text: str | None = None,
) -> dict | None:
    api_key = os.getenv("RESEND_API_KEY")

    if not api_key:
        logger.warning("RESEND_API_KEY is not configured; admin notification skipped.")
        return None

    recipients = _admin_recipients()

    if not recipients:
        logger.warning(
            "ADMIN_NOTIFICATION_EMAIL is not configured; admin notification skipped."
        )
        return None

    from_email = os.getenv("RESEND_FROM_EMAIL") or SANDBOX_FROM_EMAIL

    resend.api_key = api_key

    params: resend.Emails.SendParams = {
        "from": from_email,
        "to": recipients,
        "subject": _single_line(subject),
        "html": html,
    }

    if text:
        params["text"] = text

    try:
        result = resend.Emails.send(params)
    except Exception:
        logger.exception("Failed to send admin notification")
        return None

    logger.info("Admin notification sent (id=%s)", result.get("id"))

    return result


def _stock_alert_html(
    *,
    site_name: str,
    heading: str,
    intro: str,
    heading_color: str,
    banner_text: str,
    banner_background: str,
    banner_color: str,
    product_name: str,
    available_quantity: int,
    quantity: int,
    reserved_quantity: int,
) -> str:
    name = escape(str(product_name))
    site = escape(site_name)

    return f"""
    <div
        style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 28px;
            color: #1F2521;
        "
    >
        <div style="padding-bottom: 18px; border-bottom: 1px solid #E3E5DF;">
            <h2 style="margin: 0; color: {heading_color};">{heading}</h2>

            <p style="margin: 8px 0 0; color: #737A74;">{intro}</p>
        </div>

        <div style="padding: 22px 0;">
            <p><strong>Product:</strong> {name}</p>
            <p><strong>Available:</strong> {int(available_quantity)}</p>
            <p><strong>On hand:</strong> {int(quantity)}</p>
            <p><strong>Reserved:</strong> {int(reserved_quantity)}</p>
        </div>

        <div
            style="
                padding: 18px;
                background: {banner_background};
                border-radius: 10px;
                color: {banner_color};
            "
        >
            <strong>{banner_text}</strong>
        </div>

        <p style="margin-top: 24px; font-size: 13px; color: #737A74;">
            This is an automatic {site} inventory notification.
        </p>
    </div>
    """


def _stock_alert_text(
    *,
    heading: str,
    product_name: str,
    available_quantity: int,
    quantity: int,
    reserved_quantity: int,
) -> str:
    return (
        f"{heading}\n\n"
        f"Product: {_single_line(product_name)}\n"
        f"Available: {available_quantity}\n"
        f"On hand: {quantity}\n"
        f"Reserved: {reserved_quantity}\n"
    )


def send_low_stock_notification(
    product_name: str,
    available_quantity: int,
    quantity: int,
    reserved_quantity: int,
    site_name: str = "TerraLens",
) -> None:
    send_admin_notification(
        subject=f"⚠️ Low stock — {product_name}",
        html=_stock_alert_html(
            site_name=site_name,
            heading="⚠️ Low Stock Alert",
            intro=f"A {escape(site_name)} product has reached low stock.",
            heading_color="#C62828",
            banner_text="Please consider restocking this product.",
            banner_background="#FFF4F4",
            banner_color="#C62828",
            product_name=product_name,
            available_quantity=available_quantity,
            quantity=quantity,
            reserved_quantity=reserved_quantity,
        ),
        text=_stock_alert_text(
            heading="Low stock alert",
            product_name=product_name,
            available_quantity=available_quantity,
            quantity=quantity,
            reserved_quantity=reserved_quantity,
        ),
    )


def send_out_of_stock_notification(
    product_name: str,
    quantity: int,
    reserved_quantity: int,
    site_name: str = "TerraLens",
) -> None:
    send_admin_notification(
        subject=f"🚨 Out of stock — {product_name}",
        html=_stock_alert_html(
            site_name=site_name,
            heading="🚨 Out of Stock",
            intro=f"A {escape(site_name)} product is now out of stock.",
            heading_color="#B71C1C",
            banner_text="This product is currently unavailable for purchase.",
            banner_background="#FFF1F1",
            banner_color="#B71C1C",
            product_name=product_name,
            available_quantity=0,
            quantity=quantity,
            reserved_quantity=reserved_quantity,
        ),
        text=_stock_alert_text(
            heading="Out of stock",
            product_name=product_name,
            available_quantity=0,
            quantity=quantity,
            reserved_quantity=reserved_quantity,
        ),
    )