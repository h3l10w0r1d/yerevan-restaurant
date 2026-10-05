from datetime import date as Date
from datetime import datetime
from typing import List, Optional

from pydantic import EmailStr, field_validator
from sqlmodel import JSON, Column, Field, SQLModel


class ReservationBase(SQLModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    date: Date
    time: str = Field(regex=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=12)
    notes: Optional[str] = Field(default=None, max_length=500)
    language: str = Field(default="en", max_length=5)


class Reservation(ReservationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = Field(default="pending")  # pending | confirmed | cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReservationCreate(ReservationBase):
    pass


class ReservationRead(ReservationBase):
    id: int
    status: str
    created_at: datetime


class StatusUpdate(SQLModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid(cls, v: str) -> str:
        allowed = {"pending", "confirmed", "cancelled", "ready", "completed"}
        if v not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        return v


class OrderLine(SQLModel):
    item_id: str
    quantity: int = Field(ge=1, le=20)


class OrderCreate(SQLModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    pickup_at: datetime
    items: List[OrderLine] = Field(min_length=1)
    notes: Optional[str] = Field(default=None, max_length=500)
    language: str = Field(default="en", max_length=5)


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    phone: str
    pickup_at: datetime
    items: list = Field(sa_column=Column(JSON))
    total_cents: int
    notes: Optional[str] = None
    language: str = "en"
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)
