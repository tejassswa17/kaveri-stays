import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

# Test 1: Local DB with discrete environment variables
print('=== TEST 1: Local connection with discrete variables ===')
local_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=5,
    host=os.getenv('DATABASE_HOST', 'localhost'),
    database=os.getenv('DATABASE_NAME', 'kaveri'),
    user=os.getenv('DATABASE_USER', 'postgres'),
    password=os.getenv('DATABASE_PASSWORD', '98Teja66#'),
    port=int(os.getenv('DATABASE_PORT', '5432')),
)
conn = local_pool.getconn()
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM bookings;')
print('Local Bookings Count:', cur.fetchone()[0])
cur.close()
local_pool.putconn(conn)
local_pool.closeall()
print(' [PASS] Local connection successful')

# Test 2: Supabase with DATABASE_URL
sb_pw = os.environ.get('SUPABASE_PASSWORD')
if sb_pw:
    print('\n=== TEST 2: Supabase connection with DATABASE_URL ===')
    db_url = f'postgresql://postgres:{sb_pw}@db.ujdvgekijdpzelsebald.supabase.co:5432/postgres?sslmode=require'
    sb_pool = pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        dsn=db_url,
        options='-c search_path=public,extensions'
    )
    conn = sb_pool.getconn()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM bookings;')
    print('Supabase Bookings Count:', cur.fetchone()[0])
    cur.close()
    sb_pool.putconn(conn)
    sb_pool.closeall()
    print(' [PASS] Supabase connection via DATABASE_URL successful')
