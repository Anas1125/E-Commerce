from pydantic import BaseModel, Field


class AddressCreate(BaseModel):
    address_line1: str = Field(min_length=1, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(default="India", max_length=100)
    is_default: bool = False


class AddressResponse(BaseModel):
    id: int
    address_line1: str
    address_line2: str | None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool

    model_config = {
        "from_attributes": True
    }