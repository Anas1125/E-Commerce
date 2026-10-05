from pydantic import BaseModel, EmailStr, Field


class AdminCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr
    phone_number: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class AdminResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str
    is_active: bool
    role: str
    created_at: object

    model_config = {
        "from_attributes": True,
    }


class AdminStatusUpdate(BaseModel):
    is_active: bool


class AdminPasswordUpdate(BaseModel):
    password: str = Field(min_length=8, max_length=128)