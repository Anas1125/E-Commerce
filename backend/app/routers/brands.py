from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.brand import Brand
from app.models.product import Product
from app.schemas.brand import BrandCreate, BrandResponse
from app.services.dependencies import require_admin


router = APIRouter(prefix="/api/brands", tags=["Brands"])

BRAND_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "brands"
BRAND_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_URL_PREFIX = "/uploads/brands/"
MAX_LOGO_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())

    if not cleaned:
        raise HTTPException(status_code=400, detail="Brand name is required")

    return cleaned


def _validate_logo_url(logo_url: str | None) -> str | None:
    if not logo_url:
        return None

    if logo_url.startswith("/uploads/") or logo_url.startswith(
        ("http://", "https://")
    ):
        return logo_url

    raise HTTPException(
        status_code=400,
        detail="Logo URL must start with /uploads/, http:// or https://",
    )


def _detect_image_extension(header: bytes) -> str | None:
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return ".webp"
    return None


def _save_logo_file(file: UploadFile) -> str:
    """Stream the upload to disk with a size cap. Returns the file name."""
    header = file.file.read(16)
    extension = _detect_image_extension(header)

    if extension is None:
        raise HTTPException(
            status_code=400,
            detail="Upload a valid JPG, PNG, WebP or GIF image",
        )

    filename = f"{uuid4().hex}{extension}"
    file_path = BRAND_UPLOADS_DIR / filename
    size = len(header)

    try:
        with file_path.open("wb") as buffer:
            buffer.write(header)

            while chunk := file.file.read(CHUNK_SIZE):
                size += len(chunk)

                if size > MAX_LOGO_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Image must be 10 MB or smaller",
                    )

                buffer.write(chunk)
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return filename


def _delete_logo_file(logo_url: str | None) -> None:
    """Delete a previously uploaded logo, only ever inside the brands folder."""
    if not logo_url or not logo_url.startswith(UPLOAD_URL_PREFIX):
        return

    try:
        path = (BRAND_UPLOADS_DIR / Path(logo_url).name).resolve()

        if path.parent == BRAND_UPLOADS_DIR.resolve():
            path.unlink(missing_ok=True)
    except OSError:
        pass

@router.get("/", response_model=list[BrandResponse])
def get_brands(db: Session = Depends(get_db)):
    return db.scalars(
        select(Brand)
        .where(Brand.is_active.is_(True))
        .order_by(Brand.name)
    ).all()


@router.get(
    "/admin/all",
    response_model=list[BrandResponse],
    dependencies=[Depends(require_admin)],
)
def get_all_brands_admin(db: Session = Depends(get_db)):
    """Includes inactive brands so an admin can find and re-activate them."""
    return db.scalars(select(Brand).order_by(Brand.name)).all()


@router.get("/{brand_id}", response_model=BrandResponse)
def get_brand(brand_id: int, db: Session = Depends(get_db)):
    brand = db.scalar(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.is_active.is_(True),
        )
    )
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.post(
    "/",
    response_model=BrandResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_brand(
    brand_data: BrandCreate,
    db: Session = Depends(get_db),
):
    name = _clean_name(brand_data.name)
    logo_url = _validate_logo_url(brand_data.logo_url)

    existing = db.scalar(
        select(Brand).where(func.lower(Brand.name) == name.lower())
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Brand name already exists")

    brand = Brand(
        name=name,
        logo_url=logo_url,
        is_active=brand_data.is_active,
    )
    db.add(brand)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Brand name already exists")

    db.refresh(brand)
    return brand


@router.put(
    "/{brand_id}",
    response_model=BrandResponse,
    dependencies=[Depends(require_admin)],
)
def update_brand(
    brand_id: int,
    brand_data: BrandCreate,
    db: Session = Depends(get_db),
):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    name = _clean_name(brand_data.name)
    logo_url = _validate_logo_url(brand_data.logo_url)

    duplicate = db.scalar(
        select(Brand).where(
            func.lower(Brand.name) == name.lower(),
            Brand.id != brand_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Brand name already exists")

    old_logo = brand.logo_url

    brand.name = name
    brand.logo_url = logo_url
    brand.is_active = brand_data.is_active

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Brand name already exists")

    db.refresh(brand)

    if old_logo != brand.logo_url:
        _delete_logo_file(old_logo)

    return brand


@router.post(
    "/{brand_id}/logo/upload",
    response_model=BrandResponse,
    dependencies=[Depends(require_admin)],
)
def upload_brand_logo(
    brand_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    brand = db.get(Brand, brand_id)

    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    old_logo = brand.logo_url
    filename = _save_logo_file(file)

    brand.logo_url = f"{UPLOAD_URL_PREFIX}{filename}"

    try:
        db.commit()
    except Exception:
        db.rollback()
        _delete_logo_file(f"{UPLOAD_URL_PREFIX}{filename}")
        raise

    db.refresh(brand)

    _delete_logo_file(old_logo)

    return brand


@router.delete(
    "/{brand_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_brand(
    brand_id: int,
    db: Session = Depends(get_db),
):
    brand = db.get(Brand, brand_id)

    if brand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    active_product_exists = db.scalar(
        select(Product.id)
        .where(
            Product.brand_id == brand_id,
            Product.is_active.is_(True),
        )
        .limit(1)
    )

    if active_product_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This brand is assigned to active products. Remove the brand from those products first.",
        )

    logo_url = brand.logo_url

    db.execute(
        update(Product)
        .where(
            Product.brand_id == brand_id,
            Product.is_active.is_(False),
        )
        .values(brand_id=None)
    )

    db.delete(brand)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This brand is still in use by products and cannot be deleted.",
        )

    _delete_logo_file(logo_url)