from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.site_settings import SiteSettings
from app.models.user import User
from app.schemas.site_settings import (
    SiteNameUpdate,
    SiteSettingsResponse,
)
from app.services.dependencies import require_admin


router = APIRouter(prefix="/api/site-settings", tags=["Site Settings"])
BRANDING_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "branding"
MAX_IMAGE_SIZE = 10 * 1024 * 1024
IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
    ".ico": (("image/x-icon", "image/vnd.microsoft.icon"), lambda data: len(data) >= 6 and data[:4] == b"\x00\x00\x01\x00"),
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
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/", response_model=SiteSettingsResponse)
def read_site_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)

@router.patch("/name", response_model=SiteSettingsResponse)
def update_site_name(
    site_data: SiteNameUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    site_name = site_data.site_name.strip()

    if not site_name:
        raise HTTPException(
            status_code=400,
            detail="Website name cannot be empty",
        )

    settings = get_or_create_settings(db)
    settings.site_name = site_name

    db.commit()
    db.refresh(settings)

    return settings


@router.post("/{asset_name}/upload", response_model=SiteSettingsResponse)
async def upload_branding_asset(
    asset_name: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    field_name = SETTING_FIELDS.get(asset_name)
    if field_name is None:
        raise HTTPException(status_code=404, detail="Branding image type not found")

    extension = Path(file.filename or "").suffix.lower()
    image_format = IMAGE_FORMATS.get(extension)
    if image_format is None:
        raise HTTPException(status_code=400, detail="Use a JPG, JPEG, PNG, WebP, or ICO image")
    content_types, signature_matches = image_format
    if isinstance(content_types, str):
        content_types = (content_types,)
    if file.content_type not in (*content_types, "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Image file type does not match its extension")

    contents = await file.read(MAX_IMAGE_SIZE + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The selected image is empty")
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Images must be 10 MB or smaller")
    if not signature_matches(contents):
        raise HTTPException(status_code=400, detail="The selected file is not a valid supported image")

    BRANDING_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    destination = BRANDING_UPLOADS_DIR / filename
    old_url = None
    try:
        destination.write_bytes(contents)
        settings = get_or_create_settings(db)
        old_url = getattr(settings, field_name)
        setattr(settings, field_name, f"{str(request.base_url).rstrip('/')}/uploads/branding/{filename}")
        db.commit()
        db.refresh(settings)
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    delete_local_branding_asset(old_url, keep=destination)
    return settings


@router.delete("/{asset_name}", response_model=SiteSettingsResponse)
def remove_branding_asset(
    asset_name: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    field_name = SETTING_FIELDS.get(asset_name)
    if field_name is None:
        raise HTTPException(status_code=404, detail="Branding image type not found")
    settings = get_or_create_settings(db)
    old_url = getattr(settings, field_name)
    setattr(settings, field_name, None)
    db.commit()
    db.refresh(settings)
    delete_local_branding_asset(old_url)
    return settings


def delete_local_branding_asset(url: str | None, keep: Path | None = None) -> None:
    if not url or "/uploads/branding/" not in url:
        return
    filename = url.split("/uploads/branding/", maxsplit=1)[1].split("?", maxsplit=1)[0]
    if not filename or Path(filename).name != filename:
        return
    candidate = BRANDING_UPLOADS_DIR / filename
    if candidate != keep:
        candidate.unlink(missing_ok=True)
