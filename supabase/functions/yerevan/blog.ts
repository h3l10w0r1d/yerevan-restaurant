// Blog: sanitising, excerpts, public API and the admin editor API (port of blog.py, blog_public.py, blog_admin.py).
import sanitizeHtml from "npm:sanitize-html@2.13.1";
import { Hono } from "npm:hono@4.6.14";
import { fail, sql, Sql, utcNow, uuidHex, validate, toUtcNaive } from "./lib.ts";
import { requireRole } from "./auth.ts";

const EMBED_HOSTS = ["www.youtube-nocookie.com", "www.youtube.com", "youtube.com", "player.vimeo.com"];
const ALLOWED_TAGS = ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "s", "u", "code", "pre", "a", "ul", "ol", "li",
  "blockquote", "hr", "figure", "figcaption", "img", "div", "span", "details", "summary", "iframe"];
const COMMON = ["data-type", "data-width", "data-emoji"];

export function sanitize(html: string) {
  return sanitizeHtml(html || "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel", ...COMMON],
      img: ["src", "alt", "title", "width", "height", "loading", ...COMMON],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title", ...COMMON],
      "*": COMMON,
    },
    // Only our own card classes, so pasted styling can't leak into the site.
    allowedClasses: { "*": ["kg-*", "language-*"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedIframeHostnames: EMBED_HOSTS,
    allowIframeRelativeUrls: false,
    transformTags: { a: (tagName: string, attribs: Record<string, string>) => ({ tagName, attribs: { ...attribs, rel: "noopener" } }) },
  });
}

