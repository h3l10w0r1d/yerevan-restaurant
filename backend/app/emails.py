"""Transactional emails: what is sent, to whom, in which language.

Every function decides for itself whether to send (guest has an email, notifications
are switched on) and returns quietly otherwise, so callers can fire and forget.
"""
from datetime import datetime, timedelta
from html import escape
from typing import Optional

from sqlmodel import Session

from . import config, mailer
from .mailer import Attachment, Message
from .models import Order, Reservation, User
from .store import get_settings

BURGUNDY, IVORY, INK, MUTED, AMBER = "#531C21", "#F8EFEA", "#2A1215", "#67474B", "#E8963A"

DAYS = {
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "nl": ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
}
MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "nl": ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
}

T = {
    "en": {
        "received_subject": "We received your request for {date}",
        "received_title": "Thank you, {name}.",
        "received_body": "We have your table request below. We will confirm it shortly by email.",
        "confirmed_subject": "Your table is confirmed: {date} at {time}",
        "confirmed_title": "See you soon, {name}.",
        "confirmed_body": "Your table is confirmed. We hold it for fifteen minutes. The calendar invite is attached.",
        "cancelled_subject": "Your reservation for {date}",
        "cancelled_title": "We’re sorry, {name}.",
        "cancelled_body": "We can’t welcome you at the time below. Reply to this email or call us and we’ll gladly find another moment.",
        "date": "Date", "time": "Time", "guests": "Guests", "notes": "Your notes",
        "change": "Need to change something? Simply reply to this email{phone}.",
        "or_call": " or call us on {phone}",
        "order_subject": "Order #{id} received",
        "order_title": "Thank you, {name}.",
        "order_body": "We’ve received your takeaway order. We’ll let you know when it’s ready.",
        "ready_subject": "Order #{id} is ready for pickup",
        "ready_title": "Ready when you are, {name}.",
        "ready_body": "Your order is ready at Kampstraat 22. You pay when you collect.",
        "pickup": "Pickup", "total": "Total",
        "footer": "Armenian restaurant · {address}, {city}",
    },
    "nl": {
        "received_subject": "We hebben je aanvraag voor {date} ontvangen",
        "received_title": "Dank je wel, {name}.",
        "received_body": "Hieronder staat je aanvraag. We bevestigen hem zo snel mogelijk per e-mail.",
        "confirmed_subject": "Je tafel is bevestigd: {date} om {time}",
        "confirmed_title": "Tot snel, {name}.",
        "confirmed_body": "Je tafel is bevestigd. We houden hem vijftien minuten voor je vast. De agenda-uitnodiging zit in de bijlage.",
        "cancelled_subject": "Je reservering voor {date}",
        "cancelled_title": "Het spijt ons, {name}.",
        "cancelled_body": "Op het onderstaande moment kunnen we je helaas niet ontvangen. Beantwoord deze e-mail of bel ons, dan zoeken we graag een ander moment.",
        "date": "Datum", "time": "Tijd", "guests": "Personen", "notes": "Je opmerkingen",
        "change": "Iets wijzigen? Beantwoord gewoon deze e-mail{phone}.",
        "or_call": " of bel ons op {phone}",
        "order_subject": "Bestelling #{id} ontvangen",
        "order_title": "Dank je wel, {name}.",
        "order_body": "We hebben je afhaalbestelling ontvangen. We laten je weten wanneer hij klaarstaat.",
        "ready_subject": "Bestelling #{id} staat klaar",
        "ready_title": "Hij staat klaar, {name}.",
        "ready_body": "Je bestelling staat klaar aan de Kampstraat 22. Je betaalt bij het afhalen.",
        "pickup": "Afhalen", "total": "Totaal",
        "footer": "Armeens restaurant · {address}, {city}",
    },
}


def _lang(code: Optional[str]) -> str:
    return "nl" if (code or "").lower().startswith("nl") else "en"


def _date(d, lang: str) -> str:
    return f"{DAYS[lang][d.weekday()]} {d.day} {MONTHS[lang][d.month - 1]}"


