import time
from datetime import date, timedelta
from decimal import Decimal
import jwt
import psycopg2
import pytest
from fastapi.testclient import TestClient

from app.auth import SECRET_KEY, create_access_token
from app.database import get_connection, release_connection
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def clean_test_data():
    """Clean test bookings for guest 23 before and after tests to ensure idempotency."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM reviews WHERE booking_id IN (SELECT booking_id FROM bookings WHERE guest_id = 23);")
    cur.execute("DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE guest_id = 23);")
    cur.execute("DELETE FROM bookings WHERE guest_id = 23;")
    conn.commit()
    cur.close()
    release_connection(conn)
    yield
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM reviews WHERE booking_id IN (SELECT booking_id FROM bookings WHERE guest_id = 23);")
    cur.execute("DELETE FROM payments WHERE booking_id IN (SELECT booking_id FROM bookings WHERE guest_id = 23);")
    cur.execute("DELETE FROM bookings WHERE guest_id = 23;")
    conn.commit()
    cur.close()
    release_connection(conn)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def tokens(client):
    # Guest login
    r_guest = client.post(
        "/auth/login",
        json={"email": "stage5guest@example.com", "password": "Password123!"},
    )
    assert r_guest.status_code == 200, f"Guest login failed: {r_guest.text}"
    guest_token = r_guest.json()["access_token"]
    guest_refresh = r_guest.json()["refresh_token"]

    # Staff login (Ooty, property 1)
    r_staff = client.post(
        "/auth/login",
        json={"email": "stage5staff@example.com", "password": "Password123!"},
    )
    assert r_staff.status_code == 200, f"Staff login failed: {r_staff.text}"
    staff_token = r_staff.json()["access_token"]

    # Manager login (Ooty, property 1)
    r_mgr_ooty = client.post(
        "/auth/login",
        json={"email": "manager_ooty@example.com", "password": "Password123!"},
    )
    assert r_mgr_ooty.status_code == 200, f"Manager Ooty login failed: {r_mgr_ooty.text}"
    mgr_ooty_token = r_mgr_ooty.json()["access_token"]

    # Manager login (Coorg, property 3)
    r_mgr_coorg = client.post(
        "/auth/login",
        json={"email": "manager_coorg@example.com", "password": "Password123!"},
    )
    assert r_mgr_coorg.status_code == 200, f"Manager Coorg login failed: {r_mgr_coorg.text}"
    mgr_coorg_token = r_mgr_coorg.json()["access_token"]

    # Owner login
    r_owner = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "Password123!"},
    )
    assert r_owner.status_code == 200, f"Owner login failed: {r_owner.text}"
    owner_token = r_owner.json()["access_token"]

    return {
        "guest": guest_token,
        "guest_refresh": guest_refresh,
        "staff": staff_token,
        "manager_ooty": mgr_ooty_token,
        "manager_coorg": mgr_coorg_token,
        "owner": owner_token,
    }


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# STAGE 5 TESTS: Writes & Transactions
# ==============================================================================

def test_5_1_create_booking_atomic(client, tokens):
    """5.1: Create booking as an atomic transaction with rate calculation."""
    payload = {
        "room_id": 1,
        "check_in": "2025-06-01",
        "check_out": "2025-06-05",
        "guests": 2,
        "deposit": "4500.00",
    }
    r = client.post(
        "/bookings",
        json=payload,
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "confirmed"
    assert data["room_id"] == 1
    assert data["guests"] == 2
    assert Decimal(data["total_amount"]) > 0


def test_5_2_exclusion_constraint_double_booking(client, tokens):
    """5.2: Exclusion constraint catches overlapping dates and returns 409 without leaking guest info."""
    payload = {
        "room_id": 1,
        "check_in": "2025-06-03",
        "check_out": "2025-06-07",
        "guests": 2,
    }
    r = client.post(
        "/bookings",
        json=payload,
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 409, r.text
    data = r.json()
    assert data["error"] == "DATABASE_ERROR"
    assert data["message"] == "Room is already taken"


def test_5_4_state_machine_transitions(client, tokens):
    """5.4 & 5.5: Booking state machine legal and illegal transitions."""
    # Create booking in Property 1 (Room 4)
    r = client.post(
        "/bookings",
        json={
            "room_id": 4,
            "check_in": "2025-06-10",
            "check_out": "2025-06-14",
            "guests": 2,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]

    # Illegal transition: confirmed -> checked_out directly (must fail with 409)
    r_illegal = client.post(
        f"/bookings/{booking_id}/check-out",
        headers=auth_headers(tokens["staff"]),
    )
    assert r_illegal.status_code == 409, r_illegal.text

    # Legal transition: confirmed -> checked_in (staff only)
    r_checkin = client.post(
        f"/bookings/{booking_id}/check-in",
        headers=auth_headers(tokens["staff"]),
    )
    assert r_checkin.status_code == 200, r_checkin.text
    assert r_checkin.json()["status"] == "checked_in"

    # Legal transition: checked_in -> checked_out (staff only)
    r_checkout = client.post(
        f"/bookings/{booking_id}/check-out",
        headers=auth_headers(tokens["staff"]),
    )
    assert r_checkout.status_code == 200, r_checkout.text
    assert r_checkout.json()["status"] == "checked_out"


def test_5_6_payment_idempotency_and_installments(client, tokens):
    """5.6: Payments with Idempotency-Key support replays and detect conflicts."""
    # Create booking in Property 1 (Room 135)
    r = client.post(
        "/bookings",
        json={
            "room_id": 135,
            "check_in": "2025-06-15",
            "check_out": "2025-06-19",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]
    idempotency_key = f"test-idemp-{booking_id}-{int(time.time())}"

    # First payment
    r_pay1 = client.post(
        f"/bookings/{booking_id}/payments",
        json={"amount": "1000.00", "method": "card"},
        headers={
            **auth_headers(tokens["guest"]),
            "Idempotency-Key": idempotency_key,
        },
    )
    assert r_pay1.status_code == 201, r_pay1.text
    pay1_id = r_pay1.json()["payment_id"]

    # Replay same request -> Returns 200 with same payment_id
    r_replay = client.post(
        f"/bookings/{booking_id}/payments",
        json={"amount": "1000.00", "method": "card"},
        headers={
            **auth_headers(tokens["guest"]),
            "Idempotency-Key": idempotency_key,
        },
    )
    assert r_replay.status_code == 200, r_replay.text
    assert r_replay.json()["payment_id"] == pay1_id

    # Reused key with different payload -> Returns 409 Conflict
    r_conflict = client.post(
        f"/bookings/{booking_id}/payments",
        json={"amount": "2000.00", "method": "card"},
        headers={
            **auth_headers(tokens["guest"]),
            "Idempotency-Key": idempotency_key,
        },
    )
    assert r_conflict.status_code == 409, r_conflict.text


def test_5_7_payments_exceeding_total_refused(client, tokens):
    """5.7: Payments exceeding booking total are refused with 409."""
    r = client.post(
        "/bookings",
        json={
            "room_id": 136,
            "check_in": "2025-07-01",
            "check_out": "2025-07-03",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]
    total = Decimal(r.json()["total_amount"])

    # Overpay
    r_overpay = client.post(
        f"/bookings/{booking_id}/payments",
        json={"amount": str(total + Decimal("50000.00")), "method": "card"},
        headers={
            **auth_headers(tokens["guest"]),
            "Idempotency-Key": f"overpay-{booking_id}",
        },
    )
    assert r_overpay.status_code == 409, r_overpay.text


def test_5_8_reviews_after_checkout_only_and_once(client, tokens):
    """5.8: Reviews allowed only after checkout, and only once per booking."""
    # Create booking in Property 1 (Room 7)
    r = client.post(
        "/bookings",
        json={
            "room_id": 7,
            "check_in": "2025-07-05",
            "check_out": "2025-07-08",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]

    # Review while confirmed -> Refused with 403
    r_rev_early = client.post(
        f"/bookings/{booking_id}/review",
        json={"rating": 5, "comment": "Great!"},
        headers=auth_headers(tokens["guest"]),
    )
    assert r_rev_early.status_code == 403, r_rev_early.text

    # Check-in and check-out
    client.post(f"/bookings/{booking_id}/check-in", headers=auth_headers(tokens["staff"]))
    client.post(f"/bookings/{booking_id}/check-out", headers=auth_headers(tokens["staff"]))

    # Review after checkout -> 201 Created
    r_rev_ok = client.post(
        f"/bookings/{booking_id}/review",
        json={"rating": 5, "comment": "Excellent stay!"},
        headers=auth_headers(tokens["guest"]),
    )
    assert r_rev_ok.status_code == 201, r_rev_ok.text

    # Second review on same booking -> Refused with 409 Conflict
    r_rev_dup = client.post(
        f"/bookings/{booking_id}/review",
        json={"rating": 4, "comment": "Duplicate review"},
        headers=auth_headers(tokens["guest"]),
    )
    assert r_rev_dup.status_code == 409, r_rev_dup.text


def test_5_10_christmas_rate_crossing(client, tokens):
    """5.10: Booking crossing into Christmas/peak period charges correct multi-rate total."""
    # Regular rate until Dec 20 (7500/night for Suite Room 14), Peak rate starting Dec 20 (12000/night)
    # Dec 18 to Dec 22 (4 nights): 2 nights @ 7500 + 2 nights @ 12000 = 15000 + 24000 = 39000.00
    r = client.post(
        "/bookings",
        json={
            "room_id": 14,
            "check_in": "2025-12-18",
            "check_out": "2025-12-22",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    total = Decimal(r.json()["total_amount"])
    assert total == Decimal("39000.00"), f"Expected 39000.00 for Christmas rate crossing, got {total}"



# ==============================================================================
# STAGE 8 TESTS: Negative / Attack Suite (8.1 - 8.14)
# ==============================================================================

def test_8_1_idor_guest_a_requests_guest_b_booking(client, tokens):
    """8.1: Guest A requests Guest B's booking by ID -> 404 (does not leak existence)."""
    # Booking 1 belongs to another guest in seed
    r = client.get("/bookings/1", headers=auth_headers(tokens["guest"]))
    assert r.status_code == 404, r.text


