import logging
import os
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.site_settings import SiteSettings
from app.models.user import User
from app.schemas.site_settings import (
    SiteNameUpdate,
    SiteSettingsResponse,
)
from app.services.dependencies import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/site-settings", tags=["Site Settings"])

BRANDING_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "branding"
MAX_IMAGE_SIZE = 10 * 1024 * 1024

IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": (
        "image/webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
    ".ico": (
        ("image/x-icon", "image/vnd.microsoft.icon"),
        lambda data: len(data) >= 6 and data[:4] == b"\x00\x00\x01\x00",
    ),
}

SETTING_FIELDS = {
    "navbar_logo": "navbar_logo_url",
    "hero_image": "hero_image_url",
    "footer_logo": "footer_logo_url",
    "favicon": "favicon_url",
}


def get_or_create_settings(db: Session) -> SiteSettings:
    settings = db.get(SiteSettings, 1)

    if settings is None:
        settings = SiteSettings(id=1)
        db.add(settings)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            settings = db.get(SiteSettings, 1)

            if settings is None:
                raise

            return settings

        db.refresh(settings)

    return settings


def delete_local_branding_asset(url: str | None, keep: Path | None = None) -> None:
    if not url or "/uploads/branding/" not in url:
        return

    filename = url.split("/uploads/branding/", maxsplit=1)[1].split("?", maxsplit=1)[0]

    if not filename or Path(filename).name != filename:
        return

    candidate = BRANDING_UPLOADS_DIR / filename

    if candidate == keep:
        return

    try:
        candidate.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not delete old branding file %s", candidate)


@router.get(
    "",
    response_model=SiteSettingsResponse,
    summary="Get the public site settings",
)
def read_site_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)


@router.patch(
    "/name",
    response_model=SiteSettingsResponse,
    summary="Update the website name (admin)",
)
def update_site_name(
    site_data: SiteNameUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    site_name = site_data.site_name.strip()

    if not site_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Website name cannot be empty",
        )

    settings = get_or_create_settings(db)
    settings.site_name = site_name

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(settings)

    logger.info("Site name updated by admin %s", current_admin.id)

    return settings

@router.post(
    "/{asset_name}/upload",
    response_model=SiteSettingsResponse,
    summary="Upload a branding image (admin)",
)
def upload_branding_asset(
    asset_name: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    field_name = SETTING_FIELDS.get(asset_name)

    if field_name is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branding image type not found",
        )

    extension = Path(file.filename or "").suffix.lower()
    image_format = IMAGE_FORMATS.get(extension)

    if image_format is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use a JPG, JPEG, PNG, WebP, or ICO image",
        )

    content_types, signature_matches = image_format

    if isinstance(content_types, str):
        content_types = (content_types,)

    if file.content_type not in (*content_types, "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file type does not match its extension",
        )

    contents = file.file.read(MAX_IMAGE_SIZE + 1)

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected image is empty",
        )

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Images must be 10 MB or smaller",
        )

    if not signature_matches(contents):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected file is not a valid supported image",
        )

    BRANDING_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    destination = BRANDING_UPLOADS_DIR / filename
    old_url = None
    committed = False

    try:
        destination.write_bytes(contents)

        settings = get_or_create_settings(db)
        old_url = getattr(settings, field_name)

        public_base_url = os.getenv("PUBLIC_API_URL") or str(request.base_url)

        setattr(
            settings,
            field_name,
            f"{public_base_url.rstrip('/')}/uploads/branding/{filename}",
        )

        db.commit()
        committed = True

        db.refresh(settings)

    except Exception:
        db.rollback()

        if not committed:
            destination.unlink(missing_ok=True)

        raise

    finally:
        file.file.close()

    delete_local_branding_asset(old_url, keep=destination)

    logger.info("Branding asset '%s' replaced by admin %s", asset_name, current_admin.id)

    return settings


@router.delete(
    "/{asset_name}",
    response_model=SiteSettingsResponse,
    summary="Remove a branding image (admin)",
)
def remove_branding_asset(
    asset_name: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    field_name = SETTING_FIELDS.get(asset_name)

    if field_name is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branding image type not found",
        )

    settings = get_or_create_settings(db)
    old_url = getattr(settings, field_name)

    setattr(settings, field_name, None)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(settings)

    delete_local_branding_asset(old_url)

    logger.info("Branding asset '%s' removed by admin %s", asset_name, current_admin.id)

    return settings