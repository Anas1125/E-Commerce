from pydantic import BaseModel, Field


class ProductImageCreate(BaseModel):
    image_url: str = Field(min_length=1, max_length=500)
    is_primary: bool = False
    display_order: int = Field(default=0, ge=0)


class ProductImagePrimaryUpdate(BaseModel):
    is_primary: bool


class ProductImageResponse(BaseModel):
    id: int
    product_id: int
    image_url: str
    is_primary: bool
    display_order: int

    model_config = {
        "from_attributes": True
    }
