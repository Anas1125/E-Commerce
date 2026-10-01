from pydantic import BaseModel, Field


class AdminInventoryResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    available_quantity: int

    model_config = {"from_attributes": True}


class AdminInventoryUpdate(BaseModel):
    quantity: int = Field(ge=0)