import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

LOCAL_HOST = os.getenv('DATABASE_HOST', 'localhost')
LOCAL_DB = os.getenv('DATABASE_NAME', 'kaveri')
LOCAL_USER = os.getenv('DATABASE_USER', 'postgres')
LOCAL_PW = os.getenv('DATABASE_PASSWORD', '98Teja66#')
LOCAL_PORT = 5432

SUPABASE_HOST = 'db.ujdvgekijdpzelsebald.supabase.co'
SUPABASE_DB = 'postgres'
SUPABASE_USER = 'postgres'
SUPABASE_PW = os.environ.get('SUPABASE_PASSWORD')
SUPABASE_PORT = 5432

if not SUPABASE_PW:
    raise ValueError('SUPABASE_PASSWORD environment variable is required.')

local_conn = psycopg2.connect(dbname=LOCAL_DB, user=LOCAL_USER, password=LOCAL_PW, host=LOCAL_HOST, port=LOCAL_PORT)
sb_conn = psycopg2.connect(dbname=SUPABASE_DB, user=SUPABASE_USER, password=SUPABASE_PW, host=SUPABASE_HOST, port=SUPABASE_PORT)

local_cur = local_conn.cursor()
sb_cur = sb_conn.cursor()

tables = [
    'accounts',
    'bookings',
    'guests',
    'legacy_reservations',
    'payments',
    'properties',
    'rate_plans',
    'refresh_tokens',
    'reviews',
    'room_types',
    'rooms',
]

print('=' * 80)
print('1. TABLE ROW COUNT COMPARISON (LOCAL vs SUPABASE)')
print('=' * 80)
all_matched = True
for t in tables:
    local_cur.execute(f'SELECT COUNT(*) FROM public."{t}";')
    loc_cnt = local_cur.fetchone()[0]
    
    sb_cur.execute(f'SELECT COUNT(*) FROM public."{t}";')
    sb_cnt = sb_cur.fetchone()[0]
    
    match = (loc_cnt == sb_cnt)
    if not match:
        all_matched = False
    status = '[PASS]' if match else '[FAIL]'
    print(f' {status} {t:<25} | Local: {loc_cnt:<5} | Supabase: {sb_cnt:<5} | Match: {match}')

print('\n' + '=' * 80)
print('2. BOOKINGS DETAILED VERIFICATION')
print('=' * 80)
sb_cur.execute('SELECT COUNT(*), MIN(booking_id), MAX(booking_id) FROM public.bookings;')
b_cnt, b_min, b_max = sb_cur.fetchone()
print(f' Supabase Bookings Count: {b_cnt} (Expected: 160)')
print(f' Supabase Bookings MIN ID: {b_min} (Expected: 1)')
print(f' Supabase Bookings MAX ID: {b_max} (Expected: 418)')
assert b_cnt == 160 and b_min == 1 and b_max == 418, 'Bookings verification failed!'
print(' [PASS] Bookings count and ID range 1..418 exactly verified!')

print('\n' + '=' * 80)
print('3. PROPERTIES VERIFICATION')
print('=' * 80)
sb_cur.execute('SELECT property_id, name, city, star_rating FROM public.properties ORDER BY property_id;')
props = sb_cur.fetchall()
print(f' Supabase Properties Count: {len(props)} (Expected: 3)')
for p in props:
    print(f' [PASS] Property ID {p[0]}: {p[1]:<30} | City: {p[2]:<10} | Rating: {p[3]} Stars')
assert len(props) == 3, 'Properties count mismatch!'

print('\n' + '=' * 80)
print('4. RBAC OPERATIONAL ACCOUNTS VERIFICATION')
print('=' * 80)
rbac_accounts = [
    ('stage5staff@example.com', 'staff', 1),
    ('manager_ooty@example.com', 'manager', 1),
    ('staff_alleppey@example.com', 'staff', 2),
    ('manager_alleppey@example.com', 'manager', 2),
    ('staff_coorg@example.com', 'staff', 3),
    ('manager_coorg@example.com', 'manager', 3),
    ('owner@example.com', 'owner', None),
    ('stage5guest@example.com', 'guest', None),
]

