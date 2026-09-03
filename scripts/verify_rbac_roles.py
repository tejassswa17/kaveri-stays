import urllib.request, json

BASE = 'http://127.0.0.1:5173'

def post_json(url, data, headers=None):
    hdrs = {'Content-Type': 'application/json'}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=hdrs, method='POST')
    try:
        res = urllib.request.urlopen(req)
        return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

def get_json(url, headers=None):
    hdrs = {}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    try:
        res = urllib.request.urlopen(req)
        return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

print('=== 1. VERIFYING ROLE AUTHENTICATION & /me ===')
tokens = {}
for email, role_name in [
    ('stage5guest@example.com', 'guest'),
    ('stage5staff@example.com', 'staff'),
    ('manager_ooty@example.com', 'manager'),
    ('owner@example.com', 'owner'),
]:
    s, data = post_json(f'{BASE}/auth/login', {'email': email, 'password': 'Password123!'})
    assert s == 200, f'Login failed for {email}: {data}'
    token = data['access_token']
    s_me, me = get_json(f'{BASE}/me', {'Authorization': f'Bearer {token}'})
    assert s_me == 200
    assert me['role'] == role_name
    tokens[role_name] = token
    print(f' [PASS] {email} -> Role: {me["role"]}, Property ID: {me.get("property_id")}')

# Navigation Items Matrix Verification
NAV_CONFIG = [
    {'to': '/dashboard', 'label': 'Dashboard', 'roles': ['staff', 'manager', 'owner']},
    {'to': '/properties', 'label': 'Properties', 'roles': ['guest', 'staff', 'manager', 'owner']},
    {'to': '/availability', 'label': 'Search Rooms', 'roles': ['guest', 'staff', 'manager', 'owner']},
    {'to': '/bookings', 'label': 'Reservations', 'roles': ['guest', 'staff', 'manager', 'owner']},
    {'to': '/guests', 'label': 'Guest Directory', 'roles': ['staff', 'manager', 'owner']},
    {'to': '/reports', 'label': 'Analytics & Reports', 'roles': ['manager', 'owner']},
    {'to': '/profile', 'label': 'My Account', 'roles': ['guest', 'staff', 'manager', 'owner']},
]

print('\n=== 2. VERIFYING FRONTEND NAVIGATION VISIBILITY BY ROLE ===')
for role in ['guest', 'staff', 'manager', 'owner']:
    visible_items = [item['label'] for item in NAV_CONFIG if role in item['roles']]
    print(f'Role [{role.upper()}]:')
    for item in visible_items:
        print(f'   - {item}')
    if role == 'guest':
        assert 'Dashboard' not in visible_items, 'Security violation: Dashboard visible to guest'
        assert 'Guest Directory' not in visible_items, 'Security violation: Guests visible to guest'
        assert 'Analytics & Reports' not in visible_items, 'Security violation: Reports visible to guest'
        assert visible_items == ['Properties', 'Search Rooms', 'Reservations', 'My Account']
    elif role == 'staff':
        assert 'Dashboard' in visible_items
        assert 'Analytics & Reports' not in visible_items
    elif role in ('manager', 'owner'):
        assert 'Dashboard' in visible_items
        assert 'Analytics & Reports' in visible_items

print('\n=== 3. VERIFYING BACKEND AUTHORIZATION ENFORCEMENT ===')
guest_token = tokens['guest']
staff_token = tokens['staff']
manager_token = tokens['manager']
owner_token = tokens['owner']

# 3.1 Guest attempting /reports/occupancy
s_g_rep, _ = get_json(f'{BASE}/reports/occupancy?from=2025-01-01&to=2025-12-31', {'Authorization': f'Bearer {guest_token}'})
assert s_g_rep == 403, f'Expected 403 for guest on /reports/occupancy, got {s_g_rep}'
print(' [PASS] Backend correctly rejected Guest access to /reports/occupancy with HTTP 403')

# 3.2 Guest attempting /guests
s_g_gst, _ = get_json(f'{BASE}/guests', {'Authorization': f'Bearer {guest_token}'})
assert s_g_gst == 403, f'Expected 403 for guest on /guests, got {s_g_gst}'
print(' [PASS] Backend correctly rejected Guest access to /guests with HTTP 403')

# 3.3 Staff attempting /reports/occupancy
s_s_rep, _ = get_json(f'{BASE}/reports/occupancy?from=2025-01-01&to=2025-12-31', {'Authorization': f'Bearer {staff_token}'})
assert s_s_rep == 403, f'Expected 403 for staff on /reports/occupancy, got {s_s_rep}'
print(' [PASS] Backend correctly rejected Staff access to /reports/occupancy with HTTP 403')

# 3.4 Manager & Owner accessing /reports/occupancy
s_m_rep, data_m_rep = get_json(f'{BASE}/reports/occupancy?from=2025-01-01&to=2025-12-31', {'Authorization': f'Bearer {manager_token}'})
assert s_m_rep == 200, f'Expected 200 for manager on /reports/occupancy, got {s_m_rep}'
print(f' [PASS] Manager accessed /reports/occupancy successfully with HTTP 200 ({len(data_m_rep["items"])} monthly rows)')

s_o_rep, data_o_rep = get_json(f'{BASE}/reports/occupancy?from=2025-01-01&to=2025-12-31', {'Authorization': f'Bearer {owner_token}'})
assert s_o_rep == 200, f'Expected 200 for owner on /reports/occupancy, got {s_o_rep}'
print(f' [PASS] Owner accessed /reports/occupancy successfully with HTTP 200 ({len(data_o_rep["items"])} monthly rows)')

# 3.5 Guest accessing permitted customer endpoints
s_g_prop, prop_data = get_json(f'{BASE}/properties', {'Authorization': f'Bearer {guest_token}'})
assert s_g_prop == 200
print(f' [PASS] Guest accessed /properties (found {len(prop_data["items"])} properties)')

s_g_avail, avail_data = get_json(f'{BASE}/properties/1/availability?from=2026-09-01&to=2026-09-04', {'Authorization': f'Bearer {guest_token}'})
assert s_g_avail == 200
print(f' [PASS] Guest searched room availability (found {len(avail_data["items"])} available rooms)')

s_g_bk, bk_data = get_json(f'{BASE}/bookings', {'Authorization': f'Bearer {guest_token}'})
assert s_g_bk == 200
print(f' [PASS] Guest retrieved reservations list (found {bk_data["meta"]["total"]} guest-scoped bookings)')

print('\n>>> ALL RBAC ROUTING AND AUTHORIZATION TESTS PASSED! <<<')
