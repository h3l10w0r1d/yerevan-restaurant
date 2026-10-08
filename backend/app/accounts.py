from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlmodel import Session, select

from . import config, emails, mailer
from .models import AuthSession, PasswordToken, User
from .security import hash_token, new_token


def issue_link(session: Session, user: User, purpose: str) -> str:
    """Create a single-use set-password link, replacing any earlier unused one."""
    for old in session.exec(select(PasswordToken).where(PasswordToken.user_id == user.id, PasswordToken.used_at == None)).all():  # noqa: E711
        session.delete(old)
    token = new_token()
    session.add(PasswordToken(
        token_hash=hash_token(token), user_id=user.id, purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(hours=config.PASSWORD_LINK_HOURS),
    ))
    session.commit()
    return f"{config.SITE_URL}/admin/set-password?token={token}"


def send_link(session: Session, user: User, purpose: str) -> bool:
    """Email an invite/reset link. Returns False when email isn't configured or failed."""
    if not mailer.enabled():
        return False
    return emails.account_link(session, user, issue_link(session, user, purpose), purpose)


def valid_token(session: Session, token: str) -> Tuple[Optional[PasswordToken], Optional[User]]:
    row = session.get(PasswordToken, hash_token(token))
    if not row or row.used_at or row.expires_at < datetime.utcnow():
        return None, None
    user = session.get(User, row.user_id)
    if not user or not user.active:
        return None, None
    return row, user


def end_sessions(session: Session, user_id: int) -> None:
    for s in session.exec(select(AuthSession).where(AuthSession.user_id == user_id)).all():
        session.delete(s)
