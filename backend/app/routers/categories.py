import os
import re
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryCreate, CategoryResponse
from app.services.dependencies import require_admin


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"],
)

CATEGORY_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "categories"
UPLOAD_PATH_PREFIX = "/uploads/categories/"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

CATEGORY_IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())

    if not cleaned:
        raise HTTPException(status_code=400, detail="Category name is required")

    return cleaned


def _clean_slug(slug: str) -> str:
    cleaned = slug.strip().lower()

    if not SLUG_PATTERN.fullmatch(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Slug may only contain lowercase letters, numbers and single hyphens",
        )

    return cleaned



def _validate_image_url(image_url: str | None) -> str | None:
    if not image_url:
        return None

    if image_url.startswith("/uploads/"):
        path = urlparse(image_url).path
        if (
            path.startswith(UPLOAD_PATH_PREFIX)
            and ".." not in Path(path).parts
        ):
            return image_url

        raise HTTPException(
            status_code=400,
            detail="Invalid uploaded image path",
        )

    if image_url.startswith(("http://", "https://")):
        parsed = urlparse(image_url)
        if parsed.netloc:
            return image_url

    raise HTTPException(
        status_code=400,
        detail="Image URL must be a valid uploaded path or HTTP(S) URL",
    )



def _delete_image_file(image_url: str | None) -> None:
    if not image_url:
        return

    path_part = urlparse(image_url).path

    if not path_part.startswith(UPLOAD_PATH_PREFIX):
        return

    try:
        # .name drops any directory parts, so ../ tricks can't escape
        path = (CATEGORY_UPLOADS_DIR / Path(path_part).name).resolve()

        if path.parent == CATEGORY_UPLOADS_DIR.resolve():
            path.unlink(missing_ok=True)
    except OSError:
        pass


def _ensure_unique(
    db: Session,
    name: str,
    slug: str,
    exclude_id: int | None = None,
) -> None:
    name_query = select(Category).where(
        func.lower(Category.name) == name.lower()
    )
    slug_query = select(Category).where(Category.slug == slug)

    if exclude_id is not None:
        name_query = name_query.where(Category.id != exclude_id)
        slug_query = slug_query.where(Category.id != exclude_id)

    if db.scalar(name_query):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )

    if db.scalar(slug_query):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category slug already exists",
        )

@router.post(
    "/images/upload",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def upload_category_image(
    request: Request,
    file: UploadFile = File(...),
):
    extension = Path(file.filename or "").suffix.lower()
    image_format = CATEGORY_IMAGE_FORMATS.get(extension)
    if image_format is None:
        raise HTTPException(status_code=400, detail="Use a JPG, JPEG, PNG, or WebP image")
    content_type, signature_matches = image_format
    if file.content_type not in (content_type, "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Image file type does not match its extension")

    contents = await file.read(MAX_IMAGE_BYTES + 1)
    await file.close()

    if not contents:
        raise HTTPException(status_code=400, detail="The selected image is empty")
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Category images must be 10 MB or smaller")
    if not signature_matches(contents):
        raise HTTPException(status_code=400, detail="The selected file is not a valid supported image")

    CATEGORY_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"

    
    file_path = CATEGORY_UPLOADS_DIR / filename

    try:
        await run_in_threadpool(file_path.write_bytes, contents)
    except OSError:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save category image",
        )


    public_base_url = os.getenv(
        "PUBLIC_API_URL",
        str(request.base_url).rstrip("/"),
    )

    return {
        "image_url": (
            f"{public_base_url.rstrip('/')}"
            f"{UPLOAD_PATH_PREFIX}{filename}"
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
    dependencies=[Depends(require_admin)],
)
def create_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
):
    name = _clean_name(category_data.name)
    slug = _clean_slug(category_data.slug)
    image_url = _validate_image_url(category_data.image_url)

    _ensure_unique(db, name, slug)

    category = Category(
        name=name,
        slug=slug,
        image_url=image_url,
    )

    db.add(category)

    try:
        db.commit()
    except IntegrityError:

        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name or slug already exists",
        )

    db.refresh(category)

    return category


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
    dependencies=[Depends(require_admin)],
)
def update_category(
    category_id: int,
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    name = _clean_name(category_data.name)
    slug = _clean_slug(category_data.slug)

    _ensure_unique(db, name, slug, exclude_id=category_id)

    old_image = category.image_url

    category.name = name
    category.slug = slug
    if "image_url" in category_data.model_fields_set:
        category.image_url = _validate_image_url(category_data.image_url)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name or slug already exists",
        )

    db.refresh(category)
    if old_image != category.image_url:
        _delete_image_file(old_image)

    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
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
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category that has products",
        )

    image_url = category.image_url

    db.delete(category)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category that has products",
        )

    _delete_image_file(image_url)