def _euro(cents: int) -> str:
    return f"€ {cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _first(name: str) -> str:
    return (name or "").split(" ")[0] or name


# --- Layout ---------------------------------------------------------------

def _layout(title: str, intro: str, rows: list, s: dict, lang: str, after: str = "", button: Optional[tuple] = None) -> str:
    r = s["restaurant"]
    detail_rows = "".join(
        f'<tr><td style="padding:6px 0;color:{MUTED};font-size:14px;width:38%">{escape(k)}</td>'
        f'<td style="padding:6px 0;color:{INK};font-size:15px">{v}</td></tr>'
        for k, v in rows
    )
    details = (
        f'<table role="presentation" width="100%" style="border-collapse:collapse;border-top:1px solid #EADBD6;'
        f'border-bottom:1px solid #EADBD6;margin:24px 0">{detail_rows}</table>' if rows else ""
    )
    btn = (
        f'<p style="margin:28px 0"><a href="{escape(button[1])}" style="background:{BURGUNDY};color:{IVORY};'
        f'text-decoration:none;padding:12px 22px;border-radius:4px;font-size:15px;display:inline-block">{escape(button[0])}</a></p>'
        if button else ""
    )
    footer = T[lang]["footer"].format(address=escape(r["address"]), city=escape(r["city"]))
    return f"""<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:{IVORY};font-family:'Jost',Helvetica,Arial,sans-serif;color:{INK}">
<table role="presentation" width="100%" style="background:{IVORY};border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse">
<tr><td style="background:{BURGUNDY};padding:28px 32px;text-align:center">
<div style="font-family:'Bodoni Moda',Didot,Georgia,serif;color:{IVORY};font-size:30px;letter-spacing:6px">YEREVAN</div>
<div style="font-family:'Bodoni Moda',Didot,Georgia,serif;color:{IVORY};font-size:15px;letter-spacing:1px;margin-top:2px">restaurant</div>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px">
<h1 style="font-family:'Bodoni Moda',Didot,Georgia,serif;font-weight:400;color:{BURGUNDY};font-size:28px;line-height:1.2;margin:0 0 14px">{escape(title)}</h1>
<p style="font-size:16px;line-height:1.6;margin:0;color:{INK}">{intro}</p>
{details}{btn}{after}
</td></tr>
<tr><td style="padding:20px 32px;text-align:center;color:{MUTED};font-size:13px;line-height:1.6">
{footer}<br><a href="{escape(config.SITE_URL)}" style="color:{MUTED}">{escape(config.SITE_URL.replace('https://', ''))}</a>
</td></tr></table></td></tr></table></body></html>"""


def _text(title: str, intro: str, rows: list, after: str, s: dict, lang: str) -> str:
    r = s["restaurant"]
    lines = [title, "", intro, ""] + [f"{k}: {v}" for k, v in rows] + (["", after] if after else [])
    lines += ["", "—", T[lang]["footer"].format(address=r["address"], city=r["city"]), config.SITE_URL]
    return "\n".join(lines)


def _reply_to(s: dict) -> Optional[str]:
    return config.EMAIL_REPLY_TO or s["restaurant"]["email"] or None


def _staff_address(s: dict) -> Optional[str]:
    return s["notifications"]["staff_email"] or s["restaurant"]["email"] or None


# --- Reservations ---------------------------------------------------------

