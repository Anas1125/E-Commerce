from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.payment import Payment
    from app.models.refund_item import RefundItem


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


REFUND_STATUSES = (
    "requested",
    "approved",
    "processing",
    "completed",
    "rejected",
    "failed",
)

ACTIVE_REFUND_STATUSES = ("requested", "approved", "processing", "completed")


def _in_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class Refund(Base):
    __tablename__ = "refunds"

    __table_args__ = (
        CheckConstraint(
            f"status IN ({_in_list(REFUND_STATUSES)})",
            name="ck_refunds_status",
        ),
        CheckConstraint("amount > 0", name="ck_refunds_amount_positive"),
        CheckConstraint(
            "completed_at IS NULL OR status = 'completed'",
            name="ck_refunds_completed_at_status",
        ),
        Index(
            "uq_refunds_one_active_per_order",
            "order_id",
            unique=True,
            postgresql_where=text(f"status IN ({_in_list(ACTIVE_REFUND_STATUSES)})"),
            sqlite_where=text(f"status IN ({_in_list(ACTIVE_REFUND_STATUSES)})"),
        ),
        Index("ix_refunds_status_requested_at", "status", "requested_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


    refund_items: Mapped[list["RefundItem"]] = relationship(
        back_populates="refund",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="requested",
        server_default="requested",
    )

    gateway_refund_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=func.now(),
        server_default=func.now(),
    )

    order: Mapped["Order"] = relationship()

    payment: Mapped["Payment"] = relationship()