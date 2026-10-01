from datetime import datetime
from pydantic import BaseModel


class AdminCustomerResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None
    email: str
    phone_number: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminCustomerStatusUpdate(BaseModel):
    is_active: bool