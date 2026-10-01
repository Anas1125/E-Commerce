from fastapi import APIRouter, Depends, HTTPException, status
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