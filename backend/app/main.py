from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .db import init_db
from .routers import admin, auth, blog_admin, blog_public, email_admin, menu_admin, public, seo, settings, team


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Yerevan Restaurant API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (public.router, auth.router, admin.router, menu_admin.router, team.router, settings.router, email_admin.router,
               blog_public.router, blog_admin.router, seo.router):
    app.include_router(router)


# Self-hosted (Docker): serve the built site and admin next to the API, with SPA fallbacks.
if config.STATIC_DIR and Path(config.STATIC_DIR).is_dir():
    static_root = Path(config.STATIC_DIR).resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def site(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "not_found")
        file = (static_root / path).resolve()
        if path and file.is_file() and static_root in file.parents:
            cache = "public, max-age=31536000, immutable" if "/assets/" in f"/{path}" else "public, max-age=3600"
            return FileResponse(file, headers={"Cache-Control": cache})
        if Path(path).suffix and not path.endswith(".html"):
            raise HTTPException(404, "not_found")  # a missing asset, not a page
        page = static_root / ("admin/index.html" if path == "admin" or path.startswith("admin/") else "index.html")
        return FileResponse(page, headers={"Cache-Control": "no-cache"})
