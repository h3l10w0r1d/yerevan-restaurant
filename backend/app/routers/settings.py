import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import field_validator
from sqlmodel import Field, Session, SQLModel

from ..db import get_session
from ..deps import manager
from ..store import get_settings, save_settings

router = APIRouter(prefix="/api/admin/settings", dependencies=[Depends(manager)])

HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class Restaurant(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    address: str = Field(max_length=120)
    city: str = Field(max_length=80)
    email: str = Field(max_length=120)
    phone: str = Field(default="", max_length=40)


class Notifications(SQLModel):
    guest_emails: bool = True
    staff_emails: bool = True
    staff_email: str = Field(default="", max_length=200)


class SettingsBody(SQLModel):
    restaurant: Restaurant
    hours: List[Optional[List[str]]]
    slot_capacity: int = Field(ge=1, le=1000)
    slot_minutes: int = Field(ge=10, le=120)
    last_seating_minutes: int = Field(ge=0, le=300)
    max_party_size: int = Field(ge=1, le=100)
    booking_window_days: int = Field(ge=1, le=365)
    ordering_enabled: bool
    notifications: Notifications = Notifications()
    prelaunch: bool = False
    opening_date: str = ""

    @field_validator("opening_date")
    @classmethod
    def valid_opening_date(cls, v: str) -> str:
        v = (v or "").strip()
        if v and not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("opening_date must be YYYY-MM-DD or empty")
        return v

    @field_validator("hours")
    @classmethod
    def valid_hours(cls, v):
        if len(v) != 7:
            raise ValueError("hours needs 7 entries, Monday first")
        for day in v:
            if day is None:
                continue
            if len(day) != 2 or not all(HHMM.match(t) for t in day) or day[0] >= day[1]:
                raise ValueError("each open day needs [open, close] as HH:MM with open before close")
        return v


@router.get("")
def read(session: Session = Depends(get_session)):
    return get_settings(session)


@router.put("")
def write(body: SettingsBody, session: Session = Depends(get_session)):
    if body.slot_minutes <= 0:
        raise HTTPException(422, "invalid")
    return save_settings(session, body.model_dump())