def test_8_2_register_with_owner_role(client):
    """8.2: Register with 'role': 'owner' is rejected or forced to guest."""
    r = client.post(
        "/auth/register",
        json={
            "full_name": "Attacker",
            "email": f"hacker_{int(time.time())}@example.com",
            "password": "Password123!",
            "role": "owner",
        },
    )
    assert r.status_code == 422, r.text


def test_8_3_token_algorithm_none(client):
    """8.3: Token with algorithm 'none' is refused (401)."""
    token_none = jwt.encode({"sub": "1", "role": "owner"}, key="", algorithm="none")
    r = client.get("/me", headers={"Authorization": f"Bearer {token_none}"})
    assert r.status_code == 401, r.text


def test_8_4_token_signed_with_wrong_secret(client):
    """8.4: Token signed with wrong secret is refused (401)."""
    fake_token = jwt.encode({"sub": "1", "role": "owner"}, "wrong_secret_key_12345678901234567890", algorithm="HS256")
    r = client.get("/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert r.status_code == 401, r.text


def test_8_5_expired_access_token(client):
    """8.5: Expired access token is refused (401)."""
    expired_payload = {
        "sub": "1",
        "role": "guest",
        "iat": time.time() - 3600,
        "exp": time.time() - 1800,
    }
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm="HS256")
    r = client.get("/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert r.status_code == 401, r.text


def test_8_6_reuse_rotated_refresh_token(client, tokens):
    """8.6: Reusing a rotated refresh token is refused (401)."""
    old_refresh = tokens["guest_refresh"]
    # Rotate once
    r_rot = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert r_rot.status_code == 200, r_rot.text

    # Attempt reuse
    r_reuse = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert r_reuse.status_code == 401, r_reuse.text


def test_8_7_ooty_manager_reads_coorg_report(client, tokens):
    """8.7: Ooty manager requests Coorg report -> Refused with 403."""
    r = client.get(
        "/reports/occupancy?property_id=3&from=2025-01-01&to=2025-04-01",
        headers=auth_headers(tokens["manager_ooty"]),
    )
    assert r.status_code == 403, r.text


def test_8_8_booking_with_client_nightly_rate(client, tokens):
    """8.8: Create booking with nightly_rate supplied in body is rejected (422)."""
    payload = {
        "room_id": 128,
        "check_in": "2025-08-01",
        "check_out": "2025-08-05",
        "guests": 1,
        "nightly_rate": "1.00",
    }
    r = client.post("/bookings", json=payload, headers=auth_headers(tokens["guest"]))
    assert r.status_code == 422, r.text


def test_8_9_review_while_checked_in(client, tokens):
    """8.9: Review while checked in is refused (403)."""
    # Create booking in Property 1 (Room 129)
    r = client.post(
        "/bookings",
        json={
            "room_id": 129,
            "check_in": "2025-08-10",
            "check_out": "2025-08-14",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]
    client.post(f"/bookings/{booking_id}/check-in", headers=auth_headers(tokens["staff"]))

    r_rev = client.post(
        f"/bookings/{booking_id}/review",
        json={"rating": 5, "comment": "Still staying here"},
        headers=auth_headers(tokens["guest"]),
    )
    assert r_rev.status_code == 403, r_rev.text


def test_8_11_sql_injection_sort_and_filters(client, tokens):
    """8.11: SQL injection through sort and filter parameters is refused."""
    # SQL injection in sort
    r_sort = client.get(
        "/bookings?sort=check_in;DROP TABLE bookings;--",
        headers=auth_headers(tokens["staff"]),
    )
    assert r_sort.status_code == 422, r_sort.text

    # SQL injection in filter
    r_filter = client.get(
        "/guests?email=' OR '1'='1",
        headers=auth_headers(tokens["staff"]),
    )
    assert r_filter.status_code == 200, r_filter.text
    # Parameterized query returns 0 items for literal non-existent email
    assert len(r_filter.json()["items"]) == 0


def test_8_12_guest_count_exceeds_room_capacity(client, tokens):
    """8.12: Sending guest count exceeding room capacity is refused with 422."""
    r = client.post(
        "/bookings",
        json={
            "room_id": 1,  # max_occupancy is 2
            "check_in": "2025-09-01",
            "check_out": "2025-09-05",
            "guests": 4,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 422, r.text
    assert "exceeds" in r.text.lower()


def test_8_13_login_rate_limiting(client):
    """8.13: Multiple rapid login attempts trigger 429 Too Many Requests."""
    target_email = "ratelimit_test@example.com"
    hit_429 = False
    for i in range(15):
        r = client.post("/auth/login", json={"email": target_email, "password": "WrongPassword!"})
        if r.status_code == 429:
            hit_429 = True
            break
    assert hit_429, "Rate limiter did not trigger 429 status code"


def test_8_14_email_enumeration_protection(client):
    """8.14: Login response for non-existent email vs wrong password is identical (401)."""
    r_nonexistent = client.post(
        "/auth/login",
        json={"email": "nonexistent_email_12345@example.com", "password": "Password123!"},
    )
    r_wrongpw = client.post(
        "/auth/login",
        json={"email": "stage5guest@example.com", "password": "WrongPassword123!"},
    )
    assert r_nonexistent.status_code == 401
    assert r_wrongpw.status_code == 401
    assert r_nonexistent.json()["message"] == r_wrongpw.json()["message"]


# ==============================================================================
# MUST SUCCEED TESTS (8.15 - 8.18)
# ==============================================================================

def test_8_15_same_day_turnover(client, tokens):
    """8.15: Guest A checks out on the 5th and Guest B checks into the same room on the 5th."""
    # Guest A: Sept 1 to Sept 5 (Room 130)
    r1 = client.post(
        "/bookings",
        json={
            "room_id": 130,
            "check_in": "2025-09-01",
            "check_out": "2025-09-05",
            "guests": 2,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r1.status_code == 201, r1.text

    # Guest B: Sept 5 to Sept 10 (Same room, same-day boundary turnover)
    r2 = client.post(
        "/bookings",
        json={
            "room_id": 130,
            "check_in": "2025-09-05",
            "check_out": "2025-09-10",
            "guests": 2,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r2.status_code == 201, r2.text


def test_8_16_book_cancelled_stay_dates(client, tokens):
    """8.16: A cancelled booking for June 1-5 allows another guest to book June 2-6."""
    # Create and cancel (Room 131)
    r1 = client.post(
        "/bookings",
        json={
            "room_id": 131,
            "check_in": "2025-06-01",
            "check_out": "2025-06-05",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r1.status_code == 201, r1.text
    b1_id = r1.json()["booking_id"]
    client.post(f"/bookings/{b1_id}/cancel", headers=auth_headers(tokens["guest"]))

    # Second guest books overlapping dates
    r2 = client.post(
        "/bookings",
        json={
            "room_id": 131,
            "check_in": "2025-06-02",
            "check_out": "2025-06-06",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r2.status_code == 201, r2.text


def test_8_17_multiple_part_payments(client, tokens):
    """8.17: One booking receives three separate part-payments."""
    r = client.post(
        "/bookings",
        json={
            "room_id": 132,
            "check_in": "2025-06-20",
            "check_out": "2025-06-24",
            "guests": 1,
        },
        headers=auth_headers(tokens["guest"]),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["booking_id"]


    for i in range(1, 4):
        rp = client.post(
            f"/bookings/{booking_id}/payments",
            json={"amount": "500.00", "method": "card"},
            headers={
                **auth_headers(tokens["guest"]),
                "Idempotency-Key": f"part-pay-{booking_id}-{i}",
            },
        )
        assert rp.status_code == 201, rp.text

    # List payments and verify count
    r_list = client.get(f"/bookings/{booking_id}/payments", headers=auth_headers(tokens["guest"]))
    assert r_list.status_code == 200
    assert len(r_list.json()["items"]) == 3
    assert Decimal(r_list.json()["total_paid"]) == Decimal("1500.00")


def test_8_18_simultaneous_bookings_across_three_properties(client, tokens):
    """8.18: One guest holds bookings at all three properties simultaneously."""
    # Property 1 (Room 1, Ooty), Property 2 (Room 3, Alleppey), Property 3 (Room 2, Coorg)
    dates = ("2025-11-15", "2025-11-20")
    r1 = client.post(
        "/bookings",
        json={"room_id": 1, "check_in": dates[0], "check_out": dates[1], "guests": 1},
        headers=auth_headers(tokens["guest"]),
    )
    assert r1.status_code == 201, r1.text

    r2 = client.post(
        "/bookings",
        json={"room_id": 3, "check_in": dates[0], "check_out": dates[1], "guests": 1},
        headers=auth_headers(tokens["guest"]),
    )
    assert r2.status_code == 201, r2.text

    r3 = client.post(
        "/bookings",
        json={"room_id": 2, "check_in": dates[0], "check_out": dates[1], "guests": 1},
        headers=auth_headers(tokens["guest"]),
    )
    assert r3.status_code == 201, r3.text
