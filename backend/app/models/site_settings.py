from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
    )

    site_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        default="TerraLens",
    )

    navbar_logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    hero_image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    footer_logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    favicon_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )