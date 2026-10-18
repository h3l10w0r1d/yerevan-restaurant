import json
import uuid as uuidlib
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Field, Session, SQLModel, func, select

from .. import blog
from ..db import get_session
from ..deps import manager
from ..models import POST_STATUSES, Post, PostTag, Tag, User

router = APIRouter(prefix="/api/admin", dependencies=[Depends(manager)])


class PostWrite(SQLModel):
    title: str = Field(default="", max_length=255)
    slug: Optional[str] = Field(default=None, max_length=120)
    html: str = ""
    content_json: Optional[dict] = None
    custom_excerpt: Optional[str] = Field(default=None, max_length=300)
    feature_image: Optional[str] = Field(default=None, max_length=500)
    feature_image_alt: Optional[str] = Field(default=None, max_length=191)
    feature_image_caption: Optional[str] = Field(default=None, max_length=500)
    featured: bool = False
    status: str = "draft"
    published_at: Optional[datetime] = None
    language: str = "nl"
    author_id: Optional[int] = None
    tag_ids: List[int] = Field(default_factory=list)
    meta_title: Optional[str] = Field(default=None, max_length=300)
    meta_description: Optional[str] = Field(default=None, max_length=500)
    canonical_url: Optional[str] = Field(default=None, max_length=500)
    og_title: Optional[str] = Field(default=None, max_length=300)
    og_description: Optional[str] = Field(default=None, max_length=500)
    og_image: Optional[str] = Field(default=None, max_length=500)
    twitter_title: Optional[str] = Field(default=None, max_length=300)
    twitter_description: Optional[str] = Field(default=None, max_length=500)
    twitter_image: Optional[str] = Field(default=None, max_length=500)
    focus_keyword: Optional[str] = Field(default=None, max_length=100)


class TagWrite(SQLModel):
    name: str = Field(min_length=1, max_length=120)
    slug: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    color: Optional[str] = Field(default=None, max_length=7)
    meta_title: Optional[str] = Field(default=None, max_length=300)
    meta_description: Optional[str] = Field(default=None, max_length=500)


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _admin_shape(session: Session, post: Post) -> dict:
    tags = blog.post_tags(session, [post.id])[post.id]
    data = post.model_dump()
    data["content_json"] = json.loads(post.content_json) if post.content_json else None
    data["tags"] = tags
    data["reading_time"] = blog.reading_time(post.plaintext)
    data["word_count"] = len(post.plaintext.split())
    data["excerpt"] = blog.excerpt(post)
    return data


def _apply(session: Session, post: Post, body: PostWrite) -> None:
    if body.status not in POST_STATUSES:
        raise HTTPException(422, "invalid_status")
    data = body.model_dump(exclude={"tag_ids", "content_json", "slug", "html", "published_at"})
    for k, v in data.items():
        setattr(post, k, v.strip() if isinstance(v, str) and k not in ("title",) else v)
    for k in ("custom_excerpt", "meta_title", "meta_description", "canonical_url", "og_title", "og_description",
              "twitter_title", "twitter_description", "focus_keyword", "feature_image_alt", "feature_image_caption"):
        if getattr(post, k) == "":
            setattr(post, k, None)
    post.html = blog.sanitize(body.html)
    post.plaintext = blog.to_plaintext(post.html)
    post.content_json = json.dumps(body.content_json) if body.content_json is not None else post.content_json
    wanted = blog.slugify(body.slug) if body.slug else blog.slugify(post.title or "untitled")
    post.slug = blog.unique_slug(session, Post, wanted, exclude_id=post.id)
    if body.status == "published":
        post.published_at = _utc(body.published_at) or post.published_at or datetime.utcnow()
    else:
        post.published_at = _utc(body.published_at)
    post.updated_at = datetime.utcnow()


