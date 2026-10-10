from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    logo_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        normalized = " ".join(value.split())

        if not normalized:
            raise ValueError("Brand name cannot be empty")

        return normalized

    @field_validator("logo_url")
    @classmethod
    def validate_logo_url(cls, value: str | None) -> str | None:
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
                "Logo URL must start with http://, https:// or a single /"
            )

        return value


class BrandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    logo_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime