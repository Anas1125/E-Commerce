from pathlib import Path
from uuid import uuid4
import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"],
)

CATEGORY_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "categories"
CATEGORY_IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


@router.post("/images/upload", status_code=status.HTTP_201_CREATED)
async def upload_category_image(
    request: Request,
    file: UploadFile = File(...),
    current_admin: User = Depends(require_admin),
):
    extension = Path(file.filename or "").suffix.lower()
    image_format = CATEGORY_IMAGE_FORMATS.get(extension)
    if image_format is None:
        raise HTTPException(status_code=400, detail="Use a JPG, JPEG, PNG, or WebP image")
    content_type, signature_matches = image_format
    if file.content_type not in (content_type, "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Image file type does not match its extension")

    contents = await file.read(10 * 1024 * 1024 + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The selected image is empty")
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Category images must be 10 MB or smaller")
    if not signature_matches(contents):
        raise HTTPException(status_code=400, detail="The selected file is not a valid supported image")

    CATEGORY_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (CATEGORY_UPLOADS_DIR / filename).write_bytes(contents)
    await file.close()
    public_base_url = os.getenv(
        "PUBLIC_API_URL",
        str(request.base_url).rstrip("/"),
    )

    return {
        "image_url": (
            f"{public_base_url.rstrip('/')}"
            f"/uploads/categories/{filename}"
        )
    }

@router.get("/", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Category).order_by(Category.name)
    ).all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    return category


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    existing_name = db.scalar(
        select(Category).where(Category.name == category_data.name)
    )

    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )

    existing_slug = db.scalar(
        select(Category).where(Category.slug == category_data.slug)
    )

    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category slug already exists",
        )

    category = Category(
        name=category_data.name,
        slug=category_data.slug,
        image_url=category_data.image_url,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    existing_name = db.scalar(
        select(Category).where(
            Category.name == category_data.name,
            Category.id != category_id,
        )
    )

    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )

    existing_slug = db.scalar(
        select(Category).where(
            Category.slug == category_data.slug,
            Category.id != category_id,
        )
    )

    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category slug already exists",
        )

    category.name = category_data.name
    category.slug = category_data.slug
    if "image_url" in category_data.model_fields_set:
        category.image_url = category_data.image_url

    db.commit()
    db.refresh(category)

    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    product_exists = db.scalar(
        select(Product.id)
        .where(Product.category_id == category_id)
        .limit(1)
    )

    if product_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a category that has products",
        )

    db.delete(category)
    db.commit()
