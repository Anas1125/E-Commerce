import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_WHITESPACE = re.compile(r"\s")


class ProductImageCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    image_url: str = Field(min_length=1, max_length=500)
    is_primary: bool = False
    display_order: int = Field(default=0, ge=0, le=10_000)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str) -> str:
        if _WHITESPACE.search(value):
            raise ValueError("image_url must not contain whitespace")

        lowered = value.lower()

        is_http = lowered.startswith(("http://", "https://"))
        is_relative = value.startswith("/") and not value.startswith("//")

        if not (is_http or is_relative):
            raise ValueError("image_url must be an http(s) URL or a path starting with '/'")

        return value


class ProductImagePrimaryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_primary: bool

class ProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    image_url: str
    is_primary: bool
    display_order: int