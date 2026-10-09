from datetime import date as Date
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session

from .. import emails
from ..db import get_session
from ..models import Image, MenuItem, Order, OrderCreate, Reservation, ReservationCreate
from ..store import booked_guests, get_settings, now_local, public_menu, slots_for

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/info")
def info(session: Session = Depends(get_session)):
    s = get_settings(session)
    return {
        **s["restaurant"],
        "hours": s["hours"],
        "ordering_enabled": s["ordering_enabled"],
        "max_party_size": s["max_party_size"],
        "booking_window_days": s["booking_window_days"],
        "prelaunch": s["prelaunch"],
        "opening_date": s["opening_date"] or None,
    }


@router.get("/menu")
def menu(session: Session = Depends(get_session)):
    # Before opening the menu stays private: nothing to show, nothing to scrape.
    if get_settings(session)["prelaunch"]:
        return {"currency": "EUR", "categories": [], "prelaunch": True}
    return public_menu(session)


@router.get("/images/{image_id}")
def image(image_id: str, session: Session = Depends(get_session)):
    img = session.get(Image, image_id)
    if not img:
        raise HTTPException(404, "not_found")
    # Image ids are content-addressed per upload, so they never change.
    return Response(img.data, media_type=img.content_type,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/availability")
def availability(
    day: Date = Query(alias="date"),
    guests: int = Query(default=2, ge=1, le=50),
    session: Session = Depends(get_session),
):
    s = get_settings(session)
    now = now_local()
    slots = []
    for slot in slots_for(day, s):
        slot_dt = datetime.combine(day, datetime.strptime(slot, "%H:%M").time())
        free = s["slot_capacity"] - booked_guests(session, day, slot)
        slots.append({"time": slot, "available": slot_dt > now and free >= guests})
    return {"date": day.isoformat(), "slots": slots}


@router.post("/reservations", status_code=201)
def create_reservation(data: ReservationCreate, session: Session = Depends(get_session)):
    s = get_settings(session)
    if s["prelaunch"]:
        raise HTTPException(503, "not_yet_open")
    today = now_local().date()
    if data.guests > s["max_party_size"]:
        raise HTTPException(422, "party_too_large")
    if data.date < today or data.date > today + timedelta(days=s["booking_window_days"]):
        raise HTTPException(422, "date_out_of_range")
    if data.time not in slots_for(data.date, s):
        raise HTTPException(422, "closed")
    if datetime.combine(data.date, datetime.strptime(data.time, "%H:%M").time()) <= now_local():
        raise HTTPException(422, "in_past")
    if booked_guests(session, data.date, data.time) + data.guests > s["slot_capacity"]:
        raise HTTPException(409, "fully_booked")
    reservation = Reservation(**data.model_dump(), source="web")
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    emails.reservation_received(session, reservation)
    emails.staff_new_reservation(session, reservation)
    return reservation


@router.post("/orders", status_code=201)
def create_order(data: OrderCreate, session: Session = Depends(get_session)):
    s = get_settings(session)
    if s["prelaunch"]:
        raise HTTPException(503, "not_yet_open")
    if not s["ordering_enabled"]:
        raise HTTPException(503, "ordering_disabled")
    lines, total = [], 0
    for line in data.items:
        item = session.get(MenuItem, line.item_id)
        if not item or not item.available:
            raise HTTPException(422, f"unknown_item:{line.item_id}")
        total += item.price * line.quantity
        lines.append({"item_id": item.id, "name": item.name_en, "quantity": line.quantity, "price": item.price})
    if data.pickup_at.replace(tzinfo=None) <= now_local() + timedelta(minutes=30):
        raise HTTPException(422, "pickup_too_soon")
    order = Order(
        name=data.name, email=data.email, phone=data.phone, pickup_at=data.pickup_at,
        items=lines, total_cents=total, notes=data.notes, language=data.language,
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    emails.order_mail(session, order, "received")
    emails.staff_new_order(session, order)
    return order
