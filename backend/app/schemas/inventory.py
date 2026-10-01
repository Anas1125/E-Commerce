from pydantic import BaseModel, Field


class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0)


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    reserved_quantity: int

    model_config = {
        "from_attributes": True
    }