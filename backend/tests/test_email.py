import base64
import json
import re
from datetime import date, datetime, timedelta

import pytest

from app import config, mailer
from tests.test_api import booking, client, login  # noqa: F401  (fixture + helpers)


class FakeResend:
    """Stands in for api.resend.com and records what would have been sent."""

    def __init__(self):
        self.sent = []

    def __call__(self, req, timeout=None):
        body = json.loads(req.data)
        assert req.full_url == mailer.RESEND_URL
        assert req.headers["Authorization"] == "Bearer re_test"
        self.sent.append(body)
        fake = self

        class Res:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps({"id": f"email_{len(fake.sent)}"}).encode()

        return Res()

    def by_template(self, name):
        return [m for m in self.sent if {"name": "template", "value": name} in m["tags"]]


@pytest.fixture()
def resend(monkeypatch):
    fake = FakeResend()
    monkeypatch.setattr(config, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake)
    return fake


def test_without_api_key_emails_are_logged_as_skipped(client):  # noqa: F811
    assert client.post("/api/reservations", json=booking()).status_code == 201
    h = login(client)
    log = client.get("/api/admin/email", headers=h).json()
    assert log["enabled"] is False
    assert {e["template"]: e["status"] for e in log["log"]} == {
        "reservation_received": "skipped", "staff_new_reservation": "skipped"}


def test_booking_lifecycle_emails(client, resend):  # noqa: F811
    r = client.post("/api/reservations", json=booking(language="nl", notes="Verjaardag")).json()
    received = resend.by_template("reservation_received")[0]
    assert received["to"] == ["ani@example.com"]
    assert received["subject"].startswith("We hebben je aanvraag")
    assert received["reply_to"] == "info@yerevanrestaurant.nl"
    assert "Verjaardag" in received["html"] and "Verjaardag" in received["text"]
    staff = resend.by_template("staff_new_reservation")[0]
    assert staff["to"] == ["info@yerevanrestaurant.nl"] and staff["reply_to"] == "ani@example.com"

    h = login(client)
    client.patch(f"/api/admin/reservations/{r['id']}", headers=h, json={"status": "confirmed"})
    confirmed = resend.by_template("reservation_confirmed")[0]
    assert "bevestigd" in confirmed["subject"]
    ics = base64.b64decode(confirmed["attachments"][0]["content"]).decode()
    assert "BEGIN:VEVENT" in ics and "TZID=Europe/Amsterdam" in ics

    # Quiet status change: no email.
    client.patch(f"/api/admin/reservations/{r['id']}", headers=h, json={"status": "seated", "notify": False})
    client.patch(f"/api/admin/reservations/{r['id']}", headers=h, json={"status": "cancelled"})
    assert len(resend.by_template("reservation_cancelled")) == 1
    log = client.get("/api/admin/email", headers=h).json()["log"]
    assert all(e["status"] == "sent" for e in log) and log[0]["provider_id"].startswith("email_")


def test_staff_booking_without_email_sends_nothing(client, resend):  # noqa: F811
    h = login(client)
    client.post("/api/admin/reservations", headers=h,
                json={"name": "Walk-in", "date": date.today().isoformat(), "time": "19:00", "guests": 2})
    assert resend.sent == []


def test_notifications_can_be_switched_off(client, resend):  # noqa: F811
    h = login(client)
    s = client.get("/api/admin/settings", headers=h).json()
    s["notifications"] = {"guest_emails": False, "staff_emails": True, "staff_email": "kitchen@example.com"}
    assert client.put("/api/admin/settings", headers=h, json=s).status_code == 200
    client.post("/api/reservations", json=booking())
    assert [m["to"] for m in resend.sent] == [["kitchen@example.com"]]


def test_invite_and_password_reset_links(client, resend):  # noqa: F811
    h = login(client)
    res = client.post("/api/admin/team", headers=h, json={"name": "Sona", "email": "sona@example.com", "role": "staff"}).json()
    assert res["emailed"] is True and res["temporary_password"] is None
    link = re.search(r"set-password\?token=([\w-]+)", resend.by_template("account_invite")[0]["text"]).group(1)
    assert client.get("/api/auth/token", params={"token": link}).json()["purpose"] == "invite"
    assert client.post("/api/auth/reset", json={"token": link, "password": "a-new-password"}).status_code == 200
    login(client, "sona@example.com", "a-new-password")
    assert client.post("/api/auth/reset", json={"token": link, "password": "another-one"}).status_code == 410

    # Forgot password: unknown addresses get the same answer and no email.
    assert client.post("/api/auth/forgot", json={"email": "nobody@example.com"}).status_code == 204
    assert client.post("/api/auth/forgot", json={"email": "sona@example.com"}).status_code == 204
    assert client.post("/api/auth/forgot", json={"email": "sona@example.com"}).status_code == 204  # throttled
    assert len(resend.by_template("account_reset")) == 1


def test_order_emails(client, resend):  # noqa: F811
    h = login(client)
    s = client.get("/api/admin/settings", headers=h).json()
    s["ordering_enabled"] = True
    client.put("/api/admin/settings", headers=h, json=s)
    pickup = (datetime.now() + timedelta(hours=3)).replace(microsecond=0).isoformat()
    o = client.post("/api/orders", json={"name": "Joost", "email": "joost@example.com", "phone": "+31612345678",
                                         "pickup_at": pickup, "items": [{"item_id": "tolma", "quantity": 2}]}).json()
    assert "€ 37,00" in resend.by_template("order_received")[0]["html"]
    assert resend.by_template("staff_new_order")
    client.patch(f"/api/admin/orders/{o['id']}", headers=h, json={"status": "ready"})
    assert resend.by_template("order_ready")[0]["subject"] == f"Order #{o['id']} is ready for pickup"


def test_test_email_endpoint(client, resend):  # noqa: F811
    h = login(client)
    res = client.post("/api/admin/email/test", headers=h, json={}).json()
    assert res["status"] == "sent" and resend.sent[0]["to"] == ["owner@example.com"]
