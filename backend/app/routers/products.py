from pathlib import Path
from uuid import uuid4
import os
import logging

from sqlalchemy.exc import SQLAlchemyError

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.brand import Brand
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductResponse
from app.services.dependencies import require_admin
from app.models.product_image import ProductImage
from app.schemas.product_image import (
    ProductImageCreate,
    ProductImagePrimaryUpdate,
    ProductImageResponse,
)
from app.models.inventory import Inventory
from app.schemas.inventory import InventoryResponse, InventoryUpdate


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)
logger = logging.getLogger(__name__)


def assign_product_brand(db: Session, product: Product, product_data: ProductCreate) -> None:
    fields_set = product_data.model_fields_set
    if "brand_id" in fields_set:
        if product_data.brand_id is None:
            product.brand_record = None
            return
        brand = db.get(Brand, product_data.brand_id)
        if brand is None:
            raise HTTPException(status_code=400, detail="Brand not found")
        if not brand.is_active and brand.id != product.brand_id:
            raise HTTPException(status_code=400, detail="Brand is inactive")
        product.brand_record = brand
        return

    if "brand" not in fields_set:
        return
    name = (product_data.brand or "").strip()
    if not name:
        product.brand_record = None
        return

    brand = db.scalar(
        select(Brand).where(func.lower(Brand.name) == name.lower())
    )
    if brand is None:
        brand = Brand(name=name, is_active=True)
        db.add(brand)
        db.flush()
    elif not brand.is_active and brand.id != product.brand_id:
        raise HTTPException(status_code=400, detail="Brand is inactive")
    product.brand_record = brand

