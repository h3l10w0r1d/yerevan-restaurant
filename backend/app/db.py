from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from .config import DATABASE_URL as RAW_URL

# Hosted Postgres URLs often use the postgres:// scheme; SQLAlchemy wants a driver name.
DATABASE_URL = RAW_URL.replace("postgres://", "postgresql+psycopg://", 1).replace(
    "postgresql://", "postgresql+psycopg://", 1
)

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Neon's pooled URL goes through PgBouncer; skip server-side prepared statements.
    connect_args = {"prepare_threshold": None}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


# Columns added after the first release. create_all() only creates missing tables,
# so existing databases get these added here (idempotent, SQLite and Postgres).
MIGRATIONS = [
    ("menuitem", "featured", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("menuitem", "badge", "VARCHAR"),
]


def migrate() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, column, ddl in MIGRATIONS:
            if insp.has_table(table) and column not in {c["name"] for c in insp.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def init_db() -> None:
    from .store import seed

    SQLModel.metadata.create_all(engine)
    migrate()
    with Session(engine) as session:
        seed(session)


def get_session():
    # Objects stay readable after commit: emails are logged (and committed) after a
    # booking or order is saved, and the route still returns that booking or order.
    with Session(engine, expire_on_commit=False) as session:
        yield session