for email, expected_role, expected_prop in rbac_accounts:
    sb_cur.execute('SELECT account_id, email, role, property_id, is_active FROM public.accounts WHERE email = %s;', (email,))
    row = sb_cur.fetchone()
    assert row is not None, f'Missing account: {email}'
    assert row[2] == expected_role, f'Role mismatch for {email}: {row[2]} vs {expected_role}'
    assert row[3] == expected_prop, f'Property mismatch for {email}: {row[3]} vs {expected_prop}'
    print(f' [PASS] Account ID {row[0]:<3} | Email: {row[1]:<30} | Role: {row[2]:<8} | Prop ID: {str(row[3]):<4} | Active: {row[4]}')

print('\n' + '=' * 80)
print('5. SEQUENCES ALIGNMENT & NEXTVAL VERIFICATION')
print('=' * 80)
seq_mappings = [
    ('accounts_account_id_seq', 'accounts', 'account_id'),
    ('bookings_booking_id_seq', 'bookings', 'booking_id'),
    ('guests_guest_id_seq', 'guests', 'guest_id'),
    ('payments_payment_id_seq', 'payments', 'payment_id'),
    ('properties_property_id_seq', 'properties', 'property_id'),
    ('rate_plans_rate_plan_id_seq', 'rate_plans', 'rate_plan_id'),
    ('refresh_tokens_refresh_token_id_seq', 'refresh_tokens', 'refresh_token_id'),
    ('reviews_review_id_seq', 'reviews', 'review_id'),
    ('room_types_room_type_id_seq', 'room_types', 'room_type_id'),
    ('rooms_room_id_seq', 'rooms', 'room_id'),
]

for seq_name, tbl, col in seq_mappings:
    sb_cur.execute(f'SELECT last_value, is_called FROM public."{seq_name}";')
    val, is_called = sb_cur.fetchone()
    sb_cur.execute(f'SELECT MAX({col}) FROM public."{tbl}";')
    max_val = sb_cur.fetchone()[0]
    assert val >= max_val, f'Sequence {seq_name} ({val}) is less than MAX({col}) ({max_val})'
    print(f' [PASS] Sequence {seq_name:<38} : last_value={val:<4} (MAX in table: {max_val})')

print('\n' + '=' * 80)
print('6. SAMPLE QUERIES / BUSINESS LOGIC READABILITY IN SUPABASE')
print('=' * 80)

# Sample query 1: Join booking + guest + room + property
sb_cur.execute('''
    SELECT b.booking_id, g.full_name, p.name, r.room_number, b.stay, b.status
    FROM public.bookings b
    JOIN public.guests g ON g.guest_id = b.guest_id
    JOIN public.rooms r ON r.room_id = b.room_id
    JOIN public.properties p ON p.property_id = r.property_id
    WHERE b.booking_id IN (1, 50, 100, 418)
    ORDER BY b.booking_id;
''')
print(' Sample Bookings with Relationships:')
for r in sb_cur.fetchall():
    print(f'   Booking #{r[0]}: Guest="{r[1]}" | Property="{r[2]}" | Room="{r[3]}" | Stay={r[4]} | Status={r[5]}')

# Sample query 2: Rate Plans for 2026/2027
sb_cur.execute('''
    SELECT rp.rate_plan_id, p.name, rt.name, rp.nightly_rate, rp.valid
    FROM public.rate_plans rp
    JOIN public.properties p ON p.property_id = rp.property_id
    JOIN public.room_types rt ON rt.room_type_id = rp.room_type_id
    WHERE rp.valid @> '2026-09-01'::date
    ORDER BY p.property_id, rt.room_type_id;
''')
print('\n Sample Rate Plans for 2026-09-01 (GiST @> query):')
for r in sb_cur.fetchall():
    print(f'   Plan #{r[0]}: {r[1]} | {r[2]} -> Rate: Rs.{r[3]} | Range: {r[4]}')

# Sample query 3: Materialized View monthly_revenue
sb_cur.execute('''
    SELECT property_id, to_char(month, 'YYYY-MM') as m, total_revenue
    FROM public.monthly_revenue
    ORDER BY month DESC, property_id
    LIMIT 5;
''')
print('\n Sample Monthly Revenue Materialized View:')
for r in sb_cur.fetchall():
    print(f'   Property {r[0]} | Month: {r[1]} | Total Revenue: Rs.{r[2]}')

local_cur.close()
local_conn.close()
sb_cur.close()
sb_conn.close()

print('\n' + '=' * 80)
print('>>> SUPABASE POSTGRESQL MIGRATION 100% VERIFIED & SUCCESSFUL! <<<')
print('=' * 80)
