from pydantic import BaseModel, ConfigDict, Field

MAX_STOCK_QUANTITY = 1_000_000


class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0, le=MAX_STOCK_QUANTITY)


class InventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    available_quantity: int