from pydantic import BaseModel


class SiteSettingsResponse(BaseModel):
    navbar_logo_url: str | None = None
    hero_image_url: str | None = None
    footer_logo_url: str | None = None
    favicon_url: str | None = None

    model_config = {"from_attributes": True}