def _reservation_mail(session: Session, r: Reservation, kind: str) -> None:
    s = get_settings(session)
    if not r.email or not s["notifications"]["guest_emails"]:
        return
    lang = _lang(r.language)
    t = T[lang]
    date = _date(r.date, lang)
    phone = s["restaurant"]["phone"]
    change = t["change"].format(phone=t["or_call"].format(phone=phone) if phone else "")
    rows = [(t["date"], escape(date)), (t["time"], escape(r.time)), (t["guests"], str(r.guests))]
    if r.notes:
        rows.append((t["notes"], escape(r.notes)))
    title = t[f"{kind}_title"].format(name=_first(r.name))
    intro = t[f"{kind}_body"]
    attachments = [Attachment(f"yerevan-{r.date.isoformat()}.ics", _ics(r, s), "text/calendar")] if kind == "confirmed" else []
    mailer.send(session, Message(
        to=r.email,
        subject=t[f"{kind}_subject"].format(date=date, time=r.time),
        html=_layout(title, escape(intro), rows, s, lang,
                     after=f'<p style="font-size:14px;color:{MUTED};margin:0">{escape(change)}</p>'),
        text=_text(title, intro, [(t["date"], date), (t["time"], r.time), (t["guests"], r.guests)]
                   + ([(t["notes"], r.notes)] if r.notes else []), change, s, lang),
        template=f"reservation_{kind}", related=f"reservation:{r.id}", reply_to=_reply_to(s), attachments=attachments,
    ), idempotency_key=f"reservation-{r.id}-{kind}-{r.date}-{r.time}")


def reservation_received(session: Session, r: Reservation) -> None:
    _reservation_mail(session, r, "received")


def reservation_status_changed(session: Session, r: Reservation, previous: Optional[str]) -> None:
    """Email the guest when staff confirm or cancel; nothing for other transitions."""
    if r.status == previous:
        return
    if r.status == "confirmed":
        _reservation_mail(session, r, "confirmed")
    elif r.status == "cancelled" and previous not in (None, "cancelled"):
        _reservation_mail(session, r, "cancelled")


def staff_new_reservation(session: Session, r: Reservation) -> None:
    s = get_settings(session)
    to = _staff_address(s)
    if not to or not s["notifications"]["staff_emails"]:
        return
    date = _date(r.date, "en")
    rows = [("Guest", escape(r.name)), ("When", f"{escape(date)}, {escape(r.time)}"), ("Guests", str(r.guests)),
            ("Phone", escape(r.phone or "—")), ("Email", escape(r.email or "—"))]
    if r.notes:
        rows.append(("Notes", escape(r.notes)))
    link = f"{config.SITE_URL}/admin/reservations"
    title = f"New booking request · {r.guests}p · {date} {r.time}"
    mailer.send(session, Message(
        to=to, subject=title,
        html=_layout("New booking request", "A guest booked through the website. Confirm or decline it in the admin.", rows, s, "en",
                     button=("Open reservations", link)),
        text=_text("New booking request", f"Confirm or decline it in the admin: {link}",
                   [("Guest", r.name), ("When", f"{date}, {r.time}"), ("Guests", r.guests), ("Phone", r.phone)], "", s, "en"),
        template="staff_new_reservation", related=f"reservation:{r.id}", reply_to=r.email,
    ), idempotency_key=f"staff-reservation-{r.id}")


def _ics(r: Reservation, s: dict) -> bytes:
    start = datetime.combine(r.date, datetime.strptime(r.time, "%H:%M").time())
    end = start + timedelta(hours=2)
    fmt = lambda d: d.strftime("%Y%m%dT%H%M%S")  # noqa: E731
    rest = s["restaurant"]
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Yerevan Restaurant//Reservations//EN", "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:reservation-{r.id}@yerevanrestaurant.nl",
        f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;TZID=Europe/Amsterdam:{fmt(start)}",
        f"DTEND;TZID=Europe/Amsterdam:{fmt(end)}",
        f"SUMMARY:{rest['name']} · {r.guests} {'personen' if _lang(r.language) == 'nl' else 'guests'}",
        f"LOCATION:{rest['address']}\\, {rest['city']}",
        "END:VEVENT", "END:VCALENDAR",
    ]
    return ("\r\n".join(lines) + "\r\n").encode()


# --- Orders ---------------------------------------------------------------

