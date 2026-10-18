"""Server-side SEO: blog pages with real meta tags and content, a live sitemap and RSS.

Social crawlers (WhatsApp, Facebook, LinkedIn, X) don't run JavaScript, so for /blog URLs the
server fills the app's index.html with the post's title, description, share image, structured
data and article text. The React app then takes over in the browser as usual.
"""
import json
import re
import time
import urllib.request
from datetime import datetime
from email.utils import format_datetime
from html import escape
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session, select

from .. import blog, config
from ..db import get_session
from ..models import Post, Tag
from ..store import get_settings

router = APIRouter()
SITE = config.SITE_URL

COPY = {
    "en": {"blog_title": "Blog · Yerevan, Armenian restaurant in Hilversum",
           "blog_desc": "Stories, recipes and news from Yerevan, an Armenian restaurant in the heart of ’t Gooi.",
           "blog": "Blog", "home": "Home"},
    "nl": {"blog_title": "Blog · Yerevan, Armeens restaurant in Hilversum",
           "blog_desc": "Verhalen, recepten en nieuws van Yerevan, een Armeens restaurant in het hart van ’t Gooi.",
           "blog": "Blog", "home": "Home"},
}

_shell: dict = {"html": None, "at": 0.0, "host": None}


def _abs(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith("http"):
        return url
    return f"{SITE}{url}" if url.startswith("/") else f"{SITE}/images/{url}"


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def get_shell(request: Request) -> Optional[str]:
    """The built index.html, fetched from the static site and cached for five minutes."""
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if _shell["html"] and _shell["host"] == host and time.time() - _shell["at"] < 300:
        return _shell["html"]
    scheme = "http" if host.startswith(("localhost", "127.")) else "https"
    try:
        req = urllib.request.Request(f"{scheme}://{host}/index.html", headers={"User-Agent": "yerevan-ssr"})
        with urllib.request.urlopen(req, timeout=4) as res:
            html = res.read().decode()
        _shell.update(html=html, at=time.time(), host=host)
        return html
    except Exception:
        return _shell["html"]


STRIP = [
    r"<title>.*?</title>", r'<meta name="description"[^>]*>', r'<link rel="canonical"[^>]*>',
    r'<link rel="alternate" hreflang=[^>]*>', r'<meta property="(og|article):[^"]*"[^>]*>',
    r'<meta name="twitter:[^"]*"[^>]*>', r'<meta name="robots"[^>]*>',
]


def render(shell: Optional[str], head: str, body: str, lang: str, status: int = 200) -> HTMLResponse:
    if shell:
        html = shell
        for pattern in STRIP:
            html = re.sub(pattern, "", html, flags=re.S)
        html = html.replace("</head>", f"{head}\n</head>", 1)
        html = re.sub(r'<div id="root">\s*</div>', f'<div id="root">{body}</div>', html, count=1)
        html = re.sub(r'<html lang="[a-z-]*"', f'<html lang="{lang}"', html, count=1)
    else:  # static site unreachable: still give crawlers the content
        html = f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8">{head}</head><body>{body}</body></html>'
    headers = {"Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600"}
    return HTMLResponse(html, status_code=status, headers=headers)


def meta_tags(*, title: str, description: str, url: str, image: Optional[str], og_type: str = "website",
              og_title: Optional[str] = None, og_description: Optional[str] = None,
              tw_title: Optional[str] = None, tw_description: Optional[str] = None, tw_image: Optional[str] = None,
              noindex: bool = False, extra: str = "", alternates: Optional[dict] = None) -> str:
    e = escape
    parts = [
        f"<title>{e(title)}</title>",
        f'<meta name="description" content="{e(description)}" />',
        f'<link rel="canonical" href="{e(url)}" />',
        f'<meta name="robots" content="{"noindex, nofollow" if noindex else "index, follow, max-image-preview:large"}" />',
        f'<meta property="og:type" content="{og_type}" />',
        '<meta property="og:site_name" content="Yerevan" />',
        f'<meta property="og:title" content="{e(og_title or title)}" />',
        f'<meta property="og:description" content="{e(og_description or description)}" />',
        f'<meta property="og:url" content="{e(url)}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{e(tw_title or og_title or title)}" />',
        f'<meta name="twitter:description" content="{e(tw_description or og_description or description)}" />',
    ]
    if image:
        parts += [f'<meta property="og:image" content="{e(image)}" />', '<meta property="og:image:width" content="1200" />']
    if tw_image or image:
        parts.append(f'<meta name="twitter:image" content="{e(tw_image or image)}" />')
    for lang, href in (alternates or {}).items():
        parts.append(f'<link rel="alternate" hreflang="{lang}" href="{e(href)}" />')
    return "\n    ".join(parts) + extra


def ld(data: dict) -> str:
    return f'\n    <script type="application/ld+json">{json.dumps(data, ensure_ascii=False).replace("</", "<\\/")}</script>'


@router.get("/blog")
@router.get("/blog/")
def blog_index(request: Request, lang: str = "en", session: Session = Depends(get_session)):
    lang = "nl" if lang == "nl" else "en"
    c = COPY[lang]
    posts = session.exec(select(Post).where(Post.status == "published", Post.published_at <= datetime.utcnow())
                         .order_by(Post.published_at.desc()).limit(24)).all()
    url = f"{SITE}/blog" + ("?lang=nl" if lang == "nl" else "")
    head = meta_tags(title=c["blog_title"], description=c["blog_desc"], url=url, image=f"{SITE}/og-image.jpg",
                     alternates={"en": f"{SITE}/blog", "nl": f"{SITE}/blog?lang=nl", "x-default": f"{SITE}/blog"})
    head += ld({"@context": "https://schema.org", "@type": "Blog", "name": "Yerevan Blog", "url": f"{SITE}/blog",
                "description": c["blog_desc"], "publisher": {"@id": f"{SITE}/#restaurant"},
                "blogPost": [{"@type": "BlogPosting", "headline": p.title, "url": f"{SITE}/blog/{p.slug}",
                              "datePublished": _iso(p.published_at)} for p in posts]})
    items = "".join(f'<li><a href="/blog/{escape(p.slug)}">{escape(p.title)}</a><p>{escape(blog.excerpt(p))}</p></li>' for p in posts)
    body = f'<main><h1>{escape(c["blog"])}</h1><p>{escape(c["blog_desc"])}</p><ul>{items}</ul></main>'
    return render(get_shell(request), head, body, lang)


@router.get("/blog/rss.xml")
@router.get("/api/blog/rss.xml")
def rss(session: Session = Depends(get_session)):
    posts = session.exec(select(Post).where(Post.status == "published", Post.published_at <= datetime.utcnow())
                         .order_by(Post.published_at.desc()).limit(20)).all()
    tags = blog.post_tags(session, [p.id for p in posts])
    items = []
    for p in posts:
        cats = "".join(f"<category><![CDATA[{t['name']}]]></category>" for t in tags[p.id])
        image = f'<media:content url="{escape(_abs(p.feature_image))}" medium="image"/>' if p.feature_image else ""
        html = re.sub(r'(src|href)="/', rf'\1="{SITE}/', p.html)
        items.append(f"""    <item>
      <title><![CDATA[{p.title}]]></title>
      <link>{SITE}/blog/{p.slug}</link>
      <guid isPermaLink="false">{p.uuid}</guid>
      <pubDate>{format_datetime(p.published_at.replace(tzinfo=__import__('datetime').timezone.utc))}</pubDate>
      <description><![CDATA[{blog.excerpt(p)}]]></description>
      <content:encoded><![CDATA[{html.replace(']]>', ']]&gt;')}]]></content:encoded>
      {cats}{image}
    </item>""")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yerevan · Blog</title>
    <link>{SITE}/blog</link>
    <atom:link href="{SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>{escape(COPY['en']['blog_desc'])}</description>
    <language>nl</language>
{chr(10).join(items)}
  </channel>
</rss>
"""
    return Response(xml, media_type="application/rss+xml", headers={"Cache-Control": "public, s-maxage=300"})


@router.get("/blog/tag/{slug}")
def tag_page(slug: str, request: Request, session: Session = Depends(get_session)):
    tag = session.exec(select(Tag).where(Tag.slug == slug)).first()
    shell = get_shell(request)
    if not tag:
        return render(shell, meta_tags(title="Not found · Yerevan", description="", url=f"{SITE}/blog", image=None, noindex=True),
                      "<main><h1>Not found</h1></main>", "en", status=404)
    title = tag.meta_title or f"{tag.name} · Blog · Yerevan"
    desc = tag.meta_description or tag.description or f"Posts about {tag.name} from Yerevan, Armenian restaurant in Hilversum."
    head = meta_tags(title=title, description=desc, url=f"{SITE}/blog/tag/{tag.slug}", image=f"{SITE}/og-image.jpg")
    return render(shell, head, f"<main><h1>{escape(tag.name)}</h1><p>{escape(desc)}</p></main>", "en")


@router.get("/blog/p/{uuid}")
def preview_page(uuid: str, request: Request, session: Session = Depends(get_session)):
    post = session.exec(select(Post).where(Post.uuid == uuid)).first()
    title = f"Preview: {post.title}" if post else "Preview"
    head = meta_tags(title=title, description="", url=f"{SITE}/blog", image=None, noindex=True)
    return render(get_shell(request), head, "", "en", status=200 if post else 404)


@router.get("/blog/{slug}")
def post_page(slug: str, request: Request, session: Session = Depends(get_session)):
    shell = get_shell(request)
    post = session.exec(select(Post).where(Post.slug == slug, Post.status == "published",
                                           Post.published_at <= datetime.utcnow())).first()
    if not post:
        head = meta_tags(title="Not found · Yerevan", description="", url=f"{SITE}/blog", image=None, noindex=True)
        return render(shell, head, "<main><h1>Not found</h1></main>", "en", status=404)

    tags = blog.post_tags(session, [post.id])[post.id]
    author = blog.author_names(session, [post.author_id]).get(post.author_id)
    url = post.canonical_url or f"{SITE}/blog/{post.slug}"
    description = post.meta_description or blog.excerpt(post)
    image = _abs(post.og_image or post.feature_image) or f"{SITE}/og-image.jpg"
    article_meta = (
        f'\n    <meta property="article:published_time" content="{_iso(post.published_at)}" />'
        f'\n    <meta property="article:modified_time" content="{_iso(post.updated_at)}" />'
        + "".join(f'\n    <meta property="article:tag" content="{escape(t["name"])}" />' for t in tags)
    )
    head = meta_tags(
        title=post.meta_title or f"{post.title} · Yerevan", description=description, url=url, image=image,
        og_type="article", og_title=post.og_title or post.meta_title or post.title,
        og_description=post.og_description or description, tw_title=post.twitter_title,
        tw_description=post.twitter_description, tw_image=_abs(post.twitter_image), extra=article_meta,
    )
    crumbs = [{"name": "Home", "item": f"{SITE}/"}, {"name": "Blog", "item": f"{SITE}/blog"}]
    if tags:
        crumbs.append({"name": tags[0]["name"], "item": f"{SITE}/blog/tag/{tags[0]['slug']}"})
    crumbs.append({"name": post.title, "item": f"{SITE}/blog/{post.slug}"})
    head += ld({
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": post.title[:110], "description": description, "image": [image],
        "datePublished": _iso(post.published_at), "dateModified": _iso(post.updated_at),
        "inLanguage": post.language, "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "author": {"@type": "Person", "name": author["name"]} if author else {"@id": f"{SITE}/#restaurant"},
        "publisher": {"@type": "Organization", "name": "Yerevan", "logo": {"@type": "ImageObject", "url": f"{SITE}/icon-512.png"}},
        "keywords": ", ".join(t["name"] for t in tags) or None,
        "wordCount": len(post.plaintext.split()),
    })
    head += ld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": c["name"], "item": c["item"]} for i, c in enumerate(crumbs)]})
    img = (f'<figure><img src="{escape(image)}" alt="{escape(post.feature_image_alt or post.title)}" />'
           + (f"<figcaption>{escape(post.feature_image_caption)}</figcaption>" if post.feature_image_caption else "")
           + "</figure>") if post.feature_image else ""
    body = (f'<article><h1>{escape(post.title)}</h1><p>{escape(blog.excerpt(post))}</p>'
            f'<p>{escape(author["name"]) + " · " if author else ""}{post.published_at:%d-%m-%Y}</p>{img}{post.html}</article>')
    return render(shell, head, body, post.language)


@router.get("/sitemap.xml")
@router.get("/api/sitemap.xml")
def sitemap(session: Session = Depends(get_session)):
    today = datetime.utcnow().strftime("%Y-%m-%d")

    def entry(loc: str, lastmod: str, freq: str, prio: str, alts: Optional[dict] = None) -> str:
        links = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{k}" href="{escape(v)}"/>' for k, v in (alts or {}).items())
        return f"  <url>\n    <loc>{escape(loc)}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>{links}\n  </url>"

    urls = []
    pages = [("/", "monthly", "1.0"), ("/menu", "weekly", "0.8"), ("/blog", "daily", "0.8")]
    for path, freq, prio in pages:
        base = f"{SITE}{'' if path == '/' else path}" + ("/" if path == "/" else "")
        alts = {"en": base, "nl": f"{base}?lang=nl", "x-default": base}
        urls += [entry(base, today, freq, prio, alts), entry(f"{base}?lang=nl", today, freq, prio, alts)]
    posts = session.exec(select(Post).where(Post.status == "published", Post.published_at <= datetime.utcnow())
                         .order_by(Post.published_at.desc())).all()
    for p in posts:
        if p.canonical_url and not p.canonical_url.startswith(SITE):
            continue  # canonical lives elsewhere; don't list it as ours
        urls.append(entry(f"{SITE}/blog/{p.slug}", p.updated_at.strftime("%Y-%m-%d"), "monthly", "0.7"))
    used = blog.post_tags(session, [p.id for p in posts])
    tag_slugs = {t["slug"] for ts in used.values() for t in ts}
    for slug in sorted(tag_slugs):
        urls.append(entry(f"{SITE}/blog/tag/{slug}", today, "weekly", "0.5"))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    return Response(xml, media_type="application/xml", headers={"Cache-Control": "public, s-maxage=300"})
