from fastapi import APIRouter, Depends

from app.models.user import User
from app.services.dependencies import require_admin
from app.services.notifications import send_admin_notification


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.post("/test")
def test_notification(
    current_admin: User = Depends(require_admin),
):
    send_admin_notification(
        subject="🧪 TerraLens notification test",
        html="""
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
        """,
    )

    return {
        "message": "Test notification sent."
    }