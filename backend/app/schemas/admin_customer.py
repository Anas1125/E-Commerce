from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdminCustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str
    role: str
    is_active: bool
    created_at: datetime


class AdminCustomerStatusUpdate(BaseModel):
    is_active: bool