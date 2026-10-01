from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.refund import Refund
from app.models.user import User
from app.schemas.admin_refund import AdminRefundResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/refunds",
    tags=["Admin Refunds"],
)


@router.get("/", response_model=list[AdminRefundResponse])
def get_all_refunds(
    refund_status: str | None = Query(default=None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(Refund)
        .order_by(Refund.requested_at.desc())
    )

    if refund_status:
        query = query.where(
            Refund.status == refund_status
        )

    refunds = db.scalars(query).all()

    return refunds