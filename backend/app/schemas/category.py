import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        normalized = " ".join(value.split())

        if not normalized:
            raise ValueError("Category name cannot be empty")

        return normalized

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        slug = value.strip().lower()

        if not _SLUG_PATTERN.fullmatch(slug):
            raise ValueError(
                "Slug may only contain lowercase letters, numbers and single "
                "hyphens between them (for example: running-shoes)"
            )

        return slug

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()
        if not value:
            return None

        if not (
            value.startswith(("http://", "https://"))
            or (value.startswith("/") and not value.startswith("//"))
        ):
            raise ValueError(
                "Image URL must start with http://, https:// or a single /"
            )

        return value


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    image_url: str | None = None