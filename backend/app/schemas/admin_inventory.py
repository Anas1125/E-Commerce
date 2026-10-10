from pydantic import BaseModel, ConfigDict, Field


class AdminInventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    available_quantity: int


class AdminInventoryUpdate(BaseModel):
    quantity: int = Field(ge=0, le=1_000_000)