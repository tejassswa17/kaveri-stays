from collections import defaultdict
from decimal import Decimal, InvalidOperation
import os
import time

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg2 import Error as PsycopgError
from psycopg2.pool import PoolError

from app.auth import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_refresh_token,
)
from app.database import get_connection, release_connection
from app.dependencies import get_current_user
from app.models import (
    AuthMeResponse,
    BookingRequest,
    BookingResponse,
    ErrorEnvelope,
    HomeResponse,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    LogoutResponse,
    PaymentListResponse,
    PaymentRequest,
    PaymentResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
    ReviewRequest,
    ReviewResponse,
)
from app.read_api import router as read_router


app = FastAPI(
    title="Kaveri Stays API",
    version="0.1.0",
    description="FastAPI hotel management API for Kaveri Stays",
)

ALLOWED_ORIGINS = [
    "https://kaveri-stays-1.onrender.com",
    "https://kaveri-stays-2.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_origins_env = os.environ.get("CORS_ALLOWED_ORIGINS")
if cors_origins_env:
    for origin in cors_origins_env.split(","):
        o = origin.strip()
        if o and o not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# =========================================================
# RATE LIMITING (Task 9.3)
# =========================================================

_login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_RATE_LIMIT = 10  # Max 10 attempts per minute
LOGIN_WINDOW_SECONDS = 60


def check_login_rate_limit(key: str):
    now = time.time()
    attempts = [t for t in _login_attempts[key] if now - t < LOGIN_WINDOW_SECONDS]
    if len(attempts) >= LOGIN_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(LOGIN_WINDOW_SECONDS)},
        )
    attempts.append(now)
    _login_attempts[key] = attempts


# =========================================================
# DATABASE ERROR MAPPING & UNIFIED ERROR HANDLERS (Task 3.10 & 5.3)
# =========================================================

SQLSTATE_STATUS = {
    "23P01": 409,  # exclusion constraint
    "23505": 409,  # unique constraint
    "23503": 404,  # foreign-key constraint
    "23514": 422,  # check constraint
    "23502": 422,  # NOT NULL constraint
}


@app.exception_handler(PsycopgError)
async def database_error_handler(request: Request, exc: PsycopgError):
    constraint = getattr(
        exc.diag,
        "constraint_name",
        None,
    )

    if constraint == "no_overlapping_room_bookings":
        message = "Room is already taken"
    elif constraint == "reviews_booking_id_key":
        message = "Booking already has a review"
    elif constraint == "chk_payment_amount":
        message = "Payment amount must be greater than zero"
    elif constraint == "chk_review_rating":
        message = "Rating must be between 1 and 5"
    elif constraint == "fk_bookings_guest":
        message = "Guest not found"
    elif constraint == "fk_bookings_room":
        message = "Room not found"
    elif constraint == "fk_payments_booking":
        message = "Booking not found"
    else:
        message = "Database operation failed"

    status_code = SQLSTATE_STATUS.get(exc.pgcode, 500)
    return JSONResponse(
        status_code=status_code,
        content={
            "error": "DATABASE_ERROR",
            "message": message,
            "details": [],
        },
    )


