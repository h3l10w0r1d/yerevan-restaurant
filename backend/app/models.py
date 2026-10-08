from datetime import date as Date
from datetime import datetime
from typing import List, Optional

from pydantic import EmailStr, field_validator
from sqlalchemy import Column, LargeBinary
from sqlmodel import JSON, Field, SQLModel

ROLES = ("owner", "manager", "staff")
RESERVATION_STATUSES = ("pending", "confirmed", "seated", "completed", "cancelled", "no_show")
ORDER_STATUSES = ("pending", "confirmed", "ready", "completed", "cancelled")


# --- Accounts -------------------------------------------------------------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    password_hash: str
    role: str = "staff"
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None


class AuthSession(SQLModel, table=True):
    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime


class UserRead(SQLModel):
    id: int
    email: str
    name: str
    role: str
    active: bool
    created_at: datetime
    last_login_at: Optional[datetime]


# --- Reservations ---------------------------------------------------------

class Reservation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = None
    phone: str = ""
    date: Date = Field(index=True)
    time: str
    guests: int
    notes: Optional[str] = None
    internal_note: Optional[str] = None
    language: str = "en"
    source: str = "web"  # web | phone | walk_in | admin
    status: str = Field(default="pending", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReservationCreate(SQLModel):
    """Public booking form."""
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    date: Date
    time: str = Field(regex=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=50)
    notes: Optional[str] = Field(default=None, max_length=500)
    language: str = Field(default="en", max_length=5)


class ReservationAdminWrite(SQLModel):
    """Staff-entered or edited booking; capacity rules are advisory here."""
    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: str = Field(default="", max_length=40)
    date: Date
    time: str = Field(regex=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=200)
    notes: Optional[str] = Field(default=None, max_length=500)
    internal_note: Optional[str] = Field(default=None, max_length=1000)
    source: str = "phone"
    status: str = "confirmed"
    language: str = Field(default="en", max_length=5)
    notify_guest: bool = True  # email the guest about this change (if they have an address)

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in RESERVATION_STATUSES:
            raise ValueError(f"status must be one of {RESERVATION_STATUSES}")
        return v


class StatusUpdate(SQLModel):
    status: str
    notify: bool = True  # email the guest about the change, where relevant


# --- Orders ---------------------------------------------------------------

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


# --- Menu -----------------------------------------------------------------

class Category(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name_en: str
    name_nl: str
    note_en: Optional[str] = None
    note_nl: Optional[str] = None
    position: int = 0


class MenuItem(SQLModel, table=True):
    id: str = Field(primary_key=True)
    category_id: str = Field(foreign_key="category.id", index=True)
    name_en: str
    name_nl: str
    description_en: str = ""
    description_nl: str = ""
    price: int  # cents
    tags: list = Field(default_factory=list, sa_column=Column(JSON))
    image: Optional[str] = None
    available: bool = True
    position: int = 0


class CategoryWrite(SQLModel):
    name_en: str = Field(min_length=1, max_length=80)
    name_nl: str = Field(min_length=1, max_length=80)
    note_en: Optional[str] = Field(default=None, max_length=200)
    note_nl: Optional[str] = Field(default=None, max_length=200)


class MenuItemWrite(SQLModel):
    category_id: str
    name_en: str = Field(min_length=1, max_length=120)
    name_nl: str = Field(min_length=1, max_length=120)
    description_en: str = Field(default="", max_length=400)
    description_nl: str = Field(default="", max_length=400)
    price: int = Field(ge=0, le=100_000)
    tags: List[str] = Field(default_factory=list)
    image: Optional[str] = Field(default=None, max_length=300)
    available: bool = True


class Image(SQLModel, table=True):
    id: str = Field(primary_key=True)
    content_type: str
    size: int
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)


# --- Settings -------------------------------------------------------------

class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: dict = Field(sa_column=Column(JSON))


# --- Email ----------------------------------------------------------------

class EmailLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    to: str
    subject: str
    template: str = Field(index=True)
    related: Optional[str] = None  # e.g. "reservation:12"
    status: str  # sent | failed | skipped
    provider_id: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PasswordToken(SQLModel, table=True):
    """One-time link for invites and password resets. Only the hash is stored."""
    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    purpose: str  # invite | reset
    expires_at: datetime
    used_at: Optional[datetime] = None
