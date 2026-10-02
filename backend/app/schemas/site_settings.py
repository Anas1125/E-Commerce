from pydantic import BaseModel, Field


class SiteSettingsResponse(BaseModel):
    site_name: str = Field(
        default="TerraLens",
        max_length=150,
    )

    navbar_logo_url: str | None = None
    hero_image_url: str | None = None
    footer_logo_url: str | None = None
    favicon_url: str | None = None

    model_config = {
        "from_attributes": True,
    }


class SiteNameUpdate(BaseModel):
    site_name: str = Field(
        min_length=1,
        max_length=150,
    )