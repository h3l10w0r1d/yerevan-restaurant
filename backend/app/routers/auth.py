from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import EmailStr
from sqlmodel import Field, Session, SQLModel, select

from .. import config
from ..db import get_session
from ..deps import current_user
from ..models import AuthSession, User, UserRead
from ..security import hash_password, hash_token, new_token, verify_password

router = APIRouter(prefix="/api/auth")


class Login(SQLModel):
    email: str
    password: str


class ProfileUpdate(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr


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
