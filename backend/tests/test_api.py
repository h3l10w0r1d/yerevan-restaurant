import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ADMIN_EMAIL"] = "owner@example.com"
os.environ["ADMIN_PASSWORD"] = "owner-pass-123"
os.environ["SLOT_CAPACITY"] = "6"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    SQLModel.metadata.drop_all(engine)
    init_db()
    with TestClient(app) as c:
        yield c


def login(client, email="owner@example.com", password="owner-pass-123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def next_open_day() -> date:
    d = date.today() + timedelta(days=2)
    while d.weekday() == 0:  # closed Mondays
        d += timedelta(days=1)
    return d


def booking(**kw):
    base = {"name": "Ani", "email": "ani@example.com", "phone": "+31612345678",
            "date": next_open_day().isoformat(), "time": "18:00", "guests": 4}
    base.update(kw)
    return base


def test_public_menu_is_seeded_from_json(client):
    menu = client.get("/api/menu").json()
    assert len(menu["categories"]) == 6
    assert menu["categories"][0]["items"][0]["name"]["en"] == "Basturma"


def test_reservation_capacity_and_closed_days(client):
    assert client.post("/api/reservations", json=booking()).status_code == 201
    assert client.post("/api/reservations", json=booking(guests=3)).status_code == 409
    monday = date.today() + timedelta(days=1)
    while monday.weekday() != 0:
        monday += timedelta(days=1)
    assert client.post("/api/reservations", json=booking(date=monday.isoformat())).status_code == 422


def test_auth_required_and_login(client):
    assert client.get("/api/admin/reservations").status_code == 401
    assert client.post("/api/auth/login", json={"email": "owner@example.com", "password": "nope"}).status_code == 401
    h = login(client)
    assert client.get("/api/auth/me", headers=h).json()["role"] == "owner"
    client.post("/api/auth/logout", headers=h)
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_admin_reservations_range_and_warnings(client):
    h = login(client)
    day = next_open_day()
    r = client.post("/api/admin/reservations", headers=h,
                    json={"name": "Phone guest", "date": day.isoformat(), "time": "18:00", "guests": 8})
    assert r.status_code == 201
    assert "over_capacity" in r.json()["warnings"]
    rows = client.get("/api/admin/reservations", headers=h,
                      params={"start": day.isoformat(), "end": day.isoformat()}).json()
    assert len(rows) == 1 and rows[0]["source"] == "phone"
    rid = rows[0]["id"]
    assert client.patch(f"/api/admin/reservations/{rid}", headers=h, json={"status": "seated"}).json()["status"] == "seated"
    stats = client.get("/api/admin/stats", headers=h).json()
    assert len(stats["series"]) == 14


def test_menu_editor_and_images(client):
    h = login(client)
    cat = client.post("/api/admin/categories", headers=h, json={"name_en": "Specials", "name_nl": "Specials"}).json()
    img = client.post("/api/admin/images", headers={**h, "Content-Type": "image/webp"}, content=b"RIFF0000WEBPVP8 ").json()
    item = client.post("/api/admin/items", headers=h, json={
        "category_id": cat["id"], "name_en": "Khash", "name_nl": "Khash", "price": 1500, "image": img["url"],
    }).json()
    assert item["id"] == "khash"
    assert client.get(img["url"]).content.startswith(b"RIFF")
    public = client.get("/api/menu").json()
    assert public["categories"][-1]["items"][0]["image"] == img["url"]
    # Unavailable items disappear from the public menu but stay in the editor.
    client.put(f"/api/admin/items/{item['id']}", headers=h, json={**item, "available": False})
    assert all(c["id"] != cat["id"] for c in client.get("/api/menu").json()["categories"])
    assert client.delete(f"/api/admin/categories/{cat['id']}", headers=h).status_code == 409


def test_team_roles(client):
    h = login(client)
    invited = client.post("/api/admin/team", headers=h,
                          json={"name": "Sona", "email": "sona@example.com", "role": "staff"}).json()
    sh = login(client, "sona@example.com", invited["temporary_password"])
    assert client.get("/api/admin/reservations", headers=sh).status_code == 200
    assert client.get("/api/admin/menu", headers=sh).status_code == 403
    assert client.get("/api/admin/team", headers=sh).status_code == 403
    me = client.get("/api/auth/me", headers=h).json()
    assert client.patch(f"/api/admin/team/{me['id']}", headers=h, json={"role": "staff"}).status_code == 409
    client.patch(f"/api/admin/team/{invited['user']['id']}", headers=h, json={"active": False})
    assert client.get("/api/auth/me", headers=sh).status_code == 401


def test_settings_drive_public_rules(client):
    h = login(client)
    s = client.get("/api/admin/settings", headers=h).json()
    s["hours"][0] = ["17:00", "22:00"]  # open on Mondays
    s["ordering_enabled"] = True
    assert client.put("/api/admin/settings", headers=h, json=s).status_code == 200
    info = client.get("/api/info").json()
    assert info["hours"][0] == ["17:00", "22:00"] and info["ordering_enabled"] is True
    s["hours"][1] = ["22:00", "17:00"]
    assert client.put("/api/admin/settings", headers=h, json=s).status_code == 422


def test_change_password(client):
    h = login(client)
    assert client.post("/api/auth/password", headers=h,
                       json={"current_password": "wrong", "new_password": "something-long"}).status_code == 400
    assert client.post("/api/auth/password", headers=h,
                       json={"current_password": "owner-pass-123", "new_password": "something-long"}).status_code == 204
    login(client, password="something-long")
