"""Blog helpers: HTML sanitising, excerpts, reading time and the public post shape."""
import math
import re
from datetime import datetime
from typing import Iterable, List, Optional
from urllib.parse import urlparse

import nh3
from sqlmodel import Session, select

from .models import Post, PostTag, Tag, User

# What the editor produces; everything else is stripped.
ALLOWED_TAGS = {
    "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "s", "u", "code", "pre", "a",
    "ul", "ol", "li", "blockquote", "hr", "figure", "figcaption", "img", "div", "span",
    "details", "summary", "iframe",
}
ALLOWED_ATTRS = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height", "loading"},
    "iframe": {"src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"},
    "*": {"class", "data-type", "data-width", "data-emoji"},
}
EMBED_HOSTS = ("www.youtube-nocookie.com", "www.youtube.com", "youtube.com", "player.vimeo.com")


def _attribute_filter(tag: str, attr: str, value: str) -> Optional[str]:
    if attr == "class":
        # Only our own card classes, so pasted styling can't leak into the site.
        kept = [c for c in value.split() if c.startswith(("kg-", "language-"))]
        return " ".join(kept) or None
    if tag == "iframe" and attr == "src":
        return value if urlparse(value).hostname in EMBED_HOSTS else None
    return value


def sanitize(html: str) -> str:
    return nh3.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        attribute_filter=_attribute_filter,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener",
        strip_comments=True,
    )


def to_plaintext(html: str) -> str:
    html = re.sub(r'<(\w+)[^>]*class="kg-callout-emoji"[^>]*>.*?</\1>', "", html or "", flags=re.S)  # decoration, not text
    text = nh3.clean(re.sub(r"</(p|h[2-4]|li|blockquote|figcaption|summary|div)>", r"</\1>\n", html), tags=set())
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", text)).strip()


def reading_time(plaintext: str) -> int:
    words = len(re.findall(r"\w+", plaintext))
    return max(1, math.ceil(words / 230)) if words else 0


def excerpt(post: Post, length: int = 160) -> str:
    if post.custom_excerpt:
        return post.custom_excerpt
    text = " ".join(post.plaintext.split())
    return text if len(text) <= length else text[: text.rfind(" ", 0, length)].rstrip(",.;:") + "…"


def slugify(text: str) -> str:
    text = text.lower()
    for a, b in {"ä": "a", "ë": "e", "ï": "i", "ö": "o", "ü": "u", "é": "e", "è": "e", "à": "a", "ç": "c", "’": "", "'": ""}.items():
        text = text.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:80] or "post"


def unique_slug(session: Session, model, base: str, exclude_id: Optional[int] = None) -> str:
    candidate, n = base, 2
    while True:
        existing = session.exec(select(model).where(model.slug == candidate)).first()
        if not existing or existing.id == exclude_id:
            return candidate
        candidate, n = f"{base}-{n}", n + 1


def is_live(post: Post, now: Optional[datetime] = None) -> bool:
    return post.status == "published" and post.published_at is not None and post.published_at <= (now or datetime.utcnow())


def post_tags(session: Session, post_ids: Iterable[int]) -> dict:
    ids = list(post_ids)
    if not ids:
        return {}
    rows = session.exec(
        select(PostTag, Tag).where(PostTag.post_id.in_(ids), PostTag.tag_id == Tag.id).order_by(PostTag.position)
    ).all()
    out: dict = {i: [] for i in ids}
    for link, tag in rows:
        out[link.post_id].append({"id": tag.id, "name": tag.name, "slug": tag.slug, "color": tag.color})
    return out


def set_tags(session: Session, post_id: int, tag_ids: List[int]) -> None:
    for link in session.exec(select(PostTag).where(PostTag.post_id == post_id)).all():
        session.delete(link)
    for pos, tag_id in enumerate(dict.fromkeys(tag_ids)):
        if session.get(Tag, tag_id):
            session.add(PostTag(post_id=post_id, tag_id=tag_id, position=pos))


def card(post: Post, tags: list, authors: dict) -> dict:
    """Public list item."""
    return {
        "id": post.id, "slug": post.slug, "title": post.title, "excerpt": excerpt(post),
        "feature_image": post.feature_image, "feature_image_alt": post.feature_image_alt,
        "featured": post.featured, "published_at": post.published_at, "updated_at": post.updated_at,
        "reading_time": reading_time(post.plaintext), "language": post.language,
        "tags": tags, "primary_tag": tags[0] if tags else None, "author": authors.get(post.author_id),
    }


def full(post: Post, tags: list, authors: dict) -> dict:
    return {
        **card(post, tags, authors),
        "html": post.html, "feature_image_caption": post.feature_image_caption, "custom_excerpt": post.custom_excerpt,
        "meta_title": post.meta_title, "meta_description": post.meta_description, "canonical_url": post.canonical_url,
        "og_title": post.og_title, "og_description": post.og_description, "og_image": post.og_image,
        "twitter_title": post.twitter_title, "twitter_description": post.twitter_description, "twitter_image": post.twitter_image,
    }


def author_names(session: Session, ids: Iterable[Optional[int]]) -> dict:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: {"id": u.id, "name": u.name} for u in session.exec(select(User).where(User.id.in_(ids))).all()}