export function toPlaintext(html: string) {
  html = (html || "").replace(/<(\w+)[^>]*class="kg-callout-emoji"[^>]*>[\s\S]*?<\/\1>/g, ""); // decoration, not text
  html = html.replace(/<\/(p|h[2-4]|li|blockquote|figcaption|summary|div)>/g, "</$1>\n");
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/\n\s*\n+/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

export const readingTime = (plain: string) => {
  const words = (plain.match(/[\p{L}\p{N}_]+/gu) || []).length;
  return words ? Math.max(1, Math.ceil(words / 230)) : 0;
};

export function excerpt(post: any, length = 160) {
  if (post.custom_excerpt) return post.custom_excerpt;
  const text = (post.plaintext || "").split(/\s+/).filter(Boolean).join(" ");
  if (text.length <= length) return text;
  return text.slice(0, text.lastIndexOf(" ", length - 1)).replace(/[,.;:]+$/, "") + "…";
}

const SWAP: Record<string, string> = { "ä": "a", "ë": "e", "ï": "i", "ö": "o", "ü": "u", "é": "e", "è": "e", "à": "a", "ç": "c", "’": "", "'": "" };
export function slugify(text: string) {
  let t = text.toLowerCase();
  for (const [a, b] of Object.entries(SWAP)) t = t.split(a).join(b);
  return t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "post";
}

export async function uniqueSlug(db: Sql, table: "post" | "tag", base: string, excludeId?: number | null) {
  let candidate = base, n = 2;
  for (;;) {
    const [row] = await db`select id from ${db(table)} where slug = ${candidate}`;
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${n++}`;
  }
}

export async function postTags(ids: number[], db: Sql = sql): Promise<Record<number, any[]>> {
  const out: Record<number, any[]> = {};
  for (const i of ids) out[i] = [];
  if (!ids.length) return out;
  const rows = await db`select pt.post_id, t.id, t.name, t.slug, t.color from posttag pt join tag t on t.id = pt.tag_id
    where pt.post_id in ${db(ids)} order by pt.position`;
  for (const r of rows) out[r.post_id].push({ id: r.id, name: r.name, slug: r.slug, color: r.color });
  return out;
}

async function setTags(db: Sql, postId: number, tagIds: number[]) {
  await db`delete from posttag where post_id = ${postId}`;
  const unique = [...new Set(tagIds)];
  for (let pos = 0; pos < unique.length; pos++) {
    const [tag] = await db`select id from tag where id = ${unique[pos]}`;
    if (tag) await db`insert into posttag (post_id, tag_id, position) values (${postId}, ${unique[pos]}, ${pos})`;
  }
}

export async function authorNames(ids: (number | null)[], db: Sql = sql): Promise<Record<number, any>> {
  const set = [...new Set(ids.filter((i): i is number => !!i))];
  if (!set.length) return {};
  const rows = await db`select id, name from "user" where id in ${db(set)}`;
  return Object.fromEntries(rows.map((u) => [u.id, { id: u.id, name: u.name }]));
}

export const card = (p: any, tags: any[], authors: Record<number, any>) => ({
  id: p.id, slug: p.slug, title: p.title, excerpt: excerpt(p),
  feature_image: p.feature_image, feature_image_alt: p.feature_image_alt,
  featured: p.featured, published_at: p.published_at, updated_at: p.updated_at,
  reading_time: readingTime(p.plaintext || ""), language: p.language,
  tags, primary_tag: tags[0] ?? null, author: authors[p.author_id] ?? null,
});

const full = (p: any, tags: any[], authors: Record<number, any>) => ({
  ...card(p, tags, authors),
  html: p.html, feature_image_caption: p.feature_image_caption, custom_excerpt: p.custom_excerpt,
  meta_title: p.meta_title, meta_description: p.meta_description, canonical_url: p.canonical_url,
  og_title: p.og_title, og_description: p.og_description, og_image: p.og_image,
  twitter_title: p.twitter_title, twitter_description: p.twitter_description, twitter_image: p.twitter_image,
});

const LIVE = () => sql`status = 'published' and published_at <= (now() at time zone 'utc')`;

async function fullWithRelated(post: any) {
  const tags = (await postTags([post.id]))[post.id];
  const found = tags.length
    ? await sql`select * from post where ${LIVE()} and id != ${post.id}
        and id in (select post_id from posttag where tag_id = ${tags[0].id}) order by published_at desc limit 3`
    : await sql`select * from post where ${LIVE()} and id != ${post.id} order by published_at desc limit 3`;
  const related: any[] = [...found];
  if (related.length < 3) { // top up with the latest posts
    const seen = new Set([post.id, ...related.map((p) => p.id)]);
    const latest = await sql`select * from post where ${LIVE()} order by published_at desc limit 6`;
    related.push(...latest.filter((p) => !seen.has(p.id)).slice(0, 3 - related.length));
  }
  const rtags = await postTags(related.map((p) => p.id));
  const authors = await authorNames([post.author_id, ...related.map((p) => p.author_id)]);
  return { ...full(post, tags, authors), related: related.map((p) => card(p, rtags[p.id], authors)) };
}

const intParam = (v: string | undefined, name = "id") => {
  if (!v || !/^-?\d+$/.test(v)) fail(422, [{ loc: ["path", name], msg: "Input should be a valid integer" }]);
  return Number(v);
};
const intQuery = (v: string | undefined, def: number, min: number, max = Infinity, name = "q") => {
  if (v === undefined || v === "") return def;
  const n = intParam(v, name);
  if (n < min || n > max) fail(422, [{ loc: ["query", name], msg: `out of range` }]);
  return n;
};

export const blog = new Hono();

// --- Public ---------------------------------------------------------------------

blog.get("/api/blog/posts", async (c) => {
  const tag = c.req.query("tag");
  const page = intQuery(c.req.query("page"), 1, 1, Infinity, "page");
  const limit = intQuery(c.req.query("limit"), 12, 1, 50, "limit");
  let tagFilter = sql``;
  if (tag) {
    const [t] = await sql`select id from tag where slug = ${tag}`;
    if (!t) fail(404, "not_found");
    tagFilter = sql`and id in (select post_id from posttag where tag_id = ${t.id})`;
  }
  const [{ count }] = await sql`select count(*)::int as count from post where ${LIVE()} ${tagFilter}`;
  const order = page === 1 && !tag ? sql`featured desc, published_at desc` : sql`published_at desc, published_at desc`;
  const posts = await sql`select * from post where ${LIVE()} ${tagFilter} order by ${order} offset ${(page - 1) * limit} limit ${limit}`;
  const tags = await postTags(posts.map((p) => p.id));
  const authors = await authorNames(posts.map((p) => p.author_id));
  return c.json({
    posts: posts.map((p) => card(p, tags[p.id], authors)),
    pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
  });
});

blog.get("/api/blog/posts/:slug", async (c) => {
  const [post] = await sql`select * from post where ${LIVE()} and slug = ${c.req.param("slug")}`;
  if (!post) fail(404, "not_found");
  return c.json(await fullWithRelated(post));
});

blog.get("/api/blog/preview/:uuid", async (c) => {
  const [post] = await sql`select * from post where uuid = ${c.req.param("uuid")}`;
  if (!post) fail(404, "not_found");
  return c.json({ ...(await fullWithRelated(post)), preview: true, status: post.status });
});

blog.get("/api/blog/tags", async (c) => {
  const rows = await sql`select t.id, t.name, t.slug, t.description, t.color, count(pt.post_id)::int as count
    from tag t join posttag pt on pt.tag_id = t.id join post p on p.id = pt.post_id
    where p.status = 'published' and p.published_at <= (now() at time zone 'utc')
    group by t.id order by t.name`;
  return c.json(rows);
});

blog.get("/api/blog/tags/:slug", async (c) => {
  const [t] = await sql`select * from tag where slug = ${c.req.param("slug")}`;
  if (!t) fail(404, "not_found");
  return c.json(t);
});

// --- Admin ----------------------------------------------------------------------

const S = (max: number) => ({ max, optional: true });
const POST_SCHEMA = {
  title: { max: 255, def: "" }, slug: S(120), html: { def: "" }, content_json: { type: "any" as const, optional: true },
  custom_excerpt: S(300), feature_image: S(500), feature_image_alt: S(191), feature_image_caption: S(500),
  featured: { type: "bool" as const, def: false }, status: { def: "draft" }, published_at: { type: "any" as const, optional: true },
  language: { def: "nl" }, author_id: { type: "int" as const, optional: true }, tag_ids: { type: "list" as const, def: () => [] },
  meta_title: S(300), meta_description: S(500), canonical_url: S(500), og_title: S(300), og_description: S(500), og_image: S(500),
  twitter_title: S(300), twitter_description: S(500), twitter_image: S(500), focus_keyword: S(100),
};
const DIRECT = ["title", "custom_excerpt", "feature_image", "feature_image_alt", "feature_image_caption", "featured", "status",
  "language", "author_id", "meta_title", "meta_description", "canonical_url", "og_title", "og_description", "og_image",
  "twitter_title", "twitter_description", "twitter_image", "focus_keyword"];
const BLANK_TO_NULL = ["custom_excerpt", "meta_title", "meta_description", "canonical_url", "og_title", "og_description",
  "twitter_title", "twitter_description", "focus_keyword", "feature_image_alt", "feature_image_caption"];

async function adminShape(db: Sql, post: any) {
  const tags = (await postTags([post.id], db))[post.id];
  const plain = post.plaintext || "";
  return {
    ...post,
    content_json: post.content_json ? JSON.parse(post.content_json) : null,
    tags, reading_time: readingTime(plain), word_count: plain.split(/\s+/).filter(Boolean).length, excerpt: excerpt(post),
  };
}

async function applyPost(db: Sql, post: any, body: any) {
  if (!["draft", "published"].includes(body.status)) fail(422, "invalid_status");
  const changes: Record<string, unknown> = {};
  for (const k of DIRECT) {
    const v = body[k];
    changes[k] = typeof v === "string" && k !== "title" ? v.trim() : v;
  }
  for (const k of BLANK_TO_NULL) if (changes[k] === "") changes[k] = null;
  changes.html = sanitize(body.html);
  changes.plaintext = toPlaintext(changes.html as string);
  changes.content_json = body.content_json !== null && body.content_json !== undefined ? JSON.stringify(body.content_json) : post.content_json;
  const wanted = body.slug ? slugify(body.slug) : slugify((changes.title as string) || "untitled");
  changes.slug = await uniqueSlug(db, "post", wanted, post.id);
  const when = toUtcNaive(body.published_at);
  changes.published_at = body.status === "published" ? (when || post.published_at || utcNow()) : when;
  changes.updated_at = utcNow();
  const [row] = await db`update post set ${db(changes)} where id = ${post.id} returning *`;
  return row;
}

blog.get("/api/admin/posts", async (c) => {
  await requireRole(c, "owner", "manager");
  const { status, tag, author, featured, sort = "newest" } = c.req.query();
  const where = [sql`true`];
  if (status === "draft") where.push(sql`status = 'draft'`);
  else if (status === "published") where.push(sql`status = 'published' and published_at <= (now() at time zone 'utc')`);
  else if (status === "scheduled") where.push(sql`status = 'published' and published_at > (now() at time zone 'utc')`);
  if (featured === "true" || featured === "1") where.push(sql`featured = true`);
  if (author) where.push(sql`author_id = ${intParam(author, "author")}`);
  if (tag) {
    const [t] = await sql`select id from tag where slug = ${tag}`;
    where.push(sql`id in (select post_id from posttag where tag_id = ${t ? t.id : -1})`);
  }
  const order = sort === "oldest" ? sql`coalesce(published_at, updated_at) asc`
    : sort === "updated" ? sql`updated_at desc` : sql`coalesce(published_at, updated_at) desc`;
  const cond = where.reduce((a, b) => sql`${a} and ${b}`);
  const posts = await sql`select *, (status = 'published' and published_at is not null and published_at > (now() at time zone 'utc')) as scheduled
    from post where ${cond} order by ${order}`;
  const tags = await postTags(posts.map((p) => p.id));
  const authors = await authorNames(posts.map((p) => p.author_id));
  return c.json(posts.map((p) => ({
    id: p.id, title: p.title, slug: p.slug, status: p.status, featured: p.featured,
    published_at: p.published_at, updated_at: p.updated_at, created_at: p.created_at,
    feature_image: p.feature_image, tags: tags[p.id], author: authors[p.author_id] ?? null, scheduled: p.scheduled,
  })));
});

blog.post("/api/admin/posts", async (c) => {
  const user = await requireRole(c, "owner", "manager");
  const body = validate<any>(await c.req.json().catch(() => null), POST_SCHEMA);
  if (!body.author_id) body.author_id = user.id;
  const out = await sql.begin(async (db: any) => {
    const now = utcNow();
    const [post] = await db`insert into post ${db({
      uuid: uuidHex(), slug: `draft-${uuidHex().slice(0, 8)}`, author_id: body.author_id, title: "", html: "", plaintext: "",
      featured: false, status: "draft", language: "nl", created_at: now, updated_at: now,
    })} returning *`;
    const saved = await applyPost(db, post, body);
    await setTags(db, saved.id, body.tag_ids);
    return adminShape(db, saved);
  });
  return c.json(out, 201);
});

blog.get("/api/admin/posts/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const [post] = await sql`select * from post where id = ${intParam(c.req.param("id"))}`;
  if (!post) fail(404, "not_found");
  return c.json(await adminShape(sql, post));
});

blog.put("/api/admin/posts/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const id = intParam(c.req.param("id"));
  const body = validate<any>(await c.req.json().catch(() => null), POST_SCHEMA);
  const out = await sql.begin(async (db: any) => {
    const [post] = await db`select * from post where id = ${id}`;
    if (!post) fail(404, "not_found");
    const saved = await applyPost(db, post, body);
    await setTags(db, id, body.tag_ids);
    return adminShape(db, saved);
  });
  return c.json(out);
});

blog.delete("/api/admin/posts/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const id = intParam(c.req.param("id"));
  const [post] = await sql`select id from post where id = ${id}`;
  if (!post) fail(404, "not_found");
  await sql.begin(async (db: any) => {
    await db`delete from posttag where post_id = ${id}`;
    await db`delete from post where id = ${id}`;
  });
  return c.body(null, 204);
});

blog.get("/api/admin/authors", async (c) => {
  await requireRole(c, "owner", "manager");
  return c.json(await sql`select id, name from "user" where active = true order by name`);
});

const TAG_SCHEMA = { name: { min: 1, max: 120 }, slug: S(120), description: S(500), color: S(7), meta_title: S(300), meta_description: S(500) };

blog.get("/api/admin/tags", async (c) => {
  await requireRole(c, "owner", "manager");
  return c.json(await sql`select t.*, (select count(*)::int from posttag pt where pt.tag_id = t.id) as count from tag t order by t.name`);
});

blog.post("/api/admin/tags", async (c) => {
  await requireRole(c, "owner", "manager");
  const b = validate<any>(await c.req.json().catch(() => null), TAG_SCHEMA);
  const slug = await uniqueSlug(sql, "tag", slugify(b.slug || b.name));
  const [tag] = await sql`insert into tag ${sql({
    name: b.name, slug, description: b.description, color: b.color, meta_title: b.meta_title, meta_description: b.meta_description, created_at: utcNow(),
  })} returning *`;
  return c.json({ ...tag, count: 0 }, 201);
});

blog.get("/api/admin/tags/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const [tag] = await sql`select * from tag where id = ${intParam(c.req.param("id"))}`;
  if (!tag) fail(404, "not_found");
  return c.json(tag);
});

blog.put("/api/admin/tags/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const id = intParam(c.req.param("id"));
  const b = validate<any>(await c.req.json().catch(() => null), TAG_SCHEMA);
  const [tag] = await sql`select id from tag where id = ${id}`;
  if (!tag) fail(404, "not_found");
  const slug = await uniqueSlug(sql, "tag", slugify(b.slug || b.name), id);
  const [row] = await sql`update tag set ${sql({
    name: b.name, description: b.description || null, color: b.color || null, meta_title: b.meta_title || null,
    meta_description: b.meta_description || null, slug,
  })} where id = ${id} returning *`;
  return c.json(row);
});

blog.delete("/api/admin/tags/:id", async (c) => {
  await requireRole(c, "owner", "manager");
  const id = intParam(c.req.param("id"));
  const [tag] = await sql`select id from tag where id = ${id}`;
  if (!tag) fail(404, "not_found");
  await sql.begin(async (db: any) => {
    await db`delete from posttag where tag_id = ${id}`;
    await db`delete from tag where id = ${id}`;
  });
  return c.body(null, 204);
});

export { intParam, intQuery, LIVE };
