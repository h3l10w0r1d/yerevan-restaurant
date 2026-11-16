// Server-side SEO for /blog: real meta tags and article text in the app shell, plus sitemap and RSS (port of seo.py).
import { Hono, Context } from "npm:hono@4.6.14";
import { config, esc, sql } from "./lib.ts";
import { authorNames, excerpt, LIVE, postTags } from "./blog.ts";

const SITE = config.SITE_URL;
const MIN_TAG_POSTS = 3; // fewer posts than this and a tag page stays out of the index
const COPY: Record<string, Record<string, string>> = {
  en: { blog_title: "Blog · Yerevan, Armenian restaurant in Hilversum",
    blog_desc: "Stories, recipes and news from Yerevan, an Armenian restaurant in the heart of ’t Gooi.", blog: "Blog" },
  nl: { blog_title: "Blog · Yerevan, Armeens restaurant in Hilversum",
    blog_desc: "Verhalen, recepten en nieuws van Yerevan, een Armeens restaurant in het hart van ’t Gooi.", blog: "Blog" },
};

const abs = (url?: string | null) => !url ? null : url.startsWith("http") ? url : url.startsWith("/") ? `${SITE}${url}` : `${SITE}/images/${url}`;
const iso = (ts?: string | null) => (ts ? ts.slice(0, 19) + "Z" : null);

// The built index.html, fetched from the static host and cached for five minutes.
const shell: { html: string | null; at: number; host: string | null } = { html: null, at: 0, host: null };
async function getShell(c: Context) {
  const host = c.req.header("x-site-host") || c.req.header("x-forwarded-host") || new URL(SITE).host;
  if (shell.html && shell.host === host && Date.now() - shell.at < 300e3) return shell.html;
  try {
    const res = await fetch(`https://${host}/`, { headers: { "User-Agent": "yerevan-ssr" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    Object.assign(shell, { html: await res.text(), at: Date.now(), host });
  } catch { /* fall back to the cached copy or a bare page */ }
  return shell.html;
}

const STRIP = [
  /<title>[\s\S]*?<\/title>/g, /<meta name="description"[^>]*>/g, /<link rel="canonical"[^>]*>/g,
  /<link rel="alternate" hreflang=[^>]*>/g, /<meta property="(og|article):[^"]*"[^>]*>/g,
  /<meta name="twitter:[^"]*"[^>]*>/g, /<meta name="robots"[^>]*>/g,
];

function render(c: Context, html0: string | null, head: string, body: string, lang: string, status = 200) {
  let html: string;
  if (html0) {
    html = html0;
    for (const re of STRIP) html = html.replace(re, "");
    html = html.replace("</head>", () => `${head}\n</head>`);
    html = html.replace(/<div id="root">\s*<\/div>/, () => `<div id="root">${body}</div>`);
    html = html.replace(/<html lang="[a-z-]*"/, `<html lang="${lang}"`);
  } else {
    html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
  }
  return c.body(html, status as 200, {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type": "text/html; charset=utf-8", // Supabase rewrites text/html; the Cloudflare proxy restores it from this
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
  });
}

type Meta = {
  title: string; description: string; url: string; image: string | null; og_type?: string; og_title?: string | null;
  og_description?: string | null; tw_title?: string | null; tw_description?: string | null; tw_image?: string | null;
  noindex?: boolean; extra?: string; alternates?: Record<string, string>;
};
function metaTags(m: Meta) {
  const parts = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<meta name="robots" content="${m.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
    `<meta property="og:type" content="${m.og_type || "website"}" />`,
    '<meta property="og:site_name" content="Yerevan" />',
    `<meta property="og:title" content="${esc(m.og_title || m.title)}" />`,
    `<meta property="og:description" content="${esc(m.og_description || m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(m.tw_title || m.og_title || m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.tw_description || m.og_description || m.description)}" />`,
  ];
  if (m.image) parts.push(`<meta property="og:image" content="${esc(m.image)}" />`, '<meta property="og:image:width" content="1200" />');
  if (m.tw_image || m.image) parts.push(`<meta name="twitter:image" content="${esc(m.tw_image || m.image)}" />`);
  for (const [lang, href] of Object.entries(m.alternates || {})) parts.push(`<link rel="alternate" hreflang="${lang}" href="${esc(href)}" />`);
  return parts.join("\n    ") + (m.extra || "");
}

