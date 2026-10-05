import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ADMIN_TOKEN"] = "secret"
os.environ["SLOT_CAPACITY"] = "6"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402


def setup_function():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


client = TestClient(app)


def next_open_day() -> date:
    d = date.today() + timedelta(days=2)
    while d.weekday() == 0:  # closed Mondays
        d += timedelta(days=1)
    return d


def payload(**kw):
    base = {"name": "Ani", "email": "ani@example.com", "phone": "+31612345678",
            "date": next_open_day().isoformat(), "time": "18:00", "guests": 4}
    base.update(kw)
    return base


def test_menu():
    r = client.get("/api/menu")
    assert r.status_code == 200
    assert r.json()["categories"][0]["items"]


def test_reservation_flow_and_capacity():
    assert client.post("/api/reservations", json=payload()).status_code == 201
    r = client.post("/api/reservations", json=payload(guests=3))
    assert r.status_code == 409
    slots = client.get("/api/availability", params={"date": payload()["date"], "guests": 3}).json()["slots"]
    assert {"time": "18:00", "available": False} in slots


def test_closed_day_rejected():
    d = date.today() + timedelta(days=1)
    while d.weekday() != 0:
        d += timedelta(days=1)
    assert client.post("/api/reservations", json=payload(date=d.isoformat())).status_code == 422


def test_admin_requires_token():
    assert client.get("/api/admin/reservations").status_code == 401
    client.post("/api/reservations", json=payload())
    r = client.get("/api/admin/reservations", headers={"X-Admin-Token": "secret"})
    assert r.status_code == 200 and len(r.json()) == 1


def test_ordering_disabled_by_default():
    r = client.post("/api/orders", json={"name": "Ani", "email": "a@example.com", "phone": "+31612345678",
                                         "pickup_at": "2030-01-01T18:00:00", "items": [{"item_id": "tolma", "quantity": 1}]})
    assert r.status_code == 503