@app.exception_handler(PoolError)
async def pool_error_handler(request: Request, exc: PoolError):
    return JSONResponse(
        status_code=503,
        content={
            "error": "SERVICE_UNAVAILABLE",
            "message": "Connection pool exhausted",
            "details": [],
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = getattr(exc, "headers", None)
    error_code = "UNAUTHORIZED" if exc.status_code == 401 else (
        "FORBIDDEN" if exc.status_code == 403 else (
            "NOT_FOUND" if exc.status_code == 404 else (
                "CONFLICT" if exc.status_code == 409 else (
                    "UNPROCESSABLE_ENTITY" if exc.status_code == 422 else (
                        "RATE_LIMITED" if exc.status_code == 429 else "HTTP_ERROR"
                    )
                )
            )
        )
    )
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={
            "error": error_code,
            "message": str(exc.detail),
            "details": [],
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = []
    for err in exc.errors():
        details.append({
            "loc": list(err.get("loc", [])),
            "msg": str(err.get("msg", "")),
            "type": str(err.get("type", "validation_error")),
        })
    return JSONResponse(
        status_code=422,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Validation failed",
            "details": details,
        },
    )


# =========================================================
# HOME
# =========================================================

@app.get(
    "/",
    response_model=HomeResponse,
    tags=["Home"],
    summary="Home / Health Check",
    description="Returns the running status of the Kaveri Stays API.",
)
def home():
    return {
        "message": "Kaveri Stays API is running"
    }


# =========================================================
# AUTHENTICATION
# =========================================================

@app.post(
    "/auth/register",
    response_model=RegisterResponse,
    status_code=201,
    tags=["Authentication"],
    summary="Register Guest",
    description="Registers a new guest account. Staff accounts cannot be self-registered.",
    responses={
        201: {"model": RegisterResponse, "description": "Guest account successfully created"},
        409: {"model": ErrorEnvelope, "description": "Email already registered"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def register(data: RegisterRequest):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT guest_id
            FROM guests
            WHERE LOWER(email) = LOWER(%s);
            """,
            (data.email,),
        )

        if cur.fetchone() is not None:
            raise HTTPException(
                status_code=409,
                detail="Email is already registered",
            )

        cur.execute(
            """
            INSERT INTO guests
                (
                    full_name,
                    email
                )
            VALUES
                (
                    %s,
                    %s
                )
            RETURNING guest_id;
            """,
            (
                data.full_name,
                data.email,
            ),
        )

        guest_id = cur.fetchone()[0]

        password_hash = hash_password(
            data.password
        )

        cur.execute(
            """
            INSERT INTO accounts
                (
                    guest_id,
                    email,
                    password_hash,
                    role
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    'guest'
                )
            RETURNING account_id;
            """,
            (
                guest_id,
                data.email,
                password_hash,
            ),
        )

        account_id = cur.fetchone()[0]

        conn.commit()

        return {
            "account_id": account_id,
            "guest_id": guest_id,
            "email": data.email,
            "role": "guest",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


@app.post(
    "/auth/login",
    response_model=LoginResponse,
    tags=["Authentication"],
    summary="Login",
    description="Authenticates a user with email and password and returns access and refresh tokens.",
    responses={
        200: {"model": LoginResponse, "description": "Login successful"},
        401: {"model": ErrorEnvelope, "description": "Invalid email or password"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
        429: {"model": ErrorEnvelope, "description": "Too many login attempts"},
    },
)
def login(data: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{data.email.lower()}"
    check_login_rate_limit(rate_key)

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT
                account_id,
                email,
                password_hash,
                role,
                property_id,
                is_active
            FROM accounts
            WHERE LOWER(email) = LOWER(%s);
            """,
            (data.email,),
        )

        row = cur.fetchone()

        if row is None or not row[5]:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        if not verify_password(
            data.password,
            row[2],
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        access_token = create_access_token(
            row[0],
            row[3],
        )

        refresh_token = create_refresh_token()

        refresh_token_hash = hash_refresh_token(
            refresh_token
        )

        cur.execute(
            """
            INSERT INTO refresh_tokens
                (
                    account_id,
                    token_hash,
                    expires_at
                )
            VALUES
                (
                    %s,
                    %s,
                    CURRENT_TIMESTAMP + INTERVAL '7 days'
                );
            """,
            (
                row[0],
                refresh_token_hash,
            ),
        )

        conn.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 900,
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


@app.post(
    "/auth/refresh",
    response_model=RefreshResponse,
    tags=["Authentication"],
    summary="Refresh Token",
    description="Rotates refresh token and issues a new access token.",
    responses={
        200: {"model": RefreshResponse, "description": "Token refreshed successfully"},
        401: {"model": ErrorEnvelope, "description": "Invalid or expired refresh token"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def refresh_token(data: RefreshRequest):
    conn = get_connection()
    cur = conn.cursor()

    try:
        token_hash = hash_refresh_token(data.refresh_token)
        cur.execute(
            """
            SELECT
                refresh_token_id,
                account_id,
                token_hash
            FROM refresh_tokens
            WHERE token_hash = %s
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP;
            """,
            (token_hash,),
        )

        matching_row = cur.fetchone()

        if matching_row is None:
            cur.execute(
                """
                SELECT
                    refresh_token_id,
                    account_id,
                    token_hash
                FROM refresh_tokens
                WHERE revoked_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                  AND token_hash LIKE '$2%'
                ORDER BY refresh_token_id;
                """
            )
            for row in cur.fetchall():
                if verify_refresh_token(
                    data.refresh_token,
                    row[2],
                ):
                    matching_row = row
                    break

        if matching_row is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired refresh token",
            )

        refresh_token_id = matching_row[0]
        account_id = matching_row[1]

        cur.execute(
            """
            SELECT
                role,
                is_active
            FROM accounts
            WHERE account_id = %s;
            """,
            (account_id,),
        )

        account = cur.fetchone()

        if account is None or not account[1]:
            raise HTTPException(
                status_code=401,
                detail="Account is inactive",
            )

        new_access_token = create_access_token(
            account_id,
            account[0],
        )

        new_refresh_token = create_refresh_token()

        new_refresh_token_hash = hash_refresh_token(
            new_refresh_token
        )

        cur.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE refresh_token_id = %s;
            """,
            (refresh_token_id,),
        )

        cur.execute(
            """
            INSERT INTO refresh_tokens
                (
                    account_id,
                    token_hash,
                    expires_at
                )
            VALUES
                (
                    %s,
                    %s,
                    CURRENT_TIMESTAMP + INTERVAL '7 days'
                );
            """,
            (
                account_id,
                new_refresh_token_hash,
            ),
        )

        conn.commit()

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": 900,
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


@app.post(
    "/auth/logout",
    response_model=LogoutResponse,
    tags=["Authentication"],
    summary="Logout",
    description="Revokes the given refresh token.",
    responses={
        200: {"model": LogoutResponse, "description": "Logged out successfully"},
        401: {"model": ErrorEnvelope, "description": "Invalid refresh token"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def logout(data: LogoutRequest):
    conn = get_connection()
    cur = conn.cursor()

    try:
        token_hash = hash_refresh_token(data.refresh_token)
        cur.execute(
            """
            SELECT
                refresh_token_id
            FROM refresh_tokens
            WHERE token_hash = %s
              AND revoked_at IS NULL;
            """,
            (token_hash,),
        )

        matching_row = cur.fetchone()
        matching_id = matching_row[0] if matching_row else None

        if matching_id is None:
            cur.execute(
                """
                SELECT
                    refresh_token_id,
                    token_hash
                FROM refresh_tokens
                WHERE revoked_at IS NULL
                  AND token_hash LIKE '$2%';
                """
            )
            for row in cur.fetchall():
                if verify_refresh_token(
                    data.refresh_token,
                    row[1],
                ):
                    matching_id = row[0]
                    break

        if matching_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token",
            )

        cur.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE refresh_token_id = %s;
            """,
            (matching_id,),
        )

        conn.commit()

        return {
            "message": "Logged out successfully"
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


@app.get(
    "/auth/me",
    response_model=AuthMeResponse,
    tags=["Authentication"],
    summary="Get Current User Account",
    description="Returns the account ID and role for the authenticated caller.",
    responses={
        200: {"model": AuthMeResponse, "description": "Account details"},
        401: {"model": ErrorEnvelope, "description": "Invalid or expired token"},
    },
)
def auth_me(
    current_user: dict = Depends(get_current_user),
):
    return {
        "account_id": int(current_user["sub"]),
        "role": current_user["role"],
    }


# =========================================================
# STAGE 5 BOOKING HELPERS
# =========================================================

def get_booking(
    cur,
    booking_id: int,
):
    cur.execute(
        """
        SELECT
            b.booking_id,
            b.guest_id,
            b.room_id,
            lower(b.stay),
            upper(b.stay),
            b.guests_count,
            b.status,
            r.property_id
        FROM bookings b
        JOIN rooms r
            ON r.room_id = b.room_id
        WHERE b.booking_id = %s;
        """,
        (booking_id,),
    )

    return cur.fetchone()


def check_booking_access(
    cur,
    booking_id: int,
    account,
):
    booking = get_booking(
        cur,
        booking_id,
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    account_id = int(
        account["sub"]
    ) if "sub" in account else int(
        account["account_id"]
    )

    role = account["role"]

    # Guest can see only their own booking.
    if role == "guest":
        cur.execute(
            """
            SELECT guest_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account_id,),
        )

        guest = cur.fetchone()

        if (
            guest is None
            or guest[0] != booking[1]
        ):
            raise HTTPException(
                status_code=404,
                detail="Booking not found",
            )

    # Staff and manager can see only their property.
    elif role in {
        "staff",
        "manager",
    }:
        cur.execute(
            """
            SELECT property_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account_id,),
        )

        assigned = cur.fetchone()

        if (
            assigned is None
            or assigned[0] != booking[7]
        ):
            raise HTTPException(
                status_code=404,
                detail="Booking not found",
            )

    return booking


def calculate_booking_total(
    cur,
    booking_id: int,
):
    """
    Resolve the nightly rate server-side.
    Each night is looked up separately so a booking crossing two rate periods is charged correctly.
    """
    cur.execute(
        """
        SELECT
            COALESCE(
                SUM(
                    (
                        SELECT rp.nightly_rate
                        FROM rate_plans rp
                        WHERE rp.property_id = r.property_id
                          AND rp.room_type_id = r.room_type_id
                          AND rp.valid @> d.day::date
                        ORDER BY lower(rp.valid) DESC
                        LIMIT 1
                    )
                ),
                0
            )
        FROM bookings b

        JOIN rooms r
            ON r.room_id = b.room_id

        CROSS JOIN LATERAL generate_series(
            lower(b.stay),
            upper(b.stay) - 1,
            INTERVAL '1 day'
        ) AS d(day)

        WHERE b.booking_id = %s;
        """,
        (booking_id,),
    )

    return cur.fetchone()[0] or Decimal("0")


def booking_output(
    cur,
    booking_id: int,
):
    booking = get_booking(
        cur,
        booking_id,
    )

    if booking is None:
        return None

    total_amount = calculate_booking_total(
        cur,
        booking_id,
    )

    return {
        "booking_id": booking[0],
        "guest_id": booking[1],
        "room_id": booking[2],
        "check_in": booking[3],
        "check_out": booking[4],
        "guests": booking[5],
        "status": booking[6],
        "total_amount": str(total_amount),
    }


# =========================================================
# BOOKINGS
# =========================================================

@app.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=201,
    tags=["Bookings"],
    summary="Create Booking",
    description="Creates a new room booking. Guest count, room availability, and rate plans are enforced server-side.",
    responses={
        201: {"model": BookingResponse, "description": "Booking successfully created"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden for property"},
        404: {"model": ErrorEnvelope, "description": "Room or rate plan not found"},
        409: {"model": ErrorEnvelope, "description": "Room already booked or payment exceeds total"},
        422: {"model": ErrorEnvelope, "description": "Invalid booking dates or guest count"},
    },
)
def create_booking(
    booking: BookingRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cur = conn.cursor()

    try:
        account_id = int(current_user["sub"])
        role = current_user["role"]

        # -------------------------------------------------
        # Determine guest
        # -------------------------------------------------
        if role == "guest":
            cur.execute(
                """
                SELECT guest_id
                FROM accounts
                WHERE account_id = %s
                  AND is_active = TRUE;
                """,
                (account_id,),
            )

            account = cur.fetchone()

            if account is None or account[0] is None:
                raise HTTPException(
                    status_code=401,
                    detail="Guest account not found",
                )

            guest_id = account[0]

        else:
            if booking.guest_id is None:
                raise HTTPException(
                    status_code=422,
                    detail="guest_id is required",
                )

            guest_id = booking.guest_id

        # -------------------------------------------------
        # Room + capacity
        # -------------------------------------------------
        cur.execute(
            """
            SELECT
                r.property_id,
                r.room_type_id,
                rt.max_occupancy
            FROM rooms r
            JOIN room_types rt
                ON rt.room_type_id = r.room_type_id
            WHERE r.room_id = %s
            FOR UPDATE;
            """,
            (booking.room_id,),
        )

        room = cur.fetchone()

        if room is None:
            raise HTTPException(
                status_code=404,
                detail="Room not found",
            )

        if booking.guests > room[2]:
            raise HTTPException(
                status_code=422,
                detail="Guest count exceeds room capacity",
            )

        # -------------------------------------------------
        # Property scope
        # -------------------------------------------------
        if role in {
            "staff",
            "manager",
        }:
            cur.execute(
                """
                SELECT property_id
                FROM accounts
                WHERE account_id = %s;
                """,
                (account_id,),
            )

            assigned = cur.fetchone()

            if (
                assigned is None
                or assigned[0] != room[0]
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden",
                )

        # -------------------------------------------------
        # INSERT BOOKING
        # -------------------------------------------------
        cur.execute(
            """
            INSERT INTO bookings
                (
                    guest_id,
                    room_id,
                    stay,
                    guests_count,
                    status
                )
            VALUES
                (
                    %s,
                    %s,
                    daterange(
                        %s,
                        %s,
                        '[)'
                    ),
                    %s,
                    'confirmed'
                )
            RETURNING booking_id;
            """,
            (
                guest_id,
                booking.room_id,
                booking.check_in,
                booking.check_out,
                booking.guests,
            ),
        )

        booking_id = cur.fetchone()[0]

        # -------------------------------------------------
        # Calculate total from rate_plans
        # -------------------------------------------------
        total_amount = calculate_booking_total(
            cur,
            booking_id,
        )

        if total_amount <= 0:
            raise HTTPException(
                status_code=404,
                detail="No rate plan found for requested stay",
            )

        # -------------------------------------------------
        # DEPOSIT
        # -------------------------------------------------
        if booking.deposit is not None:
            try:
                deposit = Decimal(
                    str(booking.deposit)
                )
            except InvalidOperation:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid deposit amount",
                )

            if deposit <= 0:
                raise HTTPException(
                    status_code=422,
                    detail="Deposit must be greater than zero",
                )

            if deposit > total_amount:
                raise HTTPException(
                    status_code=409,
                    detail="Payment exceeds booking total",
                )

            cur.execute(
                """
                INSERT INTO payments
                    (
                        booking_id,
                        amount,
                        method
                    )
                VALUES
                    (
                        %s,
                        %s,
                        %s
                    );
                """,
                (
                    booking_id,
                    deposit,
                    "cash",
                ),
            )

        # -------------------------------------------------
        # COMMIT
        # -------------------------------------------------
        conn.commit()

        return booking_output(
            cur,
            booking_id,
        )

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


# =========================================================
# STATE MACHINE TRANSITIONS
# =========================================================

ALLOWED_TRANSITIONS = {
    "confirmed": {
        "checked_in",
        "cancelled",
        "no_show",
    },
    "checked_in": {
        "checked_out",
    },
    "checked_out": set(),
    "cancelled": set(),
    "no_show": set(),
}


def change_booking_status(
    booking_id: int,
    target_status: str,
    current_user: dict,
):
    conn = get_connection()
    cur = conn.cursor()

    try:
        booking = check_booking_access(
            cur,
            booking_id,
            current_user,
        )

        current_status = booking[6]

        if target_status not in ALLOWED_TRANSITIONS.get(
            current_status,
            set(),
        ):
            raise HTTPException(
                status_code=409,
                detail="Illegal booking status transition",
            )

        cur.execute(
            """
            UPDATE bookings
            SET status = %s
            WHERE booking_id = %s;
            """,
            (
                target_status,
                booking_id,
            ),
        )

        conn.commit()

        return booking_output(
            cur,
            booking_id,
        )

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


@app.post(
    "/bookings/{booking_id}/check-in",
    response_model=BookingResponse,
    tags=["Bookings"],
    summary="Check In",
    description="Marks a confirmed booking as checked_in. Staff/Manager only.",
    responses={
        200: {"model": BookingResponse, "description": "Booking checked in"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Staff only"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Illegal transition"},
    },
)
def check_in(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in {
        "staff",
        "manager",
        "owner",
    }:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return change_booking_status(
        booking_id,
        "checked_in",
        current_user,
    )


@app.post(
    "/bookings/{booking_id}/check-out",
    response_model=BookingResponse,
    tags=["Bookings"],
    summary="Check Out",
    description="Marks a checked_in booking as checked_out. Staff/Manager only.",
    responses={
        200: {"model": BookingResponse, "description": "Booking checked out"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Staff only"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Illegal transition"},
    },
)
def check_out(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in {
        "staff",
        "manager",
        "owner",
    }:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return change_booking_status(
        booking_id,
        "checked_out",
        current_user,
    )


@app.post(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
    tags=["Bookings"],
    summary="Cancel Booking",
    description="Cancels a confirmed booking. Guests may cancel their own booking.",
    responses={
        200: {"model": BookingResponse, "description": "Booking cancelled"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Illegal transition"},
    },
)
def cancel_booking(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    return change_booking_status(
        booking_id,
        "cancelled",
        current_user,
    )


@app.post(
    "/bookings/{booking_id}/no-show",
    response_model=BookingResponse,
    tags=["Bookings"],
    summary="No-Show Booking",
    description="Marks a booking as no-show when guest does not arrive. Staff/Manager only.",
    responses={
        200: {"model": BookingResponse, "description": "Booking marked no-show"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Staff only"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Illegal transition"},
    },
)
def no_show(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in {
        "staff",
        "manager",
        "owner",
    }:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return change_booking_status(
        booking_id,
        "no_show",
        current_user,
    )


# =========================================================
# PAYMENTS
# =========================================================

@app.get(
    "/bookings/{booking_id}/payments",
    response_model=PaymentListResponse,
    tags=["Payments"],
    summary="List Payments",
    description="Lists all recorded payments and remaining balance for a booking.",
    responses={
        200: {"model": PaymentListResponse, "description": "Payment list and balance"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
    },
)
def list_payments(
    booking_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cur = conn.cursor()

    try:
        check_booking_access(
            cur,
            booking_id,
            current_user,
        )

        cur.execute(
            """
            SELECT
                payment_id,
                booking_id,
                amount,
                method,
                paid_at
            FROM payments
            WHERE booking_id = %s
            ORDER BY paid_at, payment_id;
            """,
            (booking_id,),
        )

        rows = cur.fetchall()

        cur.execute(
            """
            SELECT COALESCE(
                SUM(amount),
                0
            )
            FROM payments
            WHERE booking_id = %s;
            """,
            (booking_id,),
        )

        total_paid = cur.fetchone()[0]

        total_amount = calculate_booking_total(
            cur,
            booking_id,
        )

        return {
            "items": [
                {
                    "payment_id": row[0],
                    "booking_id": row[1],
                    "amount": str(row[2]),
                    "method": row[3],
                    "created_at": row[4].isoformat(),
                }
                for row in rows
            ],
            "total_paid": str(total_paid),
            "balance": str(
                max(
                    total_amount - total_paid,
                    Decimal("0"),
                )
            ),
        }

    finally:
        cur.close()
        release_connection(conn)


@app.post(
    "/bookings/{booking_id}/payments",
    response_model=PaymentResponse,
    status_code=201,
    tags=["Payments"],
    summary="Record Payment",
    description="Records a payment installment against a booking. Requires an Idempotency-Key header.",
    responses={
        201: {"model": PaymentResponse, "description": "Payment successfully recorded"},
        200: {"model": PaymentResponse, "description": "Idempotent payment replay"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Idempotency conflict or payment exceeds total"},
        422: {"model": ErrorEnvelope, "description": "Invalid payment amount"},
    },
)
def record_payment(
    booking_id: int,
    data: PaymentRequest,
    response: Response,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
    ),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cur = conn.cursor()

    try:
        check_booking_access(
            cur,
            booking_id,
            current_user,
        )

        # -------------------------------------------------
        # Look for previous request with same idempotency key
        # -------------------------------------------------
        cur.execute(
            """
            SELECT
                payment_id,
                booking_id,
                amount,
                method,
                paid_at
            FROM payments
            WHERE idempotency_key = %s;
            """,
            (idempotency_key,),
        )

        existing = cur.fetchone()

        if existing is not None:
            # Same key + same booking + same amount + same method = replay.
            if (
                existing[1] == booking_id
                and str(existing[2]) == str(Decimal(data.amount))
                and existing[3] == data.method
            ):
                response.status_code = 200
                return {
                    "payment_id": existing[0],
                    "booking_id": existing[1],
                    "amount": str(existing[2]),
                    "method": existing[3],
                    "created_at": existing[4].isoformat(),
                }

            # Same key + different body = conflict.
            raise HTTPException(
                status_code=409,
                detail="Idempotency key reused with different payment",
            )

        # -------------------------------------------------
        # Validate amount
        # -------------------------------------------------
        try:
            amount = Decimal(str(data.amount))
        except InvalidOperation:
            raise HTTPException(
                status_code=422,
                detail="Invalid payment amount",
            )

        if amount <= 0:
            raise HTTPException(
                status_code=422,
                detail="Payment amount must be greater than zero",
            )

        # -------------------------------------------------
        # Booking total and balance check
        # -------------------------------------------------
        total_amount = calculate_booking_total(
            cur,
            booking_id,
        )

        cur.execute(
            """
            SELECT COALESCE(
                SUM(amount),
                0
            )
            FROM payments
            WHERE booking_id = %s;
            """,
            (booking_id,),
        )

        total_paid = cur.fetchone()[0]

        if total_paid + amount > total_amount:
            raise HTTPException(
                status_code=409,
                detail="Payment exceeds booking total",
            )

        # -------------------------------------------------
        # Insert payment
        # -------------------------------------------------
        cur.execute(
            """
            INSERT INTO payments
                (
                    booking_id,
                    amount,
                    method,
                    idempotency_key
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s
                )
            RETURNING
                payment_id,
                booking_id,
                amount,
                method,
                paid_at;
            """,
            (
                booking_id,
                amount,
                data.method,
                idempotency_key,
            ),
        )

        row = cur.fetchone()
        conn.commit()

        return {
            "payment_id": row[0],
            "booking_id": row[1],
            "amount": str(row[2]),
            "method": row[3],
            "created_at": row[4].isoformat(),
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


# =========================================================
# REVIEWS
# =========================================================

@app.post(
    "/bookings/{booking_id}/review",
    response_model=ReviewResponse,
    status_code=201,
    tags=["Reviews"],
    summary="Create Review",
    description="Allows a guest to submit a rating (1-5) and comment after checking out.",
    responses={
        201: {"model": ReviewResponse, "description": "Review successfully submitted"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Guests only or checkout required"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
        409: {"model": ErrorEnvelope, "description": "Booking already has a review"},
        422: {"model": ErrorEnvelope, "description": "Invalid rating or comment"},
    },
)
def create_review(
    booking_id: int,
    data: ReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "guest":
        raise HTTPException(
            status_code=403,
            detail="Only guests may create reviews",
        )

    conn = get_connection()
    cur = conn.cursor()

    try:
        booking = check_booking_access(
            cur,
            booking_id,
            current_user,
        )

        if booking[6] != "checked_out":
            raise HTTPException(
                status_code=403,
                detail="Review allowed only after checkout",
            )

        cur.execute(
            """
            INSERT INTO reviews
                (
                    booking_id,
                    rating,
                    review_text
                )
            VALUES
                (
                    %s,
                    %s,
                    %s
                )
            RETURNING
                review_id,
                booking_id,
                rating,
                review_text;
            """,
            (
                booking_id,
                data.rating,
                data.comment,
            ),
        )

        row = cur.fetchone()
        conn.commit()

        return {
            "review_id": row[0],
            "booking_id": row[1],
            "rating": row[2],
            "comment": row[3],
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        cur.close()
        release_connection(conn)


# =========================================================
# MOUNT READ API ROUTER
# =========================================================

app.include_router(read_router)