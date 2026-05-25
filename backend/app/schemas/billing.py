from typing import Literal

from pydantic import BaseModel


class CheckoutSessionIn(BaseModel):
    plan: Literal["starter", "pro", "business"]
