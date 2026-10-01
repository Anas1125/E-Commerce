from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductResponse
from app.services.dependencies import require_admin
from app.models.product_image import ProductImage
from app.schemas.product_image import (
    ProductImageCreate,
    ProductImageResponse,
)
from app.models.inventory import Inventory
from app.schemas.inventory import InventoryResponse, InventoryUpdate


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)


@router.get("/", response_model=list[ProductResponse])
def get_products(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Product)
        .where(Product.is_active == True)
        .order_by(Product.id.desc())
    ).all()

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
        inventory = Inventory(
            product_id=product_id,
            quantity=inventory_data.quantity,
            reserved_quantity=0,
        )

        db.add(inventory)
    else:
        if inventory_data.quantity < inventory.reserved_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity cannot be less than reserved quantity",
            )

        inventory.quantity = inventory_data.quantity

    product.stock = inventory_data.quantity

    db.commit()
    db.refresh(inventory)

    return inventory

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

    return product


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
        brand=product_data.brand,
        price=product_data.price,
        category_id=product_data.category_id,
        stock=product_data.stock,
        rating=0,
        is_active=True,
    )

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
    product.brand = product_data.brand
    product.price = product_data.price
    product.category_id = product_data.category_id
    product.stock = product_data.stock

    inventory = db.scalar(
        select(Inventory).where(
            Inventory.product_id == product.id
        )
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

    db.commit()
    db.refresh(product)

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

