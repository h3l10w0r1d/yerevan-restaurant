from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, SQLModel, select

from .. import config, emails, mailer
from ..db import get_session
from ..deps import manager
from ..models import EmailLog, User
from ..store import get_settings

router = APIRouter(prefix="/api/admin/email")


class TestBody(SQLModel):
    to: Optional[str] = None


@router.get("")
def status(session: Session = Depends(get_session), _: User = Depends(manager)):
    s = get_settings(session)
    rows = session.exec(select(EmailLog).order_by(EmailLog.created_at.desc()).limit(50)).all()
    return {
        "enabled": mailer.enabled(),
        "from": config.EMAIL_FROM,
        "reply_to": config.EMAIL_REPLY_TO or s["restaurant"]["email"],
        "site_url": config.SITE_URL,
        "log": rows,
    }


@router.post("/test")
def send_test(body: TestBody, session: Session = Depends(get_session), user: User = Depends(manager)):
    return emails.test_email(session, (body.to or user.email).strip())
