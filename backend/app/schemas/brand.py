from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    logo_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Brand name cannot be empty")
        return normalized


class BrandResponse(BaseModel):
    id: int
    name: str
    logo_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
