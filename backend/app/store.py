"""Settings, seeding and booking rules shared by the public and admin routes."""
import copy
import json
import re
from datetime import date as Date
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlmodel import Session, func, select

from . import config
from .models import Category, MenuItem, Reservation, Setting, User
from .security import hash_password

TZ = ZoneInfo("Europe/Amsterdam")
SEED_MENU = Path(__file__).parent / "data" / "menu.json"


def now_local() -> datetime:
    return datetime.now(TZ).replace(tzinfo=None)


# --- Settings -------------------------------------------------------------

def get_settings(session: Session) -> dict:
    merged = copy.deepcopy(config.DEFAULT_SETTINGS)
    row = session.get(Setting, "site")
    if row:
        for key, value in row.value.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key].update(value)
            else:
                merged[key] = value
    return merged


def save_settings(session: Session, values: dict) -> dict:
    row = session.get(Setting, "site") or Setting(key="site", value={})
    row.value = values
    session.add(row)
    session.commit()
    return get_settings(session)


# --- Booking rules --------------------------------------------------------

def _to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _fmt(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def slots_for(day: Date, settings: dict) -> List[str]:
    hours = settings["hours"][day.weekday()]
    if not hours:
        return []
    start = _to_min(hours[0])
    end = _to_min(hours[1]) - settings["last_seating_minutes"]
    return [_fmt(m) for m in range(start, end + 1, settings["slot_minutes"])]


def booked_guests(session: Session, day: Date, time: str, exclude_id: Optional[int] = None) -> int:
    q = select(func.coalesce(func.sum(Reservation.guests), 0)).where(
        Reservation.date == day,
        Reservation.time == time,
        Reservation.status.not_in(["cancelled", "no_show"]),
    )
    if exclude_id:
        q = q.where(Reservation.id != exclude_id)
    return int(session.exec(q).one())


# --- Menu -----------------------------------------------------------------

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


def unique_id(session: Session, model, base: str) -> str:
    candidate, n = base, 2
    while session.get(model, candidate):
        candidate, n = f"{base}-{n}", n + 1
    return candidate


def public_menu(session: Session, include_unavailable: bool = False) -> dict:
    """The menu in the shape the public site has always consumed."""
    cats = session.exec(select(Category).order_by(Category.position)).all()
    items = session.exec(select(MenuItem).order_by(MenuItem.position)).all()
    out = []
    for cat in cats:
        entries = [
            {
                "id": i.id,
                "name": {"en": i.name_en, "nl": i.name_nl},
                "description": {"en": i.description_en, "nl": i.description_nl},
                "price": i.price,
                "tags": i.tags or [],
                "featured": bool(i.featured),
                **({"badge": i.badge} if i.badge else {}),
                **({"image": i.image} if i.image else {}),
                **({"available": i.available} if include_unavailable else {}),
            }
            for i in items
            if i.category_id == cat.id and (include_unavailable or i.available)
        ]
        entry = {"id": cat.id, "name": {"en": cat.name_en, "nl": cat.name_nl}, "items": entries}
        if cat.note_en or cat.note_nl:
            entry["note"] = {"en": cat.note_en or "", "nl": cat.note_nl or ""}
        if entries or include_unavailable:
            out.append(entry)
    return {"currency": "EUR", "categories": out}


# --- Seeding --------------------------------------------------------------

def seed(session: Session) -> None:
    if not session.exec(select(User)).first():
        session.add(User(
            email=config.ADMIN_EMAIL,
            name=config.ADMIN_NAME,
            password_hash=hash_password(config.ADMIN_PASSWORD),
            role="owner",
        ))

    if not session.exec(select(Category)).first():
        data = json.loads(SEED_MENU.read_text(encoding="utf-8"))
        for ci, cat in enumerate(data["categories"]):
            session.add(Category(
                id=cat["id"],
                name_en=cat["name"]["en"],
                name_nl=cat["name"]["nl"],
                note_en=(cat.get("note") or {}).get("en"),
                note_nl=(cat.get("note") or {}).get("nl"),
                position=ci,
            ))
            for ii, item in enumerate(cat["items"]):
                session.add(MenuItem(
                    id=item["id"],
                    category_id=cat["id"],
                    name_en=item["name"]["en"],
                    name_nl=item["name"]["nl"],
                    description_en=item["description"]["en"],
                    description_nl=item["description"]["nl"],
                    price=item["price"],
                    tags=item.get("tags", []),
                    image=item.get("image"),
                    featured=item.get("featured", False),
                    badge=item.get("badge"),
                    position=ii,
                ))
    session.commit()