const ld = (data: unknown) => `\n    <script type="application/ld+json">${JSON.stringify(data).replace(/<\//g, "<\\/")}</script>`;
const list = (posts: any[]) => posts.map((p) => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a><p>${esc(excerpt(p))}</p></li>`).join("");
const notFound = (c: Context, html: string | null) =>
  render(c, html, metaTags({ title: "Not found · Yerevan", description: "", url: `${SITE}/blog`, image: null, noindex: true }),
    "<main><h1>Not found</h1></main>", "en", 404);

export const seo = new Hono();

async function blogIndex(c: Context) {
  const lang = c.req.query("lang") === "nl" ? "nl" : "en";
  const t = COPY[lang];
  const posts = await sql`select * from post where ${LIVE()} order by published_at desc limit 24`;
  const url = `${SITE}/blog` + (lang === "nl" ? "?lang=nl" : "");
  let head = metaTags({ title: t.blog_title, description: t.blog_desc, url, image: `${SITE}/og-image.jpg`,
    alternates: { en: `${SITE}/blog`, nl: `${SITE}/blog?lang=nl`, "x-default": `${SITE}/blog` } });
  head += ld({ "@context": "https://schema.org", "@type": "Blog", name: "Yerevan Blog", url: `${SITE}/blog`,
    description: t.blog_desc, publisher: { "@id": `${SITE}/#restaurant` },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: iso(p.published_at) })) });
  return render(c, await getShell(c), head, `<main><h1>${esc(t.blog)}</h1><p>${esc(t.blog_desc)}</p><ul>${list(posts)}</ul></main>`, lang);
}
seo.get("/blog", blogIndex);
seo.get("/blog/", blogIndex);

const rfc822 = (ts: string) => {
  const d = new Date(ts.slice(0, 19) + "Z");
  return d.toUTCString().replace("GMT", "+0000");
};

