import os

import resend
from dotenv import load_dotenv


load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
ADMIN_NOTIFICATION_EMAIL = os.getenv(
    "ADMIN_NOTIFICATION_EMAIL"
)


def send_admin_notification(
    subject: str,
    html: str,
):
    if not RESEND_API_KEY:
        print("RESEND_API_KEY is not configured.")
        return

    if not ADMIN_NOTIFICATION_EMAIL:
        print(
            "ADMIN_NOTIFICATION_EMAIL is not configured."
        )
        return

    resend.api_key = RESEND_API_KEY

    params: resend.Emails.SendParams = {
        "from": "TerraLens <onboarding@resend.dev>",
        "to": [ADMIN_NOTIFICATION_EMAIL],
        "subject": subject,
        "html": html,
    }

    try:
        email = resend.Emails.send(params)

        print(
            f"Admin notification sent: {email}"
        )

        return email

    except Exception as error:
        print(
            f"Failed to send admin notification: {error}"
        )

def send_low_stock_notification(
    product_name: str,
    available_quantity: int,
    quantity: int,
    reserved_quantity: int,
):
    send_admin_notification(
        subject=f"⚠️ Low stock — {product_name}",
        html=f"""
        <div
            style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 28px;
                color: #1F2521;
            "
        >
            <div
                style="
                    padding-bottom: 18px;
                    border-bottom: 1px solid #E3E5DF;
                "
            >
                <h2 style="margin: 0; color: #C62828;">
                    ⚠️ Low Stock Alert
                </h2>

                <p style="margin: 8px 0 0; color: #737A74;">
                    A TerraLens product has reached low stock.
                </p>
            </div>

            <div style="padding: 22px 0;">
                <p>
                    <strong>Product:</strong>
                    {product_name}
                </p>

                <p>
                    <strong>Available:</strong>
                    {available_quantity}
                </p>

                <p>
                    <strong>On hand:</strong>
                    {quantity}
                </p>

                <p>
                    <strong>Reserved:</strong>
                    {reserved_quantity}
                </p>
            </div>

            <div
                style="
                    padding: 18px;
                    background: #FFF4F4;
                    border-radius: 10px;
                    color: #C62828;
                "
            >
                <strong>
                    Please consider restocking this product.
                </strong>
            </div>

            <p
                style="
                    margin-top: 24px;
                    font-size: 13px;
                    color: #737A74;
                "
            >
                This is an automatic TerraLens inventory notification.
            </p>
        </div>
        """,
    )


def send_out_of_stock_notification(
    product_name: str,
    quantity: int,
    reserved_quantity: int,
):
    send_admin_notification(
        subject=f"🚨 Out of stock — {product_name}",
        html=f"""
        <div
            style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 28px;
                color: #1F2521;
            "
        >
            <div
                style="
                    padding-bottom: 18px;
                    border-bottom: 1px solid #E3E5DF;
                "
            >
                <h2 style="margin: 0; color: #B71C1C;">
                    🚨 Out of Stock
                </h2>

                <p style="margin: 8px 0 0; color: #737A74;">
                    A TerraLens product is now out of stock.
                </p>
            </div>

            <div style="padding: 22px 0;">
                <p>
                    <strong>Product:</strong>
                    {product_name}
                </p>

                <p>
                    <strong>Available:</strong>
                    0
                </p>

                <p>
                    <strong>On hand:</strong>
                    {quantity}
                </p>

                <p>
                    <strong>Reserved:</strong>
                    {reserved_quantity}
                </p>
            </div>

            <div
                style="
                    padding: 18px;
                    background: #FFF1F1;
                    border-radius: 10px;
                    color: #B71C1C;
                "
            >
                <strong>
                    This product is currently unavailable for purchase.
                </strong>
            </div>

            <p
                style="
                    margin-top: 24px;
                    font-size: 13px;
                    color: #737A74;
                "
            >
                This is an automatic TerraLens inventory notification.
            </p>
        </div>
        """,
    )