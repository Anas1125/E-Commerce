from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=200)
    comment: str | None = Field(default=None, max_length=5_000)

    @field_validator("title", "comment")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return value or None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    product_id: int
    rating: int
    title: str | None = None
    status: str
    comment: str | None = None
    is_verified_purchase: bool
    created_at: datetime