PRODUCT_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "products"
MAX_PRODUCT_IMAGE_SIZE = 10 * 1024 * 1024
IMAGE_FORMATS = {
    ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
    ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


def product_with_available_stock(product: Product, db: Session) -> ProductResponse:
    inventory = db.scalar(
        select(Inventory).where(Inventory.product_id == product.id)
    )
    available = 0 if inventory is None else max(
        0, inventory.quantity - inventory.reserved_quantity
    )
    return ProductResponse.model_validate(product).model_copy(
        update={"available_stock": available}
    )


@router.get("/", response_model=list[ProductResponse])
def get_products(
    db: Session = Depends(get_db),
):
    products = db.scalars(
        select(Product)
        .where(Product.is_active == True)
        .order_by(Product.id.desc())
    ).all()
    return [product_with_available_stock(product, db) for product in products]

@router.get(
    "/{product_id}/images",
    response_model=list[ProductImageResponse],
)
def get_product_images(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return db.scalars(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.display_order)
    ).all()


@router.post(
    "/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_product_image(
    product_id: int,
    image_data: ProductImageCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if image_data.is_primary:
        existing_primary_images = db.scalars(
            select(ProductImage).where(
                ProductImage.product_id == product_id,
                ProductImage.is_primary == True,
            )
        ).all()

        for image in existing_primary_images:
            image.is_primary = False

    image = ProductImage(
        product_id=product_id,
        image_url=image_data.image_url,
        is_primary=image_data.is_primary,
        display_order=image_data.display_order,
    )

    db.add(image)
    db.commit()
    db.refresh(image)

    return image


@router.post(
    "/{product_id}/images/upload",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_product_image(
    product_id: int,
    request: Request,
    file: UploadFile = File(...),
    is_primary: bool = Form(default=False),
    display_order: int = Form(default=0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    extension = Path(file.filename or "").suffix.lower()
    image_format = IMAGE_FORMATS.get(extension)
    if image_format is None:
        raise HTTPException(status_code=400, detail="Use a JPG, JPEG, PNG, or WebP image")
    content_type, signature_matches = image_format
    if file.content_type not in (content_type, "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Image file type does not match its extension")

    contents = await file.read(MAX_PRODUCT_IMAGE_SIZE + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The selected image is empty")
    if len(contents) > MAX_PRODUCT_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Product images must be 10 MB or smaller")
    if not signature_matches(contents):
        raise HTTPException(status_code=400, detail="The selected file is not a valid supported image")

    PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    destination = PRODUCT_UPLOADS_DIR / filename
    relative_url = f"/uploads/products/{filename}"
    public_base_url = os.getenv(
        "PUBLIC_API_URL",
        str(request.base_url).rstrip("/"),
    )
    image = ProductImage(
        product_id=product_id,
        image_url=f"{public_base_url.rstrip('/')}{relative_url}",
        is_primary=is_primary,
        display_order=display_order,
    )
    try:
        destination.write_bytes(contents)
        if is_primary:
            db.query(ProductImage).filter(
                ProductImage.product_id == product_id,
                ProductImage.is_primary.is_(True),
            ).update({ProductImage.is_primary: False}, synchronize_session=False)
        db.add(image)
        db.commit()
        db.refresh(image)
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    return image


@router.patch(
    "/{product_id}/images/{image_id}",
    response_model=ProductImageResponse,
)
def update_product_image(
    product_id: int,
    image_id: int,
    image_data: ProductImagePrimaryUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    image = db.scalar(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
        )
    )
    if image is None:
        raise HTTPException(status_code=404, detail="Product image not found")

    if image_data.is_primary:
        db.query(ProductImage).filter(
            ProductImage.product_id == product_id,
            ProductImage.id != image_id,
        ).update({ProductImage.is_primary: False}, synchronize_session=False)
    image.is_primary = image_data.is_primary
    db.commit()
    db.refresh(image)
    return image


@router.delete(
    "/{product_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product_image(
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    image = db.scalar(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
        )
    )
    if image is None:
        raise HTTPException(status_code=404, detail="Product image not found")

    was_primary = image.is_primary
    db.delete(image)
    db.flush()
    if was_primary:
        replacement = db.scalar(
            select(ProductImage)
            .where(ProductImage.product_id == product_id)
            .order_by(ProductImage.display_order, ProductImage.id)
            .limit(1)
        )
        if replacement is not None:
            replacement.is_primary = True
    db.commit()

@router.get(
    "/{product_id}/inventory",
    response_model=InventoryResponse,
)
def get_product_inventory(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    inventory = db.scalar(
        select(Inventory).where(
            Inventory.product_id == product_id
        )
    )

    if inventory is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory record not found",
        )

    return inventory


@router.put(
    "/{product_id}/inventory",
    response_model=InventoryResponse,
)
def update_product_inventory(
    product_id: int,
    inventory_data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    try:
        product = db.scalar(
            select(Product)
            .where(Product.id == product_id)
            .with_for_update()
        )

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )

        inventory = db.scalar(
            select(Inventory)
            .where(Inventory.product_id == product_id)
            .with_for_update()
        )

        if inventory is None:
            inventory = Inventory(
                product_id=product_id,
                quantity=inventory_data.quantity,
                reserved_quantity=inventory_data.reserved_quantity,
            )
            db.add(inventory)
            db.flush()
        else:
            if inventory_data.quantity < inventory.reserved_quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Total stock cannot be lower than the reserved "
                        f"quantity ({inventory.reserved_quantity})."
                    ),
                )

            inventory.quantity = inventory_data.quantity

        if inventory.reserved_quantity > inventory.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reserved quantity cannot be greater than stock",
            )

        product.stock = inventory.quantity

        db.commit()
        db.refresh(inventory)

        return inventory

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError:
        db.rollback()

        logger.exception(
            "Failed to update inventory for product_id=%s",
            product_id,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update inventory.",
        )


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.is_active == True,
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product_with_available_stock(product, db)


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    category = db.get(Category, product_data.category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found",
        )

    existing_slug = db.scalar(
        select(Product).where(Product.slug == product_data.slug)
    )

    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product slug already exists",
        )

    product = Product(
        name=product_data.name,
        slug=product_data.slug,
        description=product_data.description,
        price=product_data.price,
        category_id=product_data.category_id,
        stock=product_data.stock,
        rating=0,
        is_active=True,
    )
    assign_product_brand(db, product, product_data)

    db.add(product)
    db.flush()

    inventory = Inventory(
        product_id=product.id,
        quantity=product_data.stock,
        reserved_quantity=0,
    )

    db.add(inventory)

    db.commit()
    db.refresh(product)

    return product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    category = db.get(Category, product_data.category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found",
        )

    existing_slug = db.scalar(
        select(Product).where(
            Product.slug == product_data.slug,
            Product.id != product_id,
        )
    )

    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product slug already exists",
        )

    product.name = product_data.name
    product.slug = product_data.slug
    product.description = product_data.description
    assign_product_brand(db, product, product_data)
    product.price = product_data.price
    product.category_id = product_data.category_id


    inventory = db.scalar(
        select(Inventory)
        .where(Inventory.product_id == product.id)
        .with_for_update()
    )

    if inventory is None:
        inventory = Inventory(
            product_id=product.id,
            quantity=product_data.stock,
            reserved_quantity=0,
        )
        db.add(inventory)
    else:
        if product_data.stock < inventory.reserved_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stock cannot be less than reserved quantity",
            )

        inventory.quantity = product_data.stock

    product.stock = inventory.quantity

    try:
        db.commit()
        db.refresh(product)
    except SQLAlchemyError:
        db.rollback()
        logger.exception(
            "Failed to update product_id=%s",
            product_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update product.",
        )

    return product



@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    product.is_active = False

    db.commit()