@router.get("/posts")
def list_posts(status: Optional[str] = None, tag: Optional[str] = None, author: Optional[int] = None,
               featured: Optional[bool] = None, sort: str = "newest", session: Session = Depends(get_session)):
    now = datetime.utcnow()
    q = select(Post)
    if status == "draft":
        q = q.where(Post.status == "draft")
    elif status == "published":
        q = q.where(Post.status == "published", Post.published_at <= now)
    elif status == "scheduled":
        q = q.where(Post.status == "published", Post.published_at > now)
    if featured:
        q = q.where(Post.featured == True)  # noqa: E712
    if author:
        q = q.where(Post.author_id == author)
    if tag:
        t = session.exec(select(Tag).where(Tag.slug == tag)).first()
        q = q.where(Post.id.in_(select(PostTag.post_id).where(PostTag.tag_id == (t.id if t else -1))))
    order = {"oldest": Post.created_at.asc(), "updated": Post.updated_at.desc()}.get(sort, Post.created_at.desc())
    posts = session.exec(q.order_by(order)).all()
    tags = blog.post_tags(session, [p.id for p in posts])
    authors = blog.author_names(session, [p.author_id for p in posts])
    return [{
        "id": p.id, "title": p.title, "slug": p.slug, "status": p.status, "featured": p.featured,
        "published_at": p.published_at, "updated_at": p.updated_at, "created_at": p.created_at,
        "feature_image": p.feature_image, "tags": tags[p.id], "author": authors.get(p.author_id),
        "scheduled": p.status == "published" and p.published_at is not None and p.published_at > now,
    } for p in posts]


@router.post("/posts", status_code=201)
def create_post(body: PostWrite, session: Session = Depends(get_session), user: User = Depends(manager)):
    post = Post(uuid=uuidlib.uuid4().hex, slug=f"draft-{uuidlib.uuid4().hex[:8]}", author_id=body.author_id or user.id)
    session.add(post)
    session.flush()
    if not body.author_id:
        body.author_id = user.id
    _apply(session, post, body)
    blog.set_tags(session, post.id, body.tag_ids)
    session.add(post)
    session.commit()
    session.refresh(post)
    return _admin_shape(session, post)


@router.get("/posts/{pid}")
def get_post(pid: int, session: Session = Depends(get_session)):
    post = session.get(Post, pid)
    if not post:
        raise HTTPException(404, "not_found")
    return _admin_shape(session, post)


@router.put("/posts/{pid}")
def update_post(pid: int, body: PostWrite, session: Session = Depends(get_session)):
    post = session.get(Post, pid)
    if not post:
        raise HTTPException(404, "not_found")
    _apply(session, post, body)
    blog.set_tags(session, post.id, body.tag_ids)
    session.add(post)
    session.commit()
    session.refresh(post)
    return _admin_shape(session, post)


@router.delete("/posts/{pid}", status_code=204)
def delete_post(pid: int, session: Session = Depends(get_session)):
    post = session.get(Post, pid)
    if not post:
        raise HTTPException(404, "not_found")
    blog.set_tags(session, post.id, [])
    session.delete(post)
    session.commit()


@router.get("/authors")
def authors(session: Session = Depends(get_session)):
    return [{"id": u.id, "name": u.name} for u in session.exec(select(User).where(User.active == True).order_by(User.name)).all()]  # noqa: E712


# Tags

@router.get("/tags")
def list_tags(session: Session = Depends(get_session)):
    counts = dict(session.exec(select(PostTag.tag_id, func.count()).group_by(PostTag.tag_id)).all())
    return [{**t.model_dump(), "count": counts.get(t.id, 0)} for t in session.exec(select(Tag).order_by(Tag.name)).all()]


@router.post("/tags", status_code=201)
def create_tag(body: TagWrite, session: Session = Depends(get_session)):
    tag = Tag(**body.model_dump(exclude={"slug"}), slug=blog.unique_slug(session, Tag, blog.slugify(body.slug or body.name)))
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return {**tag.model_dump(), "count": 0}


@router.get("/tags/{tid}")
def get_tag(tid: int, session: Session = Depends(get_session)):
    tag = session.get(Tag, tid)
    if not tag:
        raise HTTPException(404, "not_found")
    return tag


@router.put("/tags/{tid}")
def update_tag(tid: int, body: TagWrite, session: Session = Depends(get_session)):
    tag = session.get(Tag, tid)
    if not tag:
        raise HTTPException(404, "not_found")
    for k, v in body.model_dump(exclude={"slug"}).items():
        setattr(tag, k, v or None if k != "name" else v)
    tag.slug = blog.unique_slug(session, Tag, blog.slugify(body.slug or body.name), exclude_id=tag.id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/tags/{tid}", status_code=204)
def delete_tag(tid: int, session: Session = Depends(get_session)):
    tag = session.get(Tag, tid)
    if not tag:
        raise HTTPException(404, "not_found")
    for link in session.exec(select(PostTag).where(PostTag.tag_id == tid)).all():
        session.delete(link)
    session.delete(tag)
    session.commit()
