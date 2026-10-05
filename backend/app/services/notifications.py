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