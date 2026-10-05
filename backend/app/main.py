from datetime import date as Date
from datetime import datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, func, select

from . import config
from .db import get_session, init_db
from .menu import item_index, load_menu
from .models import (
    Order,
    OrderCreate,
    Reservation,
    ReservationCreate,
    ReservationRead,
    StatusUpdate,
)

TZ = ZoneInfo("Europe/Amsterdam")


def now_local() -> datetime:
    return datetime.now(TZ).replace(tzinfo=None)


app = FastAPI(title="Yerevan Restaurant API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def require_admin(x_admin_token: Optional[str] = Header(default=None)) -> None:
    if x_admin_token != config.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")


def _to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _fmt(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def slots_for(day: Date) -> List[str]:
    hours = config.OPENING_HOURS.get(day.weekday())
    if not hours:
        return []
    start, end = _to_min(hours[0]), _to_min(hours[1]) - config.LAST_SEATING_MINUTES
    return [_fmt(m) for m in range(start, end + 1, config.SLOT_MINUTES)]


def booked_guests(session: Session, day: Date, time: str) -> int:
    total = session.exec(
        select(func.coalesce(func.sum(Reservation.guests), 0)).where(
            Reservation.date == day,
            Reservation.time == time,
            Reservation.status != "cancelled",
        )
    ).one()
    return int(total)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/info")
def info():
    return {
        "name": "Yerevan",
        "address": "Kampstraat 22, Hilversum",
        "email": "info@yerevanrestaurant.nl",
        "opening_hours": {str(k): v for k, v in config.OPENING_HOURS.items()},
        "ordering_enabled": config.ORDERING_ENABLED,
        "max_party_size": config.MAX_PARTY_SIZE,
    }


@app.get("/api/menu")
def menu():
    return load_menu()


@app.get("/api/availability")
def availability(
    day: Date = Query(alias="date"),
    guests: int = Query(default=2, ge=1, le=config.MAX_PARTY_SIZE),
    session: Session = Depends(get_session),
):
    now = now_local()
    result = []
    for slot in slots_for(day):
        slot_dt = datetime.combine(day, datetime.strptime(slot, "%H:%M").time())
        free = config.SLOT_CAPACITY - booked_guests(session, day, slot)
        result.append({"time": slot, "available": slot_dt > now and free >= guests})
    return {"date": day.isoformat(), "slots": result}


@app.post("/api/reservations", response_model=ReservationRead, status_code=201)
def create_reservation(data: ReservationCreate, session: Session = Depends(get_session)):
    if data.date < now_local().date() or data.date > now_local().date() + timedelta(days=90):
        raise HTTPException(422, "date_out_of_range")
    if data.time not in slots_for(data.date):
        raise HTTPException(422, "closed")
    slot_dt = datetime.combine(data.date, datetime.strptime(data.time, "%H:%M").time())
    if slot_dt <= now_local():
        raise HTTPException(422, "in_past")
    if booked_guests(session, data.date, data.time) + data.guests > config.SLOT_CAPACITY:
        raise HTTPException(409, "fully_booked")
    reservation = Reservation.model_validate(data)
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return reservation


@app.post("/api/orders", status_code=201)
def create_order(data: OrderCreate, session: Session = Depends(get_session)):
    if not config.ORDERING_ENABLED:
        raise HTTPException(503, "ordering_disabled")
    index = item_index()
    lines, total = [], 0
    for line in data.items:
        item = index.get(line.item_id)
        if not item:
            raise HTTPException(422, f"unknown_item:{line.item_id}")
        subtotal = item["price"] * line.quantity
        total += subtotal
        lines.append({"item_id": line.item_id, "name": item["name"]["en"], "quantity": line.quantity, "price": item["price"]})
    if data.pickup_at.replace(tzinfo=None) <= now_local() + timedelta(minutes=30):
        raise HTTPException(422, "pickup_too_soon")
    order = Order(
        name=data.name, email=data.email, phone=data.phone, pickup_at=data.pickup_at,
        items=lines, total_cents=total, notes=data.notes, language=data.language,
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


# --- Admin -----------------------------------------------------------------

@app.get("/api/admin/reservations", dependencies=[Depends(require_admin)])
def list_reservations(
    day: Optional[Date] = Query(default=None, alias="date"),
    session: Session = Depends(get_session),
):
    q = select(Reservation).order_by(Reservation.date, Reservation.time)
    if day:
        q = q.where(Reservation.date == day)
    else:
        q = q.where(Reservation.date >= now_local().date())
    return session.exec(q).all()


@app.patch("/api/admin/reservations/{rid}", dependencies=[Depends(require_admin)])
def update_reservation(rid: int, body: StatusUpdate, session: Session = Depends(get_session)):
    reservation = session.get(Reservation, rid)
    if not reservation:
        raise HTTPException(404, "not_found")
    reservation.status = body.status
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return reservation


@app.get("/api/admin/orders", dependencies=[Depends(require_admin)])
def list_orders(session: Session = Depends(get_session)):
    return session.exec(select(Order).order_by(Order.pickup_at.desc())).all()


@app.patch("/api/admin/orders/{oid}", dependencies=[Depends(require_admin)])
def update_order(oid: int, body: StatusUpdate, session: Session = Depends(get_session)):
    order = session.get(Order, oid)
    if not order:
        raise HTTPException(404, "not_found")
    order.status = body.status
    session.add(order)
    session.commit()
    session.refresh(order)
    return order
