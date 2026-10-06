from sqlmodel import Session, SQLModel, create_engine

from .config import DATABASE_URL as RAW_URL

# Hosted Postgres URLs often use the postgres:// scheme; SQLAlchemy wants a driver name.
DATABASE_URL = RAW_URL.replace("postgres://", "postgresql+psycopg://", 1).replace(
    "postgresql://", "postgresql+psycopg://", 1
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
