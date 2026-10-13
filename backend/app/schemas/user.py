import re

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

_PHONE_SEPARATORS = re.compile(r"[\s\-().]")
_PHONE_PATTERN = re.compile(r"\+?\d{7,15}")


def normalize_phone(value: str) -> str:
    cleaned = _PHONE_SEPARATORS.sub("", value)

    if not _PHONE_PATTERN.fullmatch(cleaned):
        raise ValueError(
            "Enter a valid phone number (7-15 digits, optional leading +)"
        )

    return cleaned


class UserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr
    phone_number: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("first_name", "last_name", "phone_number", mode="before")
    @classmethod
    def trim_whitespace(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("last_name")
    @classmethod
    def blank_last_name_to_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("phone_number")
    @classmethod
    def clean_phone_number(cls, value: str) -> str:
        return normalize_phone(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None = None
    email: str
    phone_number: str
    role: str
    is_active: bool


class UserLogin(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def trim_email(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()


class UserContactUpdate(BaseModel):
    email: EmailStr | None = None
    phone_number: str | None = Field(
        default=None,
        min_length=7,
        max_length=20,
    )

    @field_validator("phone_number", mode="before")
    @classmethod
    def trim_phone_number(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str | None) -> str | None:
        return value.lower() if value else value

    @field_validator("phone_number")
    @classmethod
    def clean_phone_number(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else value

    @model_validator(mode="after")
    def require_at_least_one_field(self):
        if self.email is None and self.phone_number is None:
            raise ValueError("Provide an email or a phone number to update")

        return self