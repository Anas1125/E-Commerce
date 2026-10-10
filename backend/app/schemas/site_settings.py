import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

DEFAULT_SITE_NAME = "TerraLens"

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


class SiteSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    site_name: str = Field(default=DEFAULT_SITE_NAME, max_length=150)

    navbar_logo_url: str | None = None
    hero_image_url: str | None = None
    footer_logo_url: str | None = None
    favicon_url: str | None = None

    @field_validator("site_name", mode="before")
    @classmethod
    def fall_back_to_default_name(cls, value):
        if value is None or not str(value).strip():
            return DEFAULT_SITE_NAME

        return value


class SiteNameUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    site_name: str = Field(min_length=1, max_length=150)

    @field_validator("site_name")
    @classmethod
    def reject_control_characters(cls, value: str) -> str:
        if _CONTROL_CHARS.search(value):
            raise ValueError("site_name must not contain control characters")

        return value