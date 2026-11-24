from sqlalchemy import BigInteger, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    __table_args__ = (Index("ix_rate_limit_expires", "expires_at"),)

    scope: Mapped[str] = mapped_column(String(40), primary_key=True)
    client_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    hits: Mapped[int] = mapped_column(Integer, nullable=False)
