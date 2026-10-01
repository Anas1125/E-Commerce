from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)
    image_url: str | None = Field(default=None, max_length=500)


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    image_url: str | None = None

    model_config = {
        "from_attributes": True
    }
