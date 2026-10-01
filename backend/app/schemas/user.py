from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr
    phone_number: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None
    email: EmailStr
    phone_number: str
    role: str
    is_active: bool

    model_config = {
        "from_attributes": True
    }

class UserLogin(BaseModel):
    email: EmailStr
    password: str