def _order_rows(o: Order, lang: str) -> list:
    rows = [(f"{line['quantity']} × {line['name']}", _euro(line["price"] * line["quantity"])) for line in o.items]
    rows.append((T[lang]["total"], f"<strong>{_euro(o.total_cents)}</strong>"))
    rows.append((T[lang]["pickup"], escape(f"{_date(o.pickup_at.date(), lang)}, {o.pickup_at.strftime('%H:%M')}")))
    return rows


def order_mail(session: Session, o: Order, kind: str) -> None:
    s = get_settings(session)
    if not o.email or not s["notifications"]["guest_emails"]:
        return
    lang = _lang(o.language)
    t = T[lang]
    key = "order" if kind == "received" else "ready"
    title = t[f"{key}_title"].format(name=_first(o.name))
    rows = _order_rows(o, lang)
    mailer.send(session, Message(
        to=o.email, subject=t[f"{key}_subject"].format(id=o.id),
        html=_layout(title, escape(t[f"{key}_body"]), rows, s, lang),
        text=_text(title, t[f"{key}_body"], [(k, v.replace("<strong>", "").replace("</strong>", "")) for k, v in rows], "", s, lang),
        template=f"order_{kind}", related=f"order:{o.id}", reply_to=_reply_to(s),
    ), idempotency_key=f"order-{o.id}-{kind}")


def staff_new_order(session: Session, o: Order) -> None:
    s = get_settings(session)
    to = _staff_address(s)
    if not to or not s["notifications"]["staff_emails"]:
        return
    link = f"{config.SITE_URL}/admin/orders"
    rows = [("Guest", escape(o.name)), ("Phone", escape(o.phone))] + _order_rows(o, "en")
    mailer.send(session, Message(
        to=to, subject=f"New takeaway order #{o.id} · {_euro(o.total_cents)}",
        html=_layout(f"New order #{o.id}", "Accept it in the admin so the guest knows it’s coming.", rows, s, "en",
                     button=("Open orders", link)),
        text=_text(f"New order #{o.id}", link, [("Guest", o.name), ("Phone", o.phone), ("Total", _euro(o.total_cents))], "", s, "en"),
        template="staff_new_order", related=f"order:{o.id}", reply_to=o.email,
    ), idempotency_key=f"staff-order-{o.id}")


# --- Accounts -------------------------------------------------------------

def account_link(session: Session, user: User, link: str, purpose: str) -> bool:
    """Invite or password-reset email. Returns True if it was actually sent."""
    s = get_settings(session)
    if purpose == "invite":
        subject = "You’ve been added to the Yerevan admin"
        title = f"Welcome, {_first(user.name)}."
        intro = (f"You now have access to the Yerevan restaurant admin as {user.role}. "
                 f"Choose a password to sign in with {escape(user.email)}.")
        button = "Choose your password"
    else:
        subject = "Reset your Yerevan admin password"
        title = f"Hi {_first(user.name)},"
        intro = "Someone (hopefully you) asked to reset your password. If that wasn’t you, you can ignore this email."
        button = "Choose a new password"
    note = f"This link works once and expires in {config.PASSWORD_LINK_HOURS} hours."
    entry = mailer.send(session, Message(
        to=user.email, subject=subject,
        html=_layout(title, intro, [], s, "en", button=(button, link),
                     after=f'<p style="font-size:13px;color:{MUTED};margin:0">{note}<br>{escape(link)}</p>'),
        text=_text(title, intro.replace("&#x27;", "'"), [], f"{button}: {link}\n{note}", s, "en"),
        template=f"account_{purpose}", related=f"user:{user.id}",
    ))
    return entry.status == "sent"


def test_email(session: Session, to: str) -> mailer.EmailLog:
    s = get_settings(session)
    intro = "If you can read this, email from the Yerevan website is working."
    return mailer.send(session, Message(
        to=to, subject="Test email from the Yerevan website",
        html=_layout("It works.", intro, [("Sent from", escape(config.EMAIL_FROM)), ("Reply-to", escape(_reply_to(s) or "—"))], s, "en"),
        text=_text("It works.", intro, [("Sent from", config.EMAIL_FROM)], "", s, "en"),
        template="test",
    ))
