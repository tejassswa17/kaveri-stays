import os
from fastapi.testclient import TestClient
from dotenv import load_dotenv

load_dotenv()

sb_pw = os.environ.get('SUPABASE_PASSWORD')
if not sb_pw:
    print('SUPABASE_PASSWORD not found.')
    exit(0)

# Set DATABASE_URL to Supabase
os.environ['DATABASE_URL'] = f'postgresql://postgres:{sb_pw}@db.ujdvgekijdpzelsebald.supabase.co:5432/postgres?sslmode=require'

# Reset connection pool in database module
import app.database
if app.database._connection_pool:
    app.database._connection_pool.closeall()
    app.database._connection_pool = None

from app.main import app as fastapi_app

client = TestClient(fastapi_app)

print('=== TESTING FASTAPI ENDPOINTS AGAINST SUPABASE DB VIA DATABASE_URL ===')

# 1. Properties
res = client.get('/properties')
print(f'GET /properties: Status={res.status_code}, Properties={len(res.json()["items"])}')
assert res.status_code == 200
assert len(res.json()['items']) == 3

# 2. Login as Owner
res_login = client.post('/auth/login', json={'email': 'owner@example.com', 'password': 'Password123!'})
print(f'POST /auth/login (Owner): Status={res_login.status_code}')
assert res_login.status_code == 200
token = res_login.json()['access_token']

# 3. GET /me
res_me = client.get('/me', headers={'Authorization': f'Bearer {token}'})
print(f'GET /me (Owner): Status={res_me.status_code}, Role={res_me.json()["role"]}')
assert res_me.status_code == 200
assert res_me.json()['role'] == 'owner'

# 4. GET /bookings (Owner sees all 160 bookings)
res_b = client.get('/bookings?limit=10', headers={'Authorization': f'Bearer {token}'})
print(f'GET /bookings (Owner): Status={res_b.status_code}, Total in DB={res_b.json()["meta"]["total"]}')
assert res_b.status_code == 200
assert res_b.json()['meta']['total'] == 160

# Clean up
if app.database._connection_pool:
    app.database._connection_pool.closeall()
    app.database._connection_pool = None
del os.environ['DATABASE_URL']

print('>>> FASTAPI CONNECTIVITY TO SUPABASE VIA DATABASE_URL VERIFIED! <<<')
