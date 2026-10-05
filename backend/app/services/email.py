import os

import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "onboarding@resend.dev",
)


def send_password_reset_email(
    email: str,
    reset_url: str,
) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError(
            "RESEND_API_KEY is not configured."
        )

    resend.api_key = RESEND_API_KEY

    resend.Emails.send(
        {
            "from": RESEND_FROM_EMAIL,
            "to": [email],
            "subject": "Reset your password",
            "html": f"""
                <h2>Password reset request</h2>

                <p>
                    We received a request to reset your password.
                </p>

                <p>
                    Click the button below to choose a new password.
                </p>

                <p>
                    <a
                        href="{reset_url}"
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

                <p>
                    This link will expire in 30 minutes.
                </p>

                <p>
                    If you did not request a password reset,
                    you can safely ignore this email.
                </p>
            """,
        }
    )