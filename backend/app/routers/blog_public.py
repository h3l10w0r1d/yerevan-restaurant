from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from .. import blog
from ..db import get_session
from ..models import Post, PostTag, Tag

router = APIRouter(prefix="/api/blog")


def live_query():
    now = datetime.utcnow()
    return select(Post).where(Post.status == "published", Post.published_at <= now)


@router.get("/posts")
def list_posts(
    tag: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
    session: Session = Depends(get_session),
):
    q = live_query()
    if tag:
        t = session.exec(select(Tag).where(Tag.slug == tag)).first()
        if not t:
            raise HTTPException(404, "not_found")
        q = q.where(Post.id.in_(select(PostTag.post_id).where(PostTag.tag_id == t.id)))
    total = session.exec(select(func.count()).select_from(q.subquery())).one()
    posts = session.exec(q.order_by(Post.featured.desc() if page == 1 and not tag else Post.published_at.desc(),
                                    Post.published_at.desc()).offset((page - 1) * limit).limit(limit)).all()
    tags = blog.post_tags(session, [p.id for p in posts])
    authors = blog.author_names(session, [p.author_id for p in posts])
    return {
        "posts": [blog.card(p, tags[p.id], authors) for p in posts],
        "pagination": {"page": page, "limit": limit, "total": total, "pages": max(1, -(-total // limit))},
    }


@router.get("/posts/{slug}")
def get_post(slug: str, session: Session = Depends(get_session)):
    post = session.exec(live_query().where(Post.slug == slug)).first()
    if not post:
        raise HTTPException(404, "not_found")
    return _full_with_related(session, post)


@router.get("/preview/{uuid}")
def preview(uuid: str, session: Session = Depends(get_session)):
    """Private link for drafts and scheduled posts; never indexed."""
    post = session.exec(select(Post).where(Post.uuid == uuid)).first()
    if not post:
        raise HTTPException(404, "not_found")
    return {**_full_with_related(session, post), "preview": True, "status": post.status}


@router.get("/tags")
def list_tags(session: Session = Depends(get_session)):
    counts = dict(session.exec(
        select(PostTag.tag_id, func.count())
        .where(PostTag.post_id.in_(select(Post.id).where(Post.status == "published", Post.published_at <= datetime.utcnow())))
        .group_by(PostTag.tag_id)
    ).all())
    tags = session.exec(select(Tag).order_by(Tag.name)).all()
    return [{"id": t.id, "name": t.name, "slug": t.slug, "description": t.description, "color": t.color,
             "count": counts.get(t.id, 0)} for t in tags if counts.get(t.id)]


@router.get("/tags/{slug}")
def get_tag(slug: str, session: Session = Depends(get_session)):
    t = session.exec(select(Tag).where(Tag.slug == slug)).first()
    if not t:
        raise HTTPException(404, "not_found")
    return t


def _full_with_related(session: Session, post: Post) -> dict:
    tags = blog.post_tags(session, [post.id])[post.id]
    related_q = live_query().where(Post.id != post.id)
    if tags:
        related_q = related_q.where(Post.id.in_(select(PostTag.post_id).where(PostTag.tag_id == tags[0]["id"])))
    related = session.exec(related_q.order_by(Post.published_at.desc()).limit(3)).all()
    if len(related) < 3:  # top up with the latest posts
        seen = {p.id for p in related} | {post.id}
        related += [p for p in session.exec(live_query().order_by(Post.published_at.desc()).limit(6)).all() if p.id not in seen][: 3 - len(related)]
    rtags = blog.post_tags(session, [p.id for p in related])
    authors = blog.author_names(session, [post.author_id] + [p.author_id for p in related])
    return {**blog.full(post, tags, authors), "related": [blog.card(p, rtags[p.id], authors) for p in related]}