async function rss(c: Context) {
  const posts = await sql`select * from post where ${LIVE()} order by published_at desc limit 20`;
  const tags = await postTags(posts.map((p) => p.id));
  const items = posts.map((p) => {
    const cats = tags[p.id].map((t) => `<category><![CDATA[${t.name}]]></category>`).join("");
    const image = p.feature_image ? `<media:content url="${esc(abs(p.feature_image))}" medium="image"/>` : "";
    const html = (p.html as string).replace(/(src|href)="\//g, `$1="${SITE}/`).split("]]>").join("]]&gt;");
    return `    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="false">${p.uuid}</guid>
      <pubDate>${rfc822(p.published_at)}</pubDate>
      <description><![CDATA[${excerpt(p)}]]></description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
      ${cats}${image}
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yerevan · Blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(COPY.en.blog_desc)}</description>
    <language>nl</language>
${items.join("\n")}
  </channel>
</rss>
`;
  return c.body(xml, 200, { "Content-Type": "application/rss+xml", "X-Content-Type": "application/rss+xml", "Cache-Control": "public, s-maxage=300" });
}
seo.get("/blog/rss.xml", rss);
seo.get("/api/blog/rss.xml", rss);

seo.get("/blog/tag/:slug", async (c) => {
  const [tag] = await sql`select * from tag where slug = ${c.req.param("slug")}`;
  const html = await getShell(c);
  if (!tag) return notFound(c, html);
  const title = tag.meta_title || `${tag.name} · Blog · Yerevan`;
  const desc = tag.meta_description || tag.description || `Verhalen over ${tag.name} van Yerevan, Armeens restaurant in Hilversum.`;
  const posts = await sql`select * from post where ${LIVE()} and id in (select post_id from posttag where tag_id = ${tag.id})
    order by published_at desc`;
  // Tags with only a post or two make thin pages: keep them out of the index, but let links be followed.
  const head = metaTags({ title, description: desc, url: `${SITE}/blog/tag/${tag.slug}`, image: `${SITE}/og-image.jpg`,
    noindex: posts.length < MIN_TAG_POSTS });
  return render(c, html, head, `<main><h1>${esc(tag.name)}</h1><p>${esc(desc)}</p><ul>${list(posts)}</ul></main>`, "nl");
});

seo.get("/blog/p/:uuid", async (c) => {
  const [post] = await sql`select title from post where uuid = ${c.req.param("uuid")}`;
  const head = metaTags({ title: post ? `Preview: ${post.title}` : "Preview", description: "", url: `${SITE}/blog`, image: null, noindex: true });
  return render(c, await getShell(c), head, "", "en", post ? 200 : 404);
});

seo.get("/blog/:slug", async (c) => {
  const html = await getShell(c);
  const [post] = await sql`select * from post where slug = ${c.req.param("slug")} and ${LIVE()}`;
  if (!post) return notFound(c, html);
  const tags = (await postTags([post.id]))[post.id];
  const author = (await authorNames([post.author_id]))[post.author_id];
  const url = post.canonical_url || `${SITE}/blog/${post.slug}`;
  const description = post.meta_description || excerpt(post);
  const image = abs(post.og_image || post.feature_image) || `${SITE}/og-image.jpg`;
  const articleMeta = `\n    <meta property="article:published_time" content="${iso(post.published_at)}" />` +
    `\n    <meta property="article:modified_time" content="${iso(post.updated_at)}" />` +
    tags.map((t) => `\n    <meta property="article:tag" content="${esc(t.name)}" />`).join("");
  let head = metaTags({
    title: post.meta_title || `${post.title} · Yerevan`, description, url, image, og_type: "article",
    og_title: post.og_title || post.meta_title || post.title, og_description: post.og_description || description,
    tw_title: post.twitter_title, tw_description: post.twitter_description, tw_image: abs(post.twitter_image), extra: articleMeta,
  });
  const crumbs = [{ name: "Home", item: `${SITE}/` }, { name: "Blog", item: `${SITE}/blog` }];
  if (tags.length) crumbs.push({ name: tags[0].name, item: `${SITE}/blog/tag/${tags[0].slug}` });
  crumbs.push({ name: post.title, item: `${SITE}/blog/${post.slug}` });
  head += ld({
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title.slice(0, 110), description, image: [image],
    datePublished: iso(post.published_at), dateModified: iso(post.updated_at), inLanguage: post.language,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: author ? { "@type": "Person", name: author.name } : { "@id": `${SITE}/#restaurant` },
    publisher: { "@type": "Organization", name: "Yerevan", logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` } },
    keywords: tags.map((t) => t.name).join(", ") || null,
    wordCount: (post.plaintext || "").split(/\s+/).filter(Boolean).length,
  });
  head += ld({ "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map((cr, i) => ({ "@type": "ListItem", position: i + 1, name: cr.name, item: cr.item })) });
  const img = post.feature_image
    ? `<figure><img src="${esc(image)}" alt="${esc(post.feature_image_alt || post.title)}" />` +
      (post.feature_image_caption ? `<figcaption>${esc(post.feature_image_caption)}</figcaption>` : "") + "</figure>"
    : "";
  const [y, m, d] = post.published_at.slice(0, 10).split("-");
  const body = `<article><h1>${esc(post.title)}</h1><p>${esc(excerpt(post))}</p>` +
    `<p>${author ? esc(author.name) + " · " : ""}${d}-${m}-${y}</p>${img}${post.html}</article>`;
  return render(c, html, head, body, post.language);
});

async function sitemap(c: Context) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = (loc: string, lastmod: string, freq: string, prio: string, alts?: Record<string, string>) => {
    const links = Object.entries(alts || {}).map(([k, v]) => `\n    <xhtml:link rel="alternate" hreflang="${k}" href="${esc(v)}"/>`).join("");
    return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>${links}\n  </url>`;
  };
  const urls: string[] = [];
  for (const [path, freq, prio] of [["/", "monthly", "1.0"], ["/menu", "weekly", "0.8"], ["/blog", "daily", "0.8"]]) {
    const base = path === "/" ? `${SITE}/` : `${SITE}${path}`;
    const alts = { en: base, nl: `${base}?lang=nl`, "x-default": base };
    urls.push(entry(base, today, freq, prio, alts), entry(`${base}?lang=nl`, today, freq, prio, alts));
  }
  const posts = await sql`select * from post where ${LIVE()} order by published_at desc`;
  for (const p of posts) {
    if (p.canonical_url && !p.canonical_url.startsWith(SITE)) continue; // canonical lives elsewhere
    const last = p.updated_at > p.published_at ? p.updated_at : p.published_at;
    urls.push(entry(`${SITE}/blog/${p.slug}`, last.slice(0, 10), "monthly", "0.7"));
  }
  const used = await postTags(posts.map((p) => p.id));
  const counts: Record<string, number> = {};
  for (const ts of Object.values(used)) for (const t of ts) counts[t.slug] = (counts[t.slug] || 0) + 1;
  for (const slug of Object.keys(counts).filter((s) => counts[s] >= MIN_TAG_POSTS).sort()) {
    urls.push(entry(`${SITE}/blog/tag/${slug}`, today, "weekly", "0.5"));
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.join("\n") + "\n</urlset>\n";
  return c.body(xml, 200, { "Content-Type": "application/xml", "X-Content-Type": "application/xml", "Cache-Control": "public, s-maxage=300" });
}
seo.get("/sitemap.xml", sitemap);
seo.get("/api/sitemap.xml", sitemap);
