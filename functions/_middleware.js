// Cloudflare Pages: the static site and admin are served from frontend/dist; these paths need code.
// - /api/*, /blog*, /sitemap.xml go to the API on Supabase Edge Functions (same origin for the browser).
// - /admin/* page routes get the admin app's index.html (the default SPA fallback is the public site's).
// Which paths reach this function at all is set in frontend/public/_routes.json.
const API = "https://atdgpfayarlgdfgclycb.supabase.co/functions/v1/yerevan";
const CACHEABLE = /^\/(blog(\/.*)?|sitemap\.xml)$/; // public SEO pages: cached briefly at the edge

export async function onRequest({ request, next, env, waitUntil }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (/\.[a-z0-9]+$/i.test(path)) return next(); // a real file
    return env.ASSETS.fetch(new URL("/admin/", url));
  }

  const cache = caches.default;
  const cacheable = request.method === "GET" && CACHEABLE.test(path);
  if (cacheable) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-site-host", url.host); // the API fetches the page shell from here for server-rendered blog pages
  headers.set("x-forwarded-proto", "https");
  headers.set("x-real-ip", request.headers.get("cf-connecting-ip") || "");
  const upstream = await fetch(API + path + url.search, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  const out = new Headers(upstream.headers);
  const real = out.get("x-content-type"); // Supabase serves HTML/XML as text/plain; the API sends the real type here
  if (real) out.set("content-type", real);
  // Supabase also adds a sandboxing CSP (meant for its own domain) and its cookies; neither belongs on our pages.
  for (const h of ["x-content-type", "content-security-policy", "set-cookie", "sb-gateway-version", "sb-project-ref",
    "sb-request-id", "x-served-by", "x-deno-execution-id", "endpoint-load-metrics", "x-envoy-upstream-service-time"]) out.delete(h);
  const res = new Response(upstream.body, { status: upstream.status, headers: out });

  if (cacheable && upstream.status === 200) {
    const copy = res.clone();
    const cached = new Response(copy.body, copy);
    cached.headers.set("Cache-Control", "public, max-age=0, s-maxage=60");
    waitUntil(cache.put(request, cached));
  }
  return res;
}
