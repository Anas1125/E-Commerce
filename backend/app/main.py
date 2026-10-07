from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.products import router as products_router
from app.routers.discounts import router as discounts_router
from app.routers.cart import router as cart_router
from app.routers.wishlist import router as wishlist_router
from app.routers.reviews import router as reviews_router
from app.routers.orders import router as orders_router
from app.routers.addresses import router as addresses_router
from app.routers.coupons import router as coupons_router
from app.routers.payments import router as payments_router
from app.routers.refunds import router as refunds_router
from app.routers.admin_orders import router as admin_orders_router
from app.routers.admin_customers import router as admin_customers_router
from app.routers.admin_refunds import router as admin_refunds_router
from app.routers.admin_inventory import router as admin_inventory_router
from app.routers.site_settings import router as site_settings_router
from app.routers.brands import router as brands_router
from app.routers.admin_admins import router as admin_admins_router
from app.routers import admin_reviews
from app.routers.notifications import router as notifications_router

app = FastAPI(title="TerraLens E-Commerce API")
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://e-commerce-3q5.pages.dev",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(discounts_router)
app.include_router(coupons_router)
app.include_router(cart_router)
app.include_router(wishlist_router)
app.include_router(reviews_router)
app.include_router(addresses_router)
app.include_router(orders_router)
app.include_router(payments_router)
app.include_router(refunds_router)  
app.include_router(admin_orders_router)
app.include_router(admin_customers_router)
app.include_router(admin_refunds_router)
app.include_router(admin_inventory_router)
app.include_router(site_settings_router)
app.include_router(brands_router)
app.include_router(admin_admins_router)
app.include_router(admin_reviews.router)
app.include_router(
    notifications_router,
    prefix="/api",
)   

@app.get("/")
def root():
    return {"message": "TerraLens E-Commerce API is running"}
