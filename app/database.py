import os
from contextlib import contextmanager
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

POOL_MIN = int(os.environ.get("DB_POOL_MIN", "1"))
POOL_MAX = int(os.environ.get("DB_POOL_MAX", "10"))

_connection_pool: pool.ThreadedConnectionPool | None = None


def get_pool() -> pool.ThreadedConnectionPool:
    global _connection_pool
    if _connection_pool is None or _connection_pool.closed:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=POOL_MIN,
            maxconn=POOL_MAX,
            host=os.environ["DATABASE_HOST"],
            database=os.environ["DATABASE_NAME"],
            user=os.environ["DATABASE_USER"],
            password=os.environ["DATABASE_PASSWORD"],
        )
    return _connection_pool


def get_connection():
    """Checkout a connection from the pool."""
    p = get_pool()
    return p.getconn()


def release_connection(conn):
    """Return a connection back to the pool."""
    if _connection_pool is not None and not _connection_pool.closed and conn is not None:
        try:
            _connection_pool.putconn(conn)
        except Exception:
            pass


@contextmanager
def get_db_connection():
    """Context manager for automatic connection acquisition and release."""
    conn = get_connection()
    try:
        yield conn
    finally:
        release_connection(conn)