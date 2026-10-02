from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pathlib import Path
from uuid import uuid4
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.brand import Brand
from app.models.product import Product
from app.models.user import User
from app.schemas.brand import BrandCreate, BrandResponse
from app.services.dependencies import require_admin


router = APIRouter(prefix="/api/brands", tags=["Brands"])

BRAND_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "brands"
BRAND_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/", response_model=list[BrandResponse])
def get_brands(db: Session = Depends(get_db)):
    return db.scalars(
        select(Brand)
        .where(Brand.is_active.is_(True))
        .order_by(Brand.name)
    ).all()


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
)
def create_brand(
    brand_data: BrandCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    existing = db.scalar(
        select(Brand).where(func.lower(Brand.name) == brand_data.name.lower())
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Brand name already exists")

    brand = Brand(
        name=brand_data.name,
        logo_url=brand_data.logo_url,
        is_active=brand_data.is_active,
    )
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.put("/{brand_id}", response_model=BrandResponse)
def update_brand(
    brand_id: int,
    brand_data: BrandCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    duplicate = db.scalar(
        select(Brand).where(
            func.lower(Brand.name) == brand_data.name.lower(),
            Brand.id != brand_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Brand name already exists")

    brand.name = brand_data.name
    brand.logo_url = brand_data.logo_url
    brand.is_active = brand_data.is_active
    db.commit()
    db.refresh(brand)
    return brand

@router.post("/{brand_id}/logo/upload", response_model=BrandResponse)
def upload_brand_logo(
    brand_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    brand = db.get(Brand, brand_id)

    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed",
        )

    extension = Path(file.filename or "").suffix.lower()

    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format",
        )

    filename = f"{uuid4().hex}{extension}"
    file_path = BRAND_UPLOADS_DIR / filename

    with file_path.open("wb") as buffer:
        buffer.write(file.file.read())

    brand.logo_url = f"/uploads/brands/{filename}"

    db.commit()
    db.refresh(brand)

    return brand

@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    brand = db.get(Brand, brand_id)

    if brand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Check whether any ACTIVE products are still using this brand.
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

    # Products that were previously deleted/deactivated can keep
    # their database records for history, but they no longer need
    # to keep the brand relationship.
    db.query(Product).filter(
        Product.brand_id == brand_id,
        Product.is_active.is_(False),
    ).update(
        {
            Product.brand_id: None,
        },
        synchronize_session=False,
    )

    # Now the brand has no products referencing it.
    db.delete(brand)
    db.commit()