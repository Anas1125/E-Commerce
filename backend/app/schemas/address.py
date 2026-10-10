import re

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

_INDIAN_PIN = re.compile(r"[1-9][0-9]{5}")
_GENERIC_POSTAL_CODE = re.compile(r"[A-Za-z0-9][A-Za-z0-9 -]*")


class AddressCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    address_line1: str = Field(min_length=1, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(default="India", min_length=1, max_length=100)
    is_default: bool = False

    @field_validator("address_line2")
    @classmethod
    def blank_line2_to_none(cls, value: str | None) -> str | None:
        return value or None

    @model_validator(mode="after")
    def validate_postal_code(self):
        if self.country.casefold() == "india":
            if not _INDIAN_PIN.fullmatch(self.postal_code):
                raise ValueError(
                    "Indian PIN codes must be 6 digits and cannot start with 0"
                )
        elif not _GENERIC_POSTAL_CODE.fullmatch(self.postal_code):
            raise ValueError(
                "Postal code may only contain letters, numbers, spaces and hyphens"
            )

        return self


class AddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address_line1: str
    address_line2: str | None
    city: str
    state: str
    postal_code: str
    country: str
    is_default: bool