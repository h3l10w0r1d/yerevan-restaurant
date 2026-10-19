import json
import re
import xml.dom.minidom
from datetime import datetime, timedelta, timezone

from app.routers import seo
from tests.test_api import client, login  # noqa: F401

SHELL = """<!doctype html>
<html lang="en">
  <head>
    <title>Yerevan · Armenian restaurant in Hilversum</title>
    <meta name="description" content="home" />
    <link rel="canonical" href="https://example.test/" />
    <meta property="og:title" content="home" />
    <script type="application/ld+json" id="ld-restaurant">{"@type":"Restaurant"}</script>
  </head>
  <body><div id="root"></div><script type="module" src="/assets/index.js"></script></body>
</html>"""


def post_body(**kw):
    base = {"title": "Tolma, the way grandmothers fold it", "html": "<p>Vine leaves, rice and patience.</p>",
            "content_json": {"type": "doc"}, "language": "en"}
    base.update(kw)
    return base


def test_post_lifecycle(client):  # noqa: F811
    h = login(client)
    tag = client.post("/api/admin/tags", headers=h, json={"name": "Recipes", "meta_description": "Armenian recipes"}).json()
    assert tag["slug"] == "recipes"

    draft = client.post("/api/admin/posts", headers=h, json=post_body(tag_ids=[tag["id"]],
        html='<h2>Why</h2><p onclick="x()">Hi<script>alert(1)</script></p>')).json()
    assert draft["slug"] == "tolma-the-way-grandmothers-fold-it"
    assert "script" not in draft["html"] and "onclick" not in draft["html"]
    assert draft["status"] == "draft" and draft["tags"][0]["slug"] == "recipes"
    # Drafts are private, but the preview link works.
    assert client.get(f"/api/blog/posts/{draft['slug']}").status_code == 404
    assert client.get(f"/api/blog/preview/{draft['uuid']}").json()["preview"] is True

    pub = client.put(f"/api/admin/posts/{draft['id']}", headers=h,
                     json=post_body(tag_ids=[tag["id"]], status="published", meta_description="Tolma, step by step.")).json()
    assert pub["published_at"] is not None
    listing = client.get("/api/blog/posts").json()
    assert listing["pagination"]["total"] == 1 and listing["posts"][0]["reading_time"] == 1
    full = client.get(f"/api/blog/posts/{pub['slug']}").json()
    assert full["html"].startswith("<p>Vine leaves") and full["primary_tag"]["slug"] == "recipes"
    assert client.get("/api/blog/posts", params={"tag": "recipes"}).json()["pagination"]["total"] == 1
    assert client.get("/api/blog/tags").json()[0]["count"] == 1

    # Same title again gets a unique slug.
    second = client.post("/api/admin/posts", headers=h, json=post_body()).json()
    assert second["slug"] == "tolma-the-way-grandmothers-fold-it-2"


def test_scheduled_posts_stay_hidden(client):  # noqa: F811
    h = login(client)
    later = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    p = client.post("/api/admin/posts", headers=h, json=post_body(status="published", published_at=later)).json()
    assert client.get("/api/blog/posts").json()["pagination"]["total"] == 0
    assert client.get(f"/api/blog/posts/{p['slug']}").status_code == 404
    rows = client.get("/api/admin/posts", headers=h, params={"status": "scheduled"}).json()
    assert len(rows) == 1 and rows[0]["scheduled"] is True


def test_blog_admin_requires_manager(client):  # noqa: F811
    h = login(client)
    invited = client.post("/api/admin/team", headers=h, json={"name": "Gor", "email": "gor@example.com", "role": "staff"}).json()
    sh = login(client, "gor@example.com", invited["temporary_password"])
    assert client.get("/api/admin/posts", headers=sh).status_code == 403


def test_sitemap_rss_and_server_rendered_page(client, monkeypatch):  # noqa: F811
    monkeypatch.setattr(seo, "get_shell", lambda request: SHELL)
    h = login(client)
    tag = client.post("/api/admin/tags", headers=h, json={"name": "Recipes"}).json()
    p = client.post("/api/admin/posts", headers=h, json=post_body(
        status="published", tag_ids=[tag["id"]], feature_image="/api/images/abc", feature_image_alt="Tolma in a pot",
        meta_title="How to make tolma", og_title="Tolma at home")).json()

    sm = client.get("/sitemap.xml")
    assert sm.headers["content-type"].startswith("application/xml")
    doc = xml.dom.minidom.parseString(sm.text)
    locs = [n.firstChild.data for n in doc.getElementsByTagName("loc")]
    assert any(l.endswith(f"/blog/{p['slug']}") for l in locs)
    # A tag with a single post is too thin to list, and its page asks not to be indexed.
    assert not any(l.endswith("/blog/tag/recipes") for l in locs)
    assert 'content="noindex, follow"' in client.get("/blog/tag/recipes").text

    rss = client.get("/blog/rss.xml")
    xml.dom.minidom.parseString(rss.text)  # well-formed
    assert p["slug"] in rss.text and "<category><![CDATA[Recipes]]></category>" in rss.text

    page = client.get(f"/blog/{p['slug']}")
    html = page.text
    assert page.status_code == 200
    assert "<title>How to make tolma</title>" in html and html.count("<title>") == 1
    assert 'property="og:title" content="Tolma at home"' in html and 'property="og:type" content="article"' in html
    assert '/api/images/abc' in html and 'rel="canonical"' in html
    assert '<div id="root"><article><h1>Tolma, the way grandmothers fold it</h1>' in html
    ld = [json.loads(m) for m in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S)]
    types = {d.get("@type") for d in ld}
    assert {"Restaurant", "BlogPosting", "BreadcrumbList"} <= types

    assert client.get("/blog/does-not-exist").status_code == 404
    assert "noindex" in client.get("/blog/does-not-exist").text
    assert "Recipes" in client.get("/blog/tag/recipes").text
    blog_index = client.get("/blog?lang=nl").text
    assert 'lang="nl"' in blog_index and p["slug"] in blog_index
