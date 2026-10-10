from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.refund import Refund
from app.schemas.admin_refund import AdminRefundResponse
from app.services.dependencies import require_admin
from app.models.order import Order


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
    query = select(Refund).options(
        selectinload(Refund.order).selectinload(Order.user),
        selectinload(Refund.refund_items),
    )

    if refund_status:
        query = query.where(Refund.status == refund_status)

    refunds = db.scalars(
        query
        .order_by(Refund.requested_at.desc(), Refund.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    results = []

    for refund in refunds:
        user = refund.order.user

        customer_name = " ".join(
            part
            for part in (user.first_name, user.last_name)
            if part
        ).strip() or "Customer"

        results.append(
            {
                "id": refund.id,
                "order_id": refund.order_id,
                "payment_id": refund.payment_id,
                "amount": refund.amount,
                "reason": refund.reason,
                "status": refund.status,
                "gateway_refund_id": refund.gateway_refund_id,
                "requested_at": refund.requested_at,
                "completed_at": refund.completed_at,
                "customer_name": customer_name,
                "customer_email": user.email,
                "customer_phone": user.phone_number,
                "refund_items": refund.refund_items,
            }
        )

    return results
