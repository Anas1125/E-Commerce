from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

SINGLETON_ID = 1


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SiteSettings(Base):
    """Site-wide branding. Exactly one row (id = 1) is ever allowed."""

    __tablename__ = "site_settings"

    __table_args__ = (
        CheckConstraint(f"id = {SINGLETON_ID}", name="ck_site_settings_singleton"),
        CheckConstraint(
            "length(trim(site_name)) > 0",
            name="ck_site_settings_name_not_blank",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=False,
        default=SINGLETON_ID,
        server_default=str(SINGLETON_ID),
    )

    site_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        default="TerraLens",
        server_default="TerraLens",
    )

    navbar_logo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    hero_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    footer_logo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    favicon_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=func.now(),
        server_default=func.now(),
    )