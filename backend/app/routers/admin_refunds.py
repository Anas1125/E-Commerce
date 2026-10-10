from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.refund import Refund
from app.schemas.admin_refund import AdminRefundResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/admin/refunds",
    tags=["Admin Refunds"],
)
RefundStatus = Literal["requested", "approved", "completed", "rejected"]


@router.get(
    "/",
    response_model=list[AdminRefundResponse],
    dependencies=[Depends(require_admin)],
)
def get_all_refunds(
    refund_status: RefundStatus | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(Refund)

    if refund_status:
        query = query.where(Refund.status == refund_status)

    return db.scalars(
        query
        .order_by(Refund.requested_at.desc(), Refund.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()