import re
from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]

_PHONE_PATTERN = re.compile(r"\+?[0-9][0-9 -]*")


def _check_password(value: str) -> str:
    if not value.strip():
        raise ValueError("Password cannot be only whitespace")

    return value

AdminPassword = Annotated[
    str,
    Field(min_length=12, max_length=128),
    AfterValidator(_check_password),
]


class AdminCreate(BaseModel):
    first_name: Name
    last_name: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=100),
    ] = None
    email: EmailStr
    phone_number: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=7, max_length=20)
    ]
    password: AdminPassword

    @field_validator("last_name")
    @classmethod
    def clean_last_name(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)

        if not _PHONE_PATTERN.fullmatch(value) or not 7 <= len(digits) <= 15:
            raise ValueError(
                "Phone number may contain only digits, spaces and hyphens, "
                "with an optional leading +, and 7 to 15 digits"
            )

        return value


class AdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str
    is_active: bool
    role: str
    created_at: datetime


class AdminStatusUpdate(BaseModel):
    is_active: bool

class AdminPasswordUpdate(BaseModel):
    password: AdminPassword