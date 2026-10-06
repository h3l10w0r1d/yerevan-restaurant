import hashlib
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, SQLModel, select

from .. import config
from ..db import get_session
from ..deps import manager
from ..models import Category, CategoryWrite, Image, MenuItem, MenuItemWrite
from ..store import public_menu, slugify, unique_id

router = APIRouter(prefix="/api/admin", dependencies=[Depends(manager)])

ALLOWED_TYPES = {"image/webp", "image/jpeg", "image/png", "image/avif"}


class Reorder(SQLModel):
    ids: List[str]


@router.get("/menu")
def full_menu(session: Session = Depends(get_session)):
    cats = session.exec(select(Category).order_by(Category.position)).all()
    items = session.exec(select(MenuItem).order_by(MenuItem.position)).all()
    return {"categories": cats, "items": items}


@router.get("/menu/preview")
def preview(session: Session = Depends(get_session)):
    return public_menu(session, include_unavailable=True)


# Categories

@router.post("/categories", status_code=201)
def create_category(body: CategoryWrite, session: Session = Depends(get_session)):
    last = session.exec(select(Category).order_by(Category.position.desc())).first()
    cat = Category(id=unique_id(session, Category, slugify(body.name_en)), position=(last.position + 1) if last else 0,
                   **body.model_dump())
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.put("/categories/{cid}")
def update_category(cid: str, body: CategoryWrite, session: Session = Depends(get_session)):
    cat = session.get(Category, cid)
    if not cat:
        raise HTTPException(404, "not_found")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/categories/{cid}", status_code=204)
def delete_category(cid: str, session: Session = Depends(get_session)):
    cat = session.get(Category, cid)
    if not cat:
        raise HTTPException(404, "not_found")
    if session.exec(select(MenuItem).where(MenuItem.category_id == cid)).first():
        raise HTTPException(409, "category_not_empty")
    session.delete(cat)
    session.commit()


@router.post("/categories/reorder", status_code=204)
def reorder_categories(body: Reorder, session: Session = Depends(get_session)):
    for pos, cid in enumerate(body.ids):
        cat = session.get(Category, cid)
        if cat:
            cat.position = pos
            session.add(cat)
    session.commit()


# Items

def _check_category(session: Session, cid: str) -> None:
    if not session.get(Category, cid):
        raise HTTPException(422, "unknown_category")


@router.post("/items", status_code=201)
def create_item(body: MenuItemWrite, session: Session = Depends(get_session)):
    _check_category(session, body.category_id)
    last = session.exec(
        select(MenuItem).where(MenuItem.category_id == body.category_id).order_by(MenuItem.position.desc())
    ).first()
    item = MenuItem(id=unique_id(session, MenuItem, slugify(body.name_en)),
                    position=(last.position + 1) if last else 0, **body.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.put("/items/{iid}")
def update_item(iid: str, body: MenuItemWrite, session: Session = Depends(get_session)):
    item = session.get(MenuItem, iid)
    if not item:
        raise HTTPException(404, "not_found")
    _check_category(session, body.category_id)
    if body.category_id != item.category_id:
        last = session.exec(
            select(MenuItem).where(MenuItem.category_id == body.category_id).order_by(MenuItem.position.desc())
        ).first()
        item.position = (last.position + 1) if last else 0
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/items/{iid}", status_code=204)
def delete_item(iid: str, session: Session = Depends(get_session)):
    item = session.get(MenuItem, iid)
    if not item:
        raise HTTPException(404, "not_found")
    session.delete(item)
    session.commit()


@router.post("/items/reorder", status_code=204)
def reorder_items(body: Reorder, session: Session = Depends(get_session)):
    for pos, iid in enumerate(body.ids):
        item = session.get(MenuItem, iid)
        if item:
            item.position = pos
            session.add(item)
    session.commit()


# Images: raw body upload; the admin app resizes to WebP before sending.

@router.post("/images", status_code=201)
async def upload_image(request: Request, session: Session = Depends(get_session)):
    content_type = request.headers.get("content-type", "").split(";")[0].strip()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "unsupported_type")
    data = await request.body()
    if not data:
        raise HTTPException(422, "empty")
    if len(data) > config.MAX_IMAGE_BYTES:
        raise HTTPException(413, "too_large")
    image_id = hashlib.sha256(data).hexdigest()[:32]
    if not session.get(Image, image_id):
        session.add(Image(id=image_id, content_type=content_type, size=len(data), data=data))
        session.commit()
    return {"id": image_id, "url": f"/api/images/{image_id}"}
