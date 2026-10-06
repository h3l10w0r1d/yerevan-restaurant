# Yerevan restaurant

Website for **Yerevan**, an Armenian restaurant at Kampstraat 22, Hilversum.
Mobile-first and bilingual (English / Nederlands), built from the brandbook: burgundy, night navy, city-light amber, tuff rose, lavash ivory, set in Bodoni Moda and Jost.

- `frontend/`: React + Vite + TypeScript, with the menu, table reservations, takeaway ordering (behind a feature flag) and a staff admin view at `#admin`
- `backend/`: FastAPI + SQLModel (SQLite by default, Postgres via `DATABASE_URL`)

## Two styles

The site ships with two looks over the same content and features, switchable from the header:

- **Classic**: burgundy hero, product-card menu, pinned horizontal gallery
- **Magazine**: editorial masthead, numbered menu with a sticky plate preview, asymmetric figure spread

The choice is remembered per visitor; link to a specific one with `?style=classic` or `?style=editorial`.
Editorial-only components live in `frontend/src/components/editorial/` and their styles in `frontend/src/editorial.css` (scoped to `[data-style='editorial']`).

## Run locally

```bash
# API → http://localhost:8000 (docs at /docs)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# Site → http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install && npm run dev
```

Tests: `cd backend && .venv/bin/python -m pytest`

## Content

| What | Where |
| --- | --- |
| Menu (EN/NL, prices in cents) | `backend/app/data/menu.json`. The site also bundles it as an offline fallback |
| Opening hours, slot capacity | `backend/app/config.py` and `frontend/src/restaurant.ts` |
| All interface copy | `frontend/src/i18n.tsx` |
| Photos (WebP) | `frontend/public/images/`; dish photos are linked via `image` in `menu.json` |
| Photo credits (shown in the footer) | `frontend/src/credits.json`. Keep this in sync when replacing photos |

## Backend settings

| Env var | Default | Meaning |
| --- | --- | --- |
| `ADMIN_TOKEN` | `change-me` | Token for the `#admin` page (`X-Admin-Token` header) |
| `DATABASE_URL` | `sqlite:///./yerevan.db` | Use Postgres in production |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `ORDERING_ENABLED` | `false` | Turns on takeaway ordering (cart + `POST /api/orders`) |
| `SLOT_CAPACITY` | `40` | Guests per 30-minute slot |

## Deploy

**Vercel (primary):** https://yerevan-restaurant.vercel.app serves the site and the API from one project.
`vercel.json` builds `frontend/` as static files and runs the FastAPI app as a Python function (`api/index.py`) under `/api`.
The GitHub repo is connected, so every push to `main` deploys. Environment variables: `ADMIN_TOKEN`, `ORDERING_ENABLED`, and `DATABASE_URL`.
Without `DATABASE_URL` the API falls back to SQLite in `/tmp`, which does **not** persist between serverless instances. Attach Postgres (e.g. Neon from the Vercel Marketplace) before taking real bookings.


- **Site:** GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`.
- **API:** Render, via the `render.yaml` blueprint (or any Docker host using `backend/Dockerfile`). After it is live, set the repository variable `API_URL` to its URL (Settings → Secrets and variables → Actions → Variables) and re-run the Pages workflow.

Until the API is connected, the site shows the bundled menu, and reservation requests fall back to a pre-filled email to info@yerevanrestaurant.nl.

## API

`GET /api/menu` · `GET /api/info` · `GET /api/availability?date=YYYY-MM-DD&guests=N` · `POST /api/reservations` · `POST /api/orders` ·
admin: `GET/PATCH /api/admin/reservations[/{id}]`, `GET/PATCH /api/admin/orders[/{id}]`
