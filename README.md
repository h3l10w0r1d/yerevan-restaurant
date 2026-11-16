# Yerevan restaurant

Website for **Yerevan**, an Armenian restaurant at Kampstraat 22, Hilversum.
Mobile-first and bilingual (English / Nederlands), built from the brandbook: burgundy, night navy, city-light amber, tuff rose, lavash ivory, set in Bodoni Moda and Jost.

- `frontend/`: React + Vite + TypeScript, with the menu, table reservations, takeaway ordering (behind a feature flag) and a staff admin view at `#admin`
- `admin/`: the staff admin panel at `/admin`, built with React, Tailwind and shadcn/ui (Base UI)
- `backend/`: FastAPI + SQLModel (SQLite by default, Postgres via `DATABASE_URL`)

## Admin panel

`/admin` (locally http://localhost:5174/admin) has a left sidebar with:

- **Dashboard**: tonight's bookings, next 7 days, requests to confirm, a 14-day guests chart
- **Reservations**: month calendar (closed days shaded, status colours) with a day agenda, list view, search and status filter; create, edit, confirm, cancel and delete bookings
- **Orders**: takeaway orders through New → Confirmed → Ready → Collected
- **Menu**: categories and dishes in EN/NL, prices, dietary tags, sold-out toggle, ordering, photo upload (resized to WebP in the browser, stored in the database)
- **Team** (owners): add people with a one-time password, change roles, reset passwords, disable or remove access
- **Settings** (owners and managers): restaurant details, opening hours, booking rules, takeaway ordering on/off

**Capacity:** each booking holds its seats for the average table time (default 2 hours). An online booking is accepted only if the number of people seated never exceeds the seats (default 50) at any moment during its stay; staff bookings that go over get a warning.
- **My account**: profile, password, evening (dark) mode
- **Sign-in**: "Forgot password?" emails a reset link; invites email a link to choose a password

### Email

Booking, order and account emails go through Resend, in the guest's language, with a calendar invite on confirmation.
Without `RESEND_API_KEY` they are only logged (Admin → Settings → Recent emails). Setup steps: [docs/EMAIL-SETUP.md](docs/EMAIL-SETUP.md).

Roles: **Owner** (everything), **Manager** (everything except Team), **Staff** (dashboard, reservations, orders).
The first owner is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the database has no users (local default: `admin@yerevanrestaurant.nl` / `change-me`).

## Run locally

```bash
# API → http://localhost:8000 (docs at /docs)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Site → http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install && npm run dev

# Admin → http://localhost:5174/admin
cd admin
npm install && npm run dev
```

Tests: `cd backend && .venv/bin/python -m pytest`

## Content

| What | Where |
| --- | --- |
| Menu, photos, hours, booking rules | Edited in the admin panel and stored in the database. `backend/app/data/menu.json` seeds an empty database and is the site's offline fallback |
| All interface copy | `frontend/src/i18n.tsx` |
| Photos (WebP) | `frontend/public/images/`; dish photos are linked via `image` in `menu.json` |
| Photo credits (shown in the footer) | `frontend/src/credits.json`. Keep this in sync when replacing photos |

## Backend settings

| Env var | Default | Meaning |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin@yerevanrestaurant.nl` | First owner's login, created when there are no users |
| `ADMIN_PASSWORD` | `change-me` (falls back to `ADMIN_TOKEN`) | First owner's password |
| `RESEND_API_KEY` | (empty: emails are logged, not sent) | Resend API key |
| `EMAIL_FROM` | `Yerevan Restaurant <reserveringen@yerevanrestaurant.nl>` | Sender, on a domain verified in Resend |
| `EMAIL_REPLY_TO` | restaurant email from Settings | Where guest replies go |
| `SITE_URL` | `https://www.yerevanrestaurant.nl` | Canonical URLs, sitemap, share previews and links in emails |
| `DATABASE_URL` | `sqlite:///./yerevan.db` | Use Postgres in production |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `ORDERING_ENABLED` | `false` | Default for the takeaway switch (then managed in Settings) |
| `SEATS` | `50` | Default number of seats (then managed in Settings) |
| `DINING_MINUTES` | `120` | Default time a booking keeps its seats (then managed in Settings) |

## SEO

- `robots.txt` is generated at build time (`frontend/vite.config.ts`). `sitemap.xml` is served by the API (`backend/app/routers/seo.py`): the homepage, `/menu` and `/blog` in English and Dutch (`?lang=nl`) with hreflang links, plus every published post and tag.
- Blog pages (`/blog`, `/blog/<slug>`, `/blog/tag/<slug>`) are rendered by the API with their full head (title, description, canonical, Open Graph, X card, `BlogPosting` and breadcrumb structured data) and the article text, so crawlers and link previews never depend on JavaScript. RSS lives at `/blog/rss.xml`.
- Posts are written in the admin under **Blog → Posts**: a Ghost-style editor with cards (image, callout, button, toggle, YouTube…), scheduling, previews, meta data, social cards and an SEO checklist with a focus keyword.
- Titles, descriptions, canonical URLs and share tags follow the page and language (`frontend/src/seo.ts`).
- Restaurant structured data (Schema.org) is in `frontend/index.html`; opening hours are added only after pre-opening ends.
- The public address comes from `SITE_URL` (default `https://www.yerevanrestaurant.nl`). Submit `<SITE_URL>/sitemap.xml` in Google Search Console.

## Deploy

Production runs on free plans: **Cloudflare Pages** for the site and admin, **Supabase Edge Functions** for the API, **Neon Postgres** for data.

- **Site and admin:** `npm run build --prefix frontend && npm run build --prefix admin` (admin builds into `frontend/dist/admin`), then `npx wrangler pages deploy --branch main` (settings in `wrangler.toml`, project `yerevan-restaurant`).
  `functions/_middleware.js` forwards `/api/*`, `/blog*` and `/sitemap.xml` to the API and serves the admin app for `/admin/*`; `frontend/public/_routes.json` limits the function to those paths so everything else is plain static hosting.
- **API:** `supabase/functions/yerevan` is the TypeScript port of the FastAPI app in `backend/app` (same routes, responses and database tables).
  Deploy with `supabase functions deploy yerevan --project-ref atdgpfayarlgdfgclycb --no-verify-jwt --use-api`.
  Secrets (`supabase secrets set`): `DATABASE_URL` (Neon pooled URL), `SITE_URL`, `ADMIN_EMAIL`, optionally `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
  Supabase serves HTML and XML as `text/plain` with a sandboxing CSP on its own domain, so the API also sends the real type in `X-Content-Type` and the Cloudflare function restores it.
- **Domain:** `www.yerevanrestaurant.nl` is a CNAME to `yerevan-restaurant.pages.dev` (DNS at Strato); the bare domain redirects to `www`.

The FastAPI app in `backend/` remains the reference implementation and runs locally or in Docker (`Dockerfile` serves site, admin and API from one container).
Keep both implementations in step when changing the API. `vercel.json` and `api/index.py` are the earlier Vercel setup.

## API

`GET /api/menu` · `GET /api/info` · `GET /api/availability?date=YYYY-MM-DD&guests=N` · `POST /api/reservations` · `POST /api/orders` ·
admin: `GET/PATCH /api/admin/reservations[/{id}]`, `GET/PATCH /api/admin/orders[/{id}]`
