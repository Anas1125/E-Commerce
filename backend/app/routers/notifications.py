import logging
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, status

from app.services.dependencies import require_admin
from app.services.notifications import send_admin_notification

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)

COOLDOWN_SECONDS = 30

_cooldown_lock = threading.Lock()
_last_sent_at: float | None = None

TEST_EMAIL_HTML = """
<div
    style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 24px;
    "
>
    <h2 style="color: #486B57;">
        TerraLens Notification Test
    </h2>

    <p>
        Your TerraLens email notification
        system is working.
    </p>

    <p>
        You will receive alerts here when
        important store activity happens.
    </p>
</div>
"""


def _claim_send_slot() -> None:
    global _last_sent_at

    with _cooldown_lock:
        now = time.monotonic()

        if _last_sent_at is not None:
            wait = COOLDOWN_SECONDS - (now - _last_sent_at)

            if wait > 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {int(wait) + 1} seconds before sending another test.",
                    headers={"Retry-After": str(int(wait) + 1)},
                )
        _last_sent_at = now


@router.post(
    "/test",
    dependencies=[Depends(require_admin)],
)
def test_notification():
    _claim_send_slot()

    try:
        result = send_admin_notification(
            subject="🧪 TerraLens notification test",
            html=TEST_EMAIL_HTML,
        )
    except Exception:
        logger.exception("Test notification failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The test notification could not be sent. Check the email settings and server logs.",
        )

    if result is False:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The test notification could not be sent. Check the email settings and server logs.",
        )

    return {
        "message": "Test notification sent.",
    }