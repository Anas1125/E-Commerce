import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to your environment or .env file."
    )

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    # requirements.txt ships psycopg 3, not psycopg2
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

IS_SERVERLESS = bool(os.getenv("VERCEL"))

engine_options: dict = {
    "pool_pre_ping": True,
    "echo": os.getenv("SQL_ECHO", "").lower() in {"1", "true", "yes"},
}

if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
elif IS_SERVERLESS:
    # Each serverless instance is short-lived: don't hold a pool open, and let
    # the database's own pooler (e.g. Neon's "-pooler" host) share connections.
    # prepare_threshold=None keeps psycopg compatible with PgBouncer.
    engine_options["poolclass"] = NullPool
    engine_options["connect_args"] = {"prepare_threshold": None}
else:
    engine_options.update(
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800")),
    )

engine = create_engine(DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise