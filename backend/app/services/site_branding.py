"""Read current branding for emails and background jobs."""
import logging

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.models.site_settings import SiteSettings
from app.schemas.site_settings import DEFAULT_SITE_NAME

logger = logging.getLogger(__name__)


def get_site_name() -> str:
    try:
        with SessionLocal() as db:
            name = db.scalar(select(SiteSettings.site_name).where(SiteSettings.id == 1))
            return name.strip() if name and name.strip() else DEFAULT_SITE_NAME
    except SQLAlchemyError:
        logger.exception("Unable to load site name for notification")
        return DEFAULT_SITE_NAME
