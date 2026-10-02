"""normalize product brands

Revision ID: a34b94d1e8f2
Revises: ed2f79a83a11
Create Date: 2026-10-02 12:00:00.000000
"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a34b94d1e8f2"
down_revision: Union[str, Sequence[str], None] = "ed2f79a83a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_brands_id"), "brands", ["id"], unique=False)
    op.add_column("products", sa.Column("brand_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_products_brand_id"), "products", ["brand_id"], unique=False)
    op.create_foreign_key(
        "fk_products_brand_id_brands",
        "products",
        "brands",
        ["brand_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    connection = op.get_bind()
    products = sa.table(
        "products",
        sa.column("id", sa.Integer()),
        sa.column("brand", sa.String(length=100)),
        sa.column("brand_id", sa.Integer()),
    )
    brands = sa.table(
        "brands",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String(length=100)),
        sa.column("logo_url", sa.String(length=500)),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
    )

    existing_names = connection.execute(
        sa.select(products.c.brand).distinct().where(
            products.c.brand.is_not(None),
            sa.func.trim(products.c.brand) != "",
        )
    ).scalars().all()
    now = datetime.utcnow()
    brand_ids: dict[str, int] = {}
    for existing_name in existing_names:
        name = existing_name.strip()
        if name not in brand_ids:
            brand_ids[name] = connection.execute(
                sa.insert(brands)
                .values(
                    name=name,
                    logo_url=None,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
                .returning(brands.c.id)
            ).scalar_one()
        connection.execute(
            sa.update(products)
            .where(sa.func.trim(products.c.brand) == name)
            .values(brand_id=brand_ids[name])
        )

    remaining = connection.scalar(
        sa.select(sa.func.count())
        .select_from(products)
        .where(
            products.c.brand.is_not(None),
            sa.func.trim(products.c.brand) != "",
            products.c.brand_id.is_(None),
        )
    )
    if remaining:
        raise RuntimeError(f"Brand backfill left {remaining} products unassigned")

    op.drop_column("products", "brand")


def downgrade() -> None:
    op.add_column("products", sa.Column("brand", sa.String(length=100), nullable=True))
    connection = op.get_bind()
    products = sa.table(
        "products",
        sa.column("brand", sa.String(length=100)),
        sa.column("brand_id", sa.Integer()),
    )
    brands = sa.table(
        "brands",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String(length=100)),
    )
    connection.execute(
        sa.update(products).values(
            brand=sa.select(brands.c.name)
            .where(brands.c.id == products.c.brand_id)
            .scalar_subquery()
        )
    )
    op.drop_constraint("fk_products_brand_id_brands", "products", type_="foreignkey")
    op.drop_index(op.f("ix_products_brand_id"), table_name="products")
    op.drop_column("products", "brand_id")
    op.drop_index(op.f("ix_brands_id"), table_name="brands")
    op.drop_table("brands")
