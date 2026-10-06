from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from .db import get_session
from .models import AuthSession, User
from .security import hash_token


def current_user(
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "not_authenticated")
    auth = session.get(AuthSession, hash_token(authorization[7:].strip()))
    if not auth or auth.expires_at < datetime.utcnow():
        raise HTTPException(401, "session_expired")
    user = session.get(User, auth.user_id)
    if not user or not user.active:
        raise HTTPException(401, "account_disabled")
    return user


def require_role(*roles: str):
    def check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "forbidden")
        return user

    return check


staff = require_role("owner", "manager", "staff")
manager = require_role("owner", "manager")
owner = require_role("owner")
