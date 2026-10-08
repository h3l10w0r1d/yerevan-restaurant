from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import EmailStr
from sqlmodel import Field, Session, SQLModel, func, select

from .. import accounts
from ..db import get_session
from ..deps import owner
from ..models import ROLES, AuthSession, User, UserRead
from ..security import hash_password, temp_password

router = APIRouter(prefix="/api/admin/team")


class Invite(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    role: str = "staff"


class MemberUpdate(SQLModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    role: Optional[str] = None
    active: Optional[bool] = None


def _owners(session: Session) -> int:
    return session.exec(select(func.count()).select_from(User).where(User.role == "owner", User.active)).one()


def _end_sessions(session: Session, user_id: int) -> None:
    for s in session.exec(select(AuthSession).where(AuthSession.user_id == user_id)).all():
        session.delete(s)


@router.get("", response_model=list[UserRead])
def list_team(session: Session = Depends(get_session), _: User = Depends(owner)):
    return session.exec(select(User).order_by(User.created_at)).all()


@router.post("", status_code=201)
def invite(body: Invite, session: Session = Depends(get_session), _: User = Depends(owner)):
    if body.role not in ROLES:
        raise HTTPException(422, "invalid_role")
    email = body.email.strip().lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(409, "email_taken")
    password = temp_password()
    user = User(email=email, name=body.name.strip(), role=body.role, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    # With email set up the invite goes by email; otherwise the temporary password is
    # returned once (never stored in plain text) for the owner to pass on.
    emailed = accounts.send_link(session, user, "invite")
    return {"user": UserRead.model_validate(user), "emailed": emailed,
            "temporary_password": None if emailed else password}


@router.patch("/{uid}", response_model=UserRead)
def update_member(uid: int, body: MemberUpdate, session: Session = Depends(get_session), me: User = Depends(owner)):
    user = session.get(User, uid)
    if not user:
        raise HTTPException(404, "not_found")
    losing_owner = user.role == "owner" and (
        (body.role and body.role != "owner") or body.active is False
    )
    if losing_owner and _owners(session) <= 1:
        raise HTTPException(409, "last_owner")
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(422, "invalid_role")
        user.role = body.role
    if body.name is not None:
        user.name = body.name.strip()
    if body.active is not None:
        if user.id == me.id and not body.active:
            raise HTTPException(409, "cannot_disable_self")
        user.active = body.active
        if not body.active:
            _end_sessions(session, user.id)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/{uid}/reset-password")
def reset_password(uid: int, session: Session = Depends(get_session), _: User = Depends(owner)):
    user = session.get(User, uid)
    if not user:
        raise HTTPException(404, "not_found")
    if accounts.send_link(session, user, "reset"):
        return {"emailed": True, "temporary_password": None}
    password = temp_password()
    user.password_hash = hash_password(password)
    _end_sessions(session, user.id)
    session.add(user)
    session.commit()
    return {"emailed": False, "temporary_password": password}


@router.delete("/{uid}", status_code=204)
def remove_member(uid: int, session: Session = Depends(get_session), me: User = Depends(owner)):
    user = session.get(User, uid)
    if not user:
        raise HTTPException(404, "not_found")
    if user.id == me.id:
        raise HTTPException(409, "cannot_remove_self")
    if user.role == "owner" and _owners(session) <= 1:
        raise HTTPException(409, "last_owner")
    _end_sessions(session, user.id)
    session.delete(user)
    session.commit()
