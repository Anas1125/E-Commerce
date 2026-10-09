"""Reconcile production schema with current application models.

Revision ID: 0c807d40823c
Revises: 9ddc254f2c77
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0c807d40823c"
down_revision = "9ddc254f2c77"
branch_labels = None
depends_on = None


def has_column(table, column):
    return column in {
        item["name"] for item in inspect(op.get_bind()).get_columns(table)
    }


def add_column(table, column):
    if not has_column(table, column.name):
        op.add_column(table, column)


def has_unique(table, name):
    inspector = inspect(op.get_bind())

    if any(
        item.get("name") == name
        for item in inspector.get_unique_constraints(table)
    ):
        return True

    return any(
        item.get("name") == name
        for item in inspector.get_indexes(table)
        if item.get("unique")
    )


def has_fk(table, name, column, target):
    inspector = inspect(op.get_bind())

    return any(
        item.get("name") == name
        or (
            item.get("constrained_columns") == [column]
            and item.get("referred_table") == target
            and item.get("referred_columns") == ["id"]
        )
        for item in inspector.get_foreign_keys(table)
    )


def add_fk(table, name, column, target):
    if not has_fk(table, name, column, target):
        op.create_foreign_key(
            name, table, target, [column], ["id"], ondelete="SET NULL"
        )


def upgrade():
    # Orders
    add_column("orders", sa.Column("idempotency_key", sa.String(64), nullable=True))
    add_column("orders", sa.Column("shipping_name", sa.String(200), nullable=True))
    add_column("orders", sa.Column("shipping_phone", sa.String(20), nullable=True))
    add_column("orders", sa.Column("contact_email", sa.String(255), nullable=True))
    add_column("orders", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    add_column("orders", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))

    if not has_unique("orders", "uq_orders_user_idem_key"):
        op.create_unique_constraint(
            "uq_orders_user_idem_key", "orders", ["user_id", "idempotency_key"]
        )

    # Order item snapshots
    add_column("order_items", sa.Column("product_slug", sa.String(200), nullable=True))
    add_column("order_items", sa.Column("image_url", sa.String(2048), nullable=True))

    # Payment failure details and timestamp
    add_column("payments", sa.Column("failure_code", sa.String(100), nullable=True))
    add_column("payments", sa.Column("failure_reason", sa.Text(), nullable=True))
    add_column(
        "payments",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Products
    add_column("products", sa.Column("review_count", sa.Integer(), server_default=sa.text("0"), nullable=False))
    add_column("products", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    add_column("products", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))

    # Product images
    add_column("product_images", sa.Column("alt_text", sa.String(255), nullable=True))
    add_column("product_images", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))

    # Refunds
    add_column("refunds", sa.Column("decision_note", sa.String(500), nullable=True))
    add_column("refunds", sa.Column("admin_note", sa.Text(), nullable=True))
    add_column("refunds", sa.Column("reviewed_by_id", sa.Integer(), nullable=True))
    add_column("refunds", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    add_column("refunds", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    add_fk("refunds", "fk_refunds_reviewed_by_id_users", "reviewed_by_id", "users")

    # Reviews
    add_column("reviews", sa.Column("moderated_by_id", sa.Integer(), nullable=True))
    add_column("reviews", sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True))
    add_column("reviews", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    add_fk("reviews", "fk_reviews_moderated_by_id_users", "moderated_by_id", "users")

    # Site settings
    add_column("site_settings", sa.Column("updated_by_id", sa.Integer(), nullable=True))
    add_column("site_settings", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    add_fk("site_settings", "fk_site_settings_updated_by_id_users", "updated_by_id", "users")

    # Wishlist
    add_column("wishlist_items", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    raise RuntimeError(
        "Automatic downgrade is disabled for this production reconciliation migration."
    )
