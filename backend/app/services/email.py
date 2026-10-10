import logging
import os
from html import escape

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SANDBOX_FROM_EMAIL = "onboarding@resend.dev"


def send_password_reset_email(
    email: str,
    reset_url: str,
    *,
    site_name: str = "TerraLens",
    expires_in_minutes: int = 30,
) -> None:
    api_key = os.getenv("RESEND_API_KEY")

    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    from_email = os.getenv("RESEND_FROM_EMAIL") or SANDBOX_FROM_EMAIL

    if from_email == SANDBOX_FROM_EMAIL:
        logger.warning(
            "RESEND_FROM_EMAIL is not set; using the Resend sandbox sender. "
            "Set it to an address on a verified domain before going live."
        )

    resend.api_key = api_key

    safe_url = escape(reset_url, quote=True)
    safe_site_name = escape(site_name)

    html = f"""
        <h2>Password reset request</h2>

        <p>We received a request to reset your {safe_site_name} password.</p>

        <p>Click the button below to choose a new password.</p>

        <p>
            <a
                href="{safe_url}"
                style="
                    display:inline-block;
                    padding:12px 20px;
                    background:#486B57;
                    color:white;
                    text-decoration:none;
                    border-radius:6px;
                "
            >
                Reset Password
            </a>
        </p>

        <p>If the button doesn't work, copy and paste this link into your browser:</p>

        <p style="word-break:break-all;">{safe_url}</p>

        <p>This link will expire in {int(expires_in_minutes)} minutes.</p>

        <p>
            If you did not request a password reset,
            you can safely ignore this email.
        </p>
    """

    text = (
        f"We received a request to reset your {site_name} password.\n\n"
        f"Choose a new password here:\n{reset_url}\n\n"
        f"This link will expire in {int(expires_in_minutes)} minutes.\n\n"
        "If you did not request a password reset, you can safely ignore this email."
    )

    result = resend.Emails.send(
        {
            "from": from_email,
            "to": [email],
            "subject": "Reset your password",
            "html": html,
            "text": text,
        }
    )

    logger.info("Password reset email sent (id=%s)", result.get("id"))