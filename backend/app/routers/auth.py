from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import EmailStr
from sqlmodel import Field, Session, SQLModel, select

from .. import accounts, config
from ..db import get_session
from ..deps import current_user
from ..models import AuthSession, PasswordToken, User, UserRead
from ..security import hash_password, hash_token, new_token, verify_password

router = APIRouter(prefix="/api/auth")


class Login(SQLModel):
    email: str
    password: str


class ProfileUpdate(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr


class Forgot(SQLModel):
    email: str


class ResetPassword(SQLModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


class PasswordChange(SQLModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


@router.post("/login")
def login(body: Login, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email.strip().lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "invalid_credentials")
    if not user.active:
        raise HTTPException(403, "account_disabled")
    token = new_token()
    session.add(AuthSession(
        token_hash=hash_token(token),
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=config.SESSION_DAYS),
    ))
    user.last_login_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"token": token, "user": UserRead.model_validate(user)}


@router.post("/logout", status_code=204)
def logout(authorization: Optional[str] = Header(default=None), session: Session = Depends(get_session)):
    if authorization and authorization.lower().startswith("bearer "):
        auth = session.get(AuthSession, hash_token(authorization[7:].strip()))
        if auth:
            session.delete(auth)
            session.commit()


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)):
    return user


@router.put("/me", response_model=UserRead)
def update_me(body: ProfileUpdate, user: User = Depends(current_user), session: Session = Depends(get_session)):
    email = body.email.strip().lower()
    clash = session.exec(select(User).where(User.email == email, User.id != user.id)).first()
    if clash:
        raise HTTPException(409, "email_taken")
    user.name, user.email = body.name.strip(), email
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/password", status_code=204)
def change_password(
    body: PasswordChange,
    user: User = Depends(current_user),
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, "wrong_password")
    user.password_hash = hash_password(body.new_password)
    session.add(user)
    # Sign out every other session for this account.
    current = hash_token(authorization[7:].strip()) if authorization else ""
    for s in session.exec(select(AuthSession).where(AuthSession.user_id == user.id)).all():
        if s.token_hash != current:
            session.delete(s)
    session.commit()


@router.post("/forgot", status_code=204)
def forgot_password(body: Forgot, session: Session = Depends(get_session)):
    """Always answers 204 so the form can't be used to discover which emails have accounts."""
    user = session.exec(select(User).where(User.email == body.email.strip().lower())).first()
    if not user or not user.active:
        return
    recent = session.exec(select(PasswordToken).where(
        PasswordToken.user_id == user.id,
        PasswordToken.purpose == "reset",
        PasswordToken.expires_at > datetime.utcnow() + timedelta(hours=config.PASSWORD_LINK_HOURS) - timedelta(minutes=2),
    )).first()
    if recent:  # one link per two minutes is plenty
        return
    accounts.send_link(session, user, "reset")


@router.get("/token")
def token_info(token: str, session: Session = Depends(get_session)):
    row, user = accounts.valid_token(session, token)
    if not row:
        raise HTTPException(410, "link_expired")
    return {"name": user.name, "email": user.email, "purpose": row.purpose}


@router.post("/reset")
def reset_password(body: ResetPassword, session: Session = Depends(get_session)):
    row, user = accounts.valid_token(session, body.token)
    if not row:
        raise HTTPException(410, "link_expired")
    user.password_hash = hash_password(body.password)
    row.used_at = datetime.utcnow()
    accounts.end_sessions(session, user.id)
    session.add_all([user, row])
    session.commit()
    return {"email": user.email}
