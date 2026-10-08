"""Send email through Resend's HTTP API and record every attempt in the email log.

Sending never raises: a failed email must not fail the booking or order that caused it.
"""
import base64
import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import List, Optional

from sqlmodel import Session

from . import config
from .models import EmailLog

log = logging.getLogger("yerevan.mail")
RESEND_URL = "https://api.resend.com/emails"


@dataclass
class Attachment:
    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


@dataclass
class Message:
    to: str
    subject: str
    html: str
    text: str
    template: str
    related: Optional[str] = None
    reply_to: Optional[str] = None
    attachments: List[Attachment] = field(default_factory=list)


def enabled() -> bool:
    return bool(config.RESEND_API_KEY)


def send(session: Session, msg: Message, idempotency_key: Optional[str] = None) -> EmailLog:
    entry = EmailLog(to=msg.to, subject=msg.subject, template=msg.template, related=msg.related, status="skipped")
    if not enabled():
        entry.error = "RESEND_API_KEY not set"
    else:
        payload = {
            "from": config.EMAIL_FROM,
            "to": [msg.to],
            "subject": msg.subject,
            "html": msg.html,
            "text": msg.text,
            "tags": [{"name": "template", "value": msg.template}],
        }
        if msg.reply_to:
            payload["reply_to"] = msg.reply_to
        if msg.attachments:
            payload["attachments"] = [
                {"filename": a.filename, "content": base64.b64encode(a.content).decode(), "content_type": a.content_type}
                for a in msg.attachments
            ]
        headers = {
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "yerevan-restaurant/1.0",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key[:256]
        req = urllib.request.Request(RESEND_URL, data=json.dumps(payload).encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                entry.status = "sent"
                entry.provider_id = json.loads(res.read() or b"{}").get("id")
        except urllib.error.HTTPError as e:
            entry.status = "failed"
            entry.error = f"{e.code}: {e.read().decode(errors='replace')[:400]}"
        except Exception as e:  # network errors, timeouts
            entry.status = "failed"
            entry.error = str(e)[:400]
    if entry.status == "failed":
        log.warning("email %s to %s failed: %s", msg.template, msg.to, entry.error)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry
