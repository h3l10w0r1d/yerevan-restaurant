from datetime import date as Date
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from ..db import get_session
from ..deps import staff
from ..models import (
    ORDER_STATUSES,
    RESERVATION_STATUSES,
    Order,
    Reservation,
    ReservationAdminWrite,
    StatusUpdate,
)
from ..store import booked_guests, get_settings, now_local, slots_for

router = APIRouter(prefix="/api/admin", dependencies=[Depends(staff)])

ACTIVE = ["pending", "confirmed", "seated", "completed"]


# --- Reservations ---------------------------------------------------------

@router.get("/reservations")
def list_reservations(
    start: Optional[Date] = None,
    end: Optional[Date] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    session: Session = Depends(get_session),
):
    query = select(Reservation).order_by(Reservation.date, Reservation.time)
    if start:
        query = query.where(Reservation.date >= start)
    if end:
        query = query.where(Reservation.date <= end)
    if not start and not end:
        query = query.where(Reservation.date >= now_local().date())
    if status:
        query = query.where(Reservation.status == status)
    rows = session.exec(query).all()
    if q:
        needle = q.lower()
        rows = [r for r in rows if needle in f"{r.name} {r.email or ''} {r.phone}".lower()]
    return rows


@router.post("/reservations", status_code=201)
def create_reservation(body: ReservationAdminWrite, session: Session = Depends(get_session)):
    reservation = Reservation(**body.model_dump())
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return {"reservation": reservation, "warnings": _warnings(session, reservation)}


@router.put("/reservations/{rid}")
def update_reservation(rid: int, body: ReservationAdminWrite, session: Session = Depends(get_session)):
    reservation = session.get(Reservation, rid)
    if not reservation:
        raise HTTPException(404, "not_found")
    for key, value in body.model_dump().items():
        setattr(reservation, key, value)
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return {"reservation": reservation, "warnings": _warnings(session, reservation)}


@router.patch("/reservations/{rid}")
def set_reservation_status(rid: int, body: StatusUpdate, session: Session = Depends(get_session)):
    if body.status not in RESERVATION_STATUSES:
        raise HTTPException(422, "invalid_status")
    reservation = session.get(Reservation, rid)
    if not reservation:
        raise HTTPException(404, "not_found")
    reservation.status = body.status
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return reservation


@router.delete("/reservations/{rid}", status_code=204)
def delete_reservation(rid: int, session: Session = Depends(get_session)):
    reservation = session.get(Reservation, rid)
    if not reservation:
        raise HTTPException(404, "not_found")
    session.delete(reservation)
    session.commit()


def _warnings(session: Session, r: Reservation) -> list:
    """Staff may override the rules, but they should know when they do."""
    s = get_settings(session)
    out = []
    if r.time not in slots_for(r.date, s):
        out.append("outside_hours")
    if r.status not in ("cancelled", "no_show"):
        if booked_guests(session, r.date, r.time) > s["slot_capacity"]:
            out.append("over_capacity")
    return out


# --- Orders ---------------------------------------------------------------

@router.get("/orders")
def list_orders(status: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Order).order_by(Order.pickup_at.desc())
    if status:
        query = query.where(Order.status == status)
    return session.exec(query).all()


@router.patch("/orders/{oid}")
def set_order_status(oid: int, body: StatusUpdate, session: Session = Depends(get_session)):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(422, "invalid_status")
    order = session.get(Order, oid)
    if not order:
        raise HTTPException(404, "not_found")
    order.status = body.status
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


# --- Dashboard ------------------------------------------------------------

@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    today = now_local().date()
    horizon = today + timedelta(days=13)
    rows = session.exec(
        select(Reservation).where(Reservation.date >= today, Reservation.date <= horizon)
    ).all()
    live = [r for r in rows if r.status in ACTIVE]
    todays = sorted([r for r in live if r.date == today], key=lambda r: r.time)
    series = []
    for i in range(14):
        d = today + timedelta(days=i)
        day_rows = [r for r in live if r.date == d]
        series.append({"date": d.isoformat(), "reservations": len(day_rows), "covers": sum(r.guests for r in day_rows)})
    pending = session.exec(
        select(func.count()).select_from(Reservation).where(Reservation.status == "pending", Reservation.date >= today)
    ).one()
    open_orders = session.exec(
        select(func.count()).select_from(Order).where(Order.status.in_(["pending", "confirmed", "ready"]))
    ).one()
    return {
        "today": {"reservations": len(todays), "covers": sum(r.guests for r in todays)},
        "week": {
            "reservations": sum(d["reservations"] for d in series[:7]),
            "covers": sum(d["covers"] for d in series[:7]),
        },
        "pending": pending,
        "open_orders": open_orders,
        "series": series,
        "upcoming_today": todays,
    }
