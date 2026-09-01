from datetime import date
from decimal import Decimal
from enum import Enum
import os

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict

from app.database import get_connection, release_connection
from app.models import ErrorEnvelope


router = APIRouter()

bearer = HTTPBearer(auto_error=False)


# =========================================================
# ENUMS
# =========================================================

class BookingStatus(str, Enum):
    confirmed = "confirmed"
    checked_in = "checked_in"
    checked_out = "checked_out"
    cancelled = "cancelled"
    no_show = "no_show"


# =========================================================
# RESPONSE MODELS
# =========================================================

class PropertyOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_id: int
    name: str
    city: str
    star_rating: int


class RoomOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    room_id: int
    room_number: str
    room_type: str
    max_occupancy: int


class AvailabilityRoom(RoomOut):
    nightly_rate: str
    total_rate: str


class AvailabilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AvailabilityRoom]


class PageMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int
    offset: int
    total: int


class PropertyPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PropertyOut]
    meta: PageMeta


class RoomPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RoomOut]
    meta: PageMeta


class GuestOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    guest_id: int
    full_name: str
    email: str


class GuestPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[GuestOut]
    meta: PageMeta


class BookingOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: int
    guest_id: int
    room_id: int
    check_in: date
    check_out: date
    guests: int
    status: BookingStatus
    total_amount: str | None = None


class BookingPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[BookingOut]
    meta: PageMeta


class MeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int
    role: str
    email: str | None = None
    full_name: str | None = None
    property_id: int | None = None


class ReportRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_id: int
    month: date
    value: str


class ReportPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ReportRow]


# =========================================================
# AUTHENTICATION & DEPENDENCIES
# =========================================================

def current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    secret = os.environ["SECRET_KEY"]

    try:
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
        )

        account_id = int(payload["sub"])
        role = payload["role"]

    except (
        jwt.PyJWTError,
        KeyError,
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    return {
        "account_id": account_id,
        "role": role,
    }


def require_staff(
    account=Depends(current_account),
):
    if account["role"] not in {
        "staff",
        "manager",
        "owner",
    }:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return account


def require_manager(
    account=Depends(current_account),
):
    if account["role"] not in {
        "manager",
        "owner",
    }:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return account


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def db():
    conn = get_connection()
    try:
        yield conn
    finally:
        release_connection(conn)


# =========================================================
# 4.1 PROPERTIES
# =========================================================

@router.get(
    "/properties",
    response_model=PropertyPage,
    tags=["Properties"],
    summary="List Properties",
    description="Returns a paginated list of all hotel properties.",
    responses={
        200: {"model": PropertyPage, "description": "List of properties"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def list_properties(
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    conn=Depends(db),
):
    cur = conn.cursor()

    cur.execute(
        """
        SELECT COUNT(*)
        FROM properties;
        """
    )

    total = cur.fetchone()[0]

    cur.execute(
        """
        SELECT
            property_id,
            name,
            city,
            star_rating
        FROM properties
        ORDER BY property_id
        LIMIT %s
        OFFSET %s;
        """,
        (
            limit,
            offset,
        ),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "property_id": row[0],
                "name": row[1],
                "city": row[2],
                "star_rating": row[3],
            }
            for row in rows
        ],
        "meta": {
            "limit": limit,
            "offset": offset,
            "total": total,
        },
    }


@router.get(
    "/properties/{property_id}",
    response_model=PropertyOut,
    tags=["Properties"],
    summary="Get Property",
    description="Returns details for a single hotel property.",
    responses={
        200: {"model": PropertyOut, "description": "Property details"},
        404: {"model": ErrorEnvelope, "description": "Property not found"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def get_property(
    property_id: int,
    conn=Depends(db),
):
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            property_id,
            name,
            city,
            star_rating
        FROM properties
        WHERE property_id = %s;
        """,
        (property_id,),
    )

    row = cur.fetchone()
    cur.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Property not found",
        )

    return {
        "property_id": row[0],
        "name": row[1],
        "city": row[2],
        "star_rating": row[3],
    }


# =========================================================
# ROOMS
# =========================================================

@router.get(
    "/properties/{property_id}/rooms",
    response_model=RoomPage,
    tags=["Properties"],
    summary="List Rooms",
    description="Returns all rooms in a property. Staff/Manager/Owner only.",
    responses={
        200: {"model": RoomPage, "description": "List of rooms"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden for property"},
        404: {"model": ErrorEnvelope, "description": "Property not found"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def list_rooms(
    property_id: int,
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    account=Depends(require_staff),
    conn=Depends(db),
):
    cur = conn.cursor()

    if account["role"] in {
        "staff",
        "manager",
    }:
        cur.execute(
            """
            SELECT property_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )

        assigned = cur.fetchone()

        if (
            assigned is None
            or assigned[0] != property_id
        ):
            cur.close()
            raise HTTPException(
                status_code=403,
                detail="Forbidden",
            )

    cur.execute(
        """
        SELECT COUNT(*)
        FROM rooms
        WHERE property_id = %s;
        """,
        (property_id,),
    )

    total = cur.fetchone()[0]

    cur.execute(
        """
        SELECT
            r.room_id,
            r.room_number,
            rt.name,
            rt.max_occupancy
        FROM rooms r
        JOIN room_types rt
            ON rt.room_type_id = r.room_type_id
        WHERE r.property_id = %s
        ORDER BY r.room_number
        LIMIT %s
        OFFSET %s;
        """,
        (
            property_id,
            limit,
            offset,
        ),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "room_id": row[0],
                "room_number": row[1],
                "room_type": row[2],
                "max_occupancy": row[3],
            }
            for row in rows
        ],
        "meta": {
            "limit": limit,
            "offset": offset,
            "total": total,
        },
    }


# =========================================================
# 4.1 AVAILABILITY
# =========================================================

@router.get(
    "/properties/{property_id}/availability",
    response_model=AvailabilityResponse,
    tags=["Availability"],
    summary="Check Availability",
    description="Returns available rooms in a property for a given date range and optional room type.",
    responses={
        200: {"model": AvailabilityResponse, "description": "Available rooms with pricing"},
        422: {"model": ErrorEnvelope, "description": "Invalid date range or parameters"},
    },
)
def availability(
    property_id: int,
    from_: date = Query(
        ...,
        alias="from",
    ),
    to: date = Query(...),
    room_type: str | None = Query(None),
    conn=Depends(db),
):
    if to <= from_:
        raise HTTPException(
            status_code=422,
            detail="to must be after from",
        )

    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            r.room_id,
            r.room_number,
            rt.name,
            rt.max_occupancy,
            COALESCE(rp.nightly_rate, 0),
            COALESCE(
                rp.nightly_rate * (%s - %s),
                0
            )
        FROM rooms r

        JOIN room_types rt
            ON rt.room_type_id = r.room_type_id

        LEFT JOIN LATERAL (
            SELECT nightly_rate
            FROM rate_plans
            WHERE property_id = r.property_id
              AND room_type_id = r.room_type_id
              AND valid @> %s
            ORDER BY lower(valid) DESC
            LIMIT 1
        ) rp ON TRUE

        WHERE r.property_id = %s

          AND (
              %s IS NULL
              OR rt.name = %s
          )

          AND NOT EXISTS (
              SELECT 1
              FROM bookings b
              WHERE b.room_id = r.room_id

                AND b.status IN (
                    'confirmed',
                    'checked_in',
                    'checked_out'
                )

                AND b.stay && daterange(
                    %s,
                    %s,
                    '[)'
                )
          )

        ORDER BY r.room_number;
        """,
        (
            (to - from_).days,
            0,
            from_,
            property_id,
            room_type,
            room_type,
            from_,
            to,
        ),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "room_id": row[0],
                "room_number": row[1],
                "room_type": row[2],
                "max_occupancy": row[3],
                "nightly_rate": str(
                    row[4]
                ),
                "total_rate": str(
                    row[5]
                ),
            }
            for row in rows
        ]
    }


# =========================================================
# 4.2 BOOKING LIST
# =========================================================

SORTS = {
    "check_in": "lower(b.stay) ASC",
    "-check_in": "lower(b.stay) DESC",
    "created_at": "b.booking_id ASC",
    "-created_at": "b.booking_id DESC",
    "total_amount": "total_amount ASC",
    "-total_amount": "total_amount DESC",
}


@router.get(
    "/bookings",
    response_model=BookingPage,
    tags=["Bookings"],
    summary="List Bookings",
    description="Returns a paginated list of bookings filtered by status, dates, guest, and property.",
    responses={
        200: {"model": BookingPage, "description": "List of bookings"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        422: {"model": ErrorEnvelope, "description": "Invalid parameters or sort field"},
    },
)
def list_bookings(
    property_id: int | None = None,
    status: BookingStatus | None = None,
    guest_id: int | None = None,
    from_: date | None = Query(
        None,
        alias="from",
    ),
    to: date | None = Query(None),
    sort: str = Query("-check_in"),
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    account=Depends(current_account),
    conn=Depends(db),
):
    if sort not in SORTS:
        raise HTTPException(
            status_code=422,
            detail="Unsupported sort field",
        )

    if (
        from_ is not None
        and to is not None
        and to <= from_
    ):
        raise HTTPException(
            status_code=422,
            detail="to must be after from",
        )

    cur = conn.cursor()

    conditions = []
    params = []

    # -----------------------------------------------------
    # GUEST SCOPE: Must map account_id to guest_id
    # -----------------------------------------------------
    if account["role"] == "guest":
        cur.execute(
            """
            SELECT guest_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )
        acc_row = cur.fetchone()
        scoped_guest_id = acc_row[0] if acc_row else -1

        conditions.append("b.guest_id = %s")
        params.append(scoped_guest_id)

    # -----------------------------------------------------
    # STAFF / MANAGER PROPERTY SCOPE
    # -----------------------------------------------------
    elif account["role"] in {
        "staff",
        "manager",
    }:
        cur.execute(
            """
            SELECT property_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )

        assigned = cur.fetchone()

        if (
            assigned is None
            or assigned[0] is None
        ):
            cur.close()
            raise HTTPException(
                status_code=403,
                detail="Forbidden",
            )

        conditions.append("r.property_id = %s")
        params.append(assigned[0])

    # -----------------------------------------------------
    # FILTERS
    # -----------------------------------------------------
    if property_id is not None:
        conditions.append("r.property_id = %s")
        params.append(property_id)

    if status is not None:
        conditions.append("b.status = %s")
        params.append(status.value)

    if (
        guest_id is not None
        and account["role"] != "guest"
    ):
        conditions.append("b.guest_id = %s")
        params.append(guest_id)

    if from_ is not None:
        if to is not None:
            conditions.append("b.stay && daterange(%s, %s, '[)')")
            params.extend([from_, to])
        else:
            conditions.append("upper(b.stay) > %s")
            params.append(from_)
    elif to is not None:
        conditions.append("lower(b.stay) < %s")
        params.append(to)

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    amount_sql = """
        COALESCE(
            (
                SELECT SUM(p.amount)
                FROM payments p
                WHERE p.booking_id = b.booking_id
            ),
            0
        )
    """

    cur.execute(
        f"""
        SELECT COUNT(*)
        FROM bookings b
        JOIN rooms r
            ON r.room_id = b.room_id
        WHERE {where_clause};
        """,
        tuple(params),
    )

    total = cur.fetchone()[0]

    cur.execute(
        f"""
        SELECT
            b.booking_id,
            b.guest_id,
            b.room_id,
            lower(b.stay),
            upper(b.stay),
            b.guests_count,
            b.status,
            {amount_sql} AS total_amount
        FROM bookings b
        JOIN rooms r
            ON r.room_id = b.room_id
        WHERE {where_clause}
        ORDER BY {SORTS[sort]}
        LIMIT %s
        OFFSET %s;
        """,
        tuple(params + [limit, offset]),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "booking_id": row[0],
                "guest_id": row[1],
                "room_id": row[2],
                "check_in": row[3],
                "check_out": row[4],
                "guests": row[5],
                "status": row[6],
                "total_amount": str(row[7]),
            }
            for row in rows
        ],
        "meta": {
            "limit": limit,
            "offset": offset,
            "total": total,
        },
    }


# =========================================================
# 4.3 BOOKING DETAIL
# =========================================================

@router.get(
    "/bookings/{booking_id}",
    response_model=BookingOut,
    tags=["Bookings"],
    summary="Get Booking Details",
    description="Returns detailed information for a single booking.",
    responses={
        200: {"model": BookingOut, "description": "Booking details"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        404: {"model": ErrorEnvelope, "description": "Booking not found"},
    },
)
def get_booking(
    booking_id: int,
    account=Depends(current_account),
    conn=Depends(db),
):
    cur = conn.cursor()

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
            COALESCE(SUM(p.amount), 0) AS total_paid,
            r.property_id
        FROM bookings b
        JOIN rooms r
            ON r.room_id = b.room_id
        LEFT JOIN payments p
            ON p.booking_id = b.booking_id
        WHERE b.booking_id = %s
        GROUP BY
            b.booking_id,
            b.guest_id,
            b.room_id,
            b.stay,
            b.guests_count,
            b.status,
            r.property_id;
        """,
        (booking_id,),
    )

    row = cur.fetchone()

    if row is None:
        cur.close()
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    visible = True

    # -----------------------------------------------------
    # GUEST SCOPE
    # -----------------------------------------------------
    if account["role"] == "guest":
        cur.execute(
            """
            SELECT guest_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )

        account_row = cur.fetchone()
        visible = (
            account_row is not None
            and account_row[0] == row[1]
        )

    # -----------------------------------------------------
    # STAFF / MANAGER SCOPE
    # -----------------------------------------------------
    elif account["role"] in {
        "staff",
        "manager",
    }:
        cur.execute(
            """
            SELECT property_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )

        assigned = cur.fetchone()
        visible = (
            assigned is not None
            and assigned[0] == row[8]
        )

    cur.close()

    if not visible:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    return {
        "booking_id": row[0],
        "guest_id": row[1],
        "room_id": row[2],
        "check_in": row[3],
        "check_out": row[4],
        "guests": row[5],
        "status": row[6],
        "total_amount": str(row[7]),
    }


# =========================================================
# 4.5 ME
# =========================================================

@router.get(
    "/me",
    response_model=MeOut,
    tags=["Authentication"],
    summary="Get Current User Profile",
    description="Returns account and profile information for the authenticated caller.",
    responses={
        200: {"model": MeOut, "description": "Profile details"},
        401: {"model": ErrorEnvelope, "description": "Invalid or expired token"},
    },
)
def me(
    account=Depends(current_account),
    conn=Depends(db),
):
    cur = conn.cursor()

    # Single joined query to eliminate N+1 lookup
    cur.execute(
        """
        SELECT
            a.account_id,
            a.email,
            a.role,
            a.property_id,
            g.full_name
        FROM accounts a
        LEFT JOIN guests g
            ON g.guest_id = a.guest_id
        WHERE a.account_id = %s
          AND a.is_active = TRUE;
        """,
        (account["account_id"],),
    )

    row = cur.fetchone()
    cur.close()

    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    return {
        "account_id": row[0],
        "email": row[1],
        "role": row[2],
        "property_id": row[3],
        "full_name": row[4],
    }


# =========================================================
# REPORT HELPER
# =========================================================

def report_scope(
    cur,
    account,
    property_id,
):
    if account["role"] == "manager":
        cur.execute(
            """
            SELECT property_id
            FROM accounts
            WHERE account_id = %s;
            """,
            (account["account_id"],),
        )

        row = cur.fetchone()
        assigned = row[0] if row else None

        if property_id is not None and property_id != assigned:
            raise HTTPException(
                status_code=403,
                detail="Forbidden",
            )

        return assigned if property_id is None else property_id

    return property_id


# =========================================================
# 4.4 OCCUPANCY
# =========================================================

@router.get(
    "/reports/occupancy",
    response_model=ReportPage,
    tags=["Reports"],
    summary="Occupancy Report",
    description="Calculates monthly occupancy rates. Manager (own property) and Owner (all properties).",
    responses={
        200: {"model": ReportPage, "description": "Monthly occupancy rates"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden for other property"},
        422: {"model": ErrorEnvelope, "description": "Invalid date range"},
    },
)
def report_occupancy(
    property_id: int | None = None,
    from_: date = Query(
        ...,
        alias="from",
    ),
    to: date = Query(...),
    account=Depends(require_manager),
    conn=Depends(db),
):
    if to <= from_:
        raise HTTPException(
            status_code=422,
            detail="to must be after from",
        )

    cur = conn.cursor()

    property_id = report_scope(
        cur,
        account,
        property_id,
    )

    cur.execute(
        """
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', %s::date)::date,
                date_trunc('month', (%s::date - 1))::date,
                interval '1 month'
            )::date AS month
        ),
        properties_scope AS (
            SELECT property_id
            FROM properties
            WHERE (%s IS NULL OR property_id = %s)
        ),
        available AS (
            SELECT
                p.property_id,
                m.month,
                COUNT(r.room_id) * EXTRACT(
                    DAY FROM (
                        LEAST(m.month + INTERVAL '1 month', %s::date)
                        - GREATEST(m.month, %s::date)
                    )
                ) AS available_nights
            FROM properties_scope p
            CROSS JOIN months m
            JOIN rooms r ON r.property_id = p.property_id
            GROUP BY p.property_id, m.month
        ),
        occupied AS (
            SELECT
                r.property_id,
                m.month,
                SUM(
                    GREATEST(
                        0,
                        EXTRACT(
                            DAY FROM (
                                LEAST(upper(b.stay), m.month + INTERVAL '1 month', %s::date)
                                - GREATEST(lower(b.stay), m.month, %s::date)
                            )
                        )
                    )
                ) AS occupied_nights
            FROM bookings b
            JOIN rooms r ON r.room_id = b.room_id
            CROSS JOIN months m
            WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
              AND (%s IS NULL OR r.property_id = %s)
              AND b.stay && daterange(%s, %s, '[)')
            GROUP BY r.property_id, m.month
        )
        SELECT
            a.property_id,
            a.month,
            COALESCE(o.occupied_nights, 0) / NULLIF(a.available_nights, 0) * 100
        FROM available a
        LEFT JOIN occupied o
            ON o.property_id = a.property_id
           AND o.month = a.month
        ORDER BY a.property_id, a.month;
        """,
        (
            from_, to,
            property_id, property_id,
            to, from_,
            to, from_,
            property_id, property_id,
            from_, to,
        ),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "property_id": row[0],
                "month": row[1],
                "value": str(row[2] or Decimal("0")),
            }
            for row in rows
        ]
    }


# =========================================================
# 4.4 ADR
# =========================================================

@router.get(
    "/reports/adr",
    response_model=ReportPage,
    tags=["Reports"],
    summary="ADR Report",
    description="Calculates Average Daily Rate per property per month.",
    responses={
        200: {"model": ReportPage, "description": "Monthly ADR values"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden for other property"},
        422: {"model": ErrorEnvelope, "description": "Invalid date range"},
    },
)
def report_adr(
    property_id: int | None = None,
    from_: date = Query(
        ...,
        alias="from",
    ),
    to: date = Query(...),
    account=Depends(require_manager),
    conn=Depends(db),
):
    if to <= from_:
        raise HTTPException(
            status_code=422,
            detail="to must be after from",
        )

    cur = conn.cursor()

    property_id = report_scope(
        cur,
        account,
        property_id,
    )

    cur.execute(
        """
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', %s::date)::date,
                date_trunc('month', (%s::date - 1))::date,
                interval '1 month'
            )::date AS month
        ),
        revenue AS (
            SELECT
                r.property_id,
                m.month,
                SUM(
                    pay.amount
                    * GREATEST(
                        0,
                        (LEAST(upper(b.stay), (m.month + INTERVAL '1 month')::date, %s::date)
                         - GREATEST(lower(b.stay), m.month, %s::date))
                    )
                    / NULLIF(upper(b.stay) - lower(b.stay), 0)
                ) AS revenue
            FROM bookings b
            JOIN rooms r ON r.room_id = b.room_id
            JOIN payments pay ON pay.booking_id = b.booking_id
            CROSS JOIN months m
            WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
              AND (%s IS NULL OR r.property_id = %s)
              AND b.stay && daterange(%s, %s, '[)')
            GROUP BY r.property_id, m.month
        ),
        sold AS (
            SELECT
                r.property_id,
                m.month,
                SUM(
                    GREATEST(
                        0,
                        (LEAST(upper(b.stay), (m.month + INTERVAL '1 month')::date, %s::date)
                         - GREATEST(lower(b.stay), m.month, %s::date))
                    )
                ) AS nights
            FROM bookings b
            JOIN rooms r ON r.room_id = b.room_id
            CROSS JOIN months m
            WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
              AND (%s IS NULL OR r.property_id = %s)
              AND b.stay && daterange(%s, %s, '[)')
            GROUP BY r.property_id, m.month
        )
        SELECT
            revenue.property_id,
            revenue.month,
            revenue.revenue / NULLIF(sold.nights, 0)
        FROM revenue
        JOIN sold
            ON sold.property_id = revenue.property_id
           AND sold.month = revenue.month
        ORDER BY revenue.property_id, revenue.month;
        """,
        (
            from_, to,
            to, from_,
            property_id, property_id,
            from_, to,
            to, from_,
            property_id, property_id,
            from_, to,
        ),
    )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "property_id": row[0],
                "month": row[1],
                "value": str(row[2] or Decimal("0")),
            }
            for row in rows
        ]
    }


# =========================================================
# 4.4 REVPAR
# =========================================================

@router.get(
    "/reports/revpar",
    response_model=ReportPage,
    tags=["Reports"],
    summary="RevPAR Report",
    description="Calculates Revenue per Available Room per property per month.",
    responses={
        200: {"model": ReportPage, "description": "Monthly RevPAR values"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden for other property"},
        422: {"model": ErrorEnvelope, "description": "Invalid date range"},
    },
)
def report_revpar(
    property_id: int | None = None,
    from_: date = Query(
        ...,
        alias="from",
    ),
    to: date = Query(...),
    account=Depends(require_manager),
    conn=Depends(db),
):
    if to <= from_:
        raise HTTPException(
            status_code=422,
            detail="to must be after from",
        )

    cur = conn.cursor()

    property_id = report_scope(
        cur,
        account,
        property_id,
    )

    cur.execute(
        """
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', %s::date)::date,
                date_trunc('month', (%s::date - 1))::date,
                interval '1 month'
            )::date AS month
        ),
        revenue AS (
            SELECT
                r.property_id,
                m.month,
                SUM(
                    pay.amount
                    * GREATEST(
                        0,
                        (LEAST(upper(b.stay), (m.month + INTERVAL '1 month')::date, %s::date)
                         - GREATEST(lower(b.stay), m.month, %s::date))
                    )
                    / NULLIF(upper(b.stay) - lower(b.stay), 0)
                ) AS revenue
            FROM bookings b
            JOIN rooms r ON r.room_id = b.room_id
            JOIN payments pay ON pay.booking_id = b.booking_id
            CROSS JOIN months m
            WHERE b.status IN ('confirmed', 'checked_in', 'checked_out')
              AND (%s IS NULL OR r.property_id = %s)
              AND b.stay && daterange(%s, %s, '[)')
            GROUP BY r.property_id, m.month
        ),
        rooms_available AS (
            SELECT
                p.property_id,
                m.month,
                COUNT(r.room_id) * (
                    LEAST((m.month + INTERVAL '1 month')::date, %s::date)
                    - GREATEST(m.month, %s::date)
                ) AS available_nights
            FROM properties p
            JOIN rooms r ON r.property_id = p.property_id
            CROSS JOIN months m
            WHERE (%s IS NULL OR p.property_id = %s)
            GROUP BY p.property_id, m.month
        )
        SELECT
            ra.property_id,
            ra.month,
            COALESCE(rv.revenue, 0) / NULLIF(ra.available_nights, 0)
        FROM rooms_available ra
        LEFT JOIN revenue rv
            ON rv.property_id = ra.property_id
           AND rv.month = ra.month
        ORDER BY ra.property_id, ra.month;
        """,
        (
            from_, to,
            to, from_,
            property_id, property_id,
            from_, to,
            to, from_,
            property_id, property_id,
        ),
    )


    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "property_id": row[0],
                "month": row[1],
                "value": str(row[2] or Decimal("0")),
            }
            for row in rows
        ]
    }


# =========================================================
# GUESTS
# =========================================================

@router.get(
    "/guests",
    response_model=GuestPage,
    tags=["Guests"],
    summary="List Guests",
    description="Returns a paginated list of registered hotel guests. Staff/Manager/Owner only.",
    responses={
        200: {"model": GuestPage, "description": "List of guests"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def list_guests(
    email: str | None = None,
    limit: int = Query(
        20,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        0,
        ge=0,
    ),
    account=Depends(require_staff),
    conn=Depends(db),
):
    cur = conn.cursor()

    if email:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM guests
            WHERE LOWER(email) = LOWER(%s);
            """,
            (email,),
        )
    else:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM guests;
            """
        )

    total = cur.fetchone()[0]

    if email:
        cur.execute(
            """
            SELECT
                guest_id,
                full_name,
                email
            FROM guests
            WHERE LOWER(email) = LOWER(%s)
            ORDER BY guest_id
            LIMIT %s
            OFFSET %s;
            """,
            (
                email,
                limit,
                offset,
            ),
        )
    else:
        cur.execute(
            """
            SELECT
                guest_id,
                full_name,
                email
            FROM guests
            ORDER BY guest_id
            LIMIT %s
            OFFSET %s;
            """,
            (
                limit,
                offset,
            ),
        )

    rows = cur.fetchall()
    cur.close()

    return {
        "items": [
            {
                "guest_id": row[0],
                "full_name": row[1],
                "email": row[2],
            }
            for row in rows
        ],
        "meta": {
            "limit": limit,
            "offset": offset,
            "total": total,
        },
    }


@router.get(
    "/guests/{guest_id}",
    response_model=GuestOut,
    tags=["Guests"],
    summary="Get Guest",
    description="Returns details of a specific guest by ID. Staff/Manager/Owner only.",
    responses={
        200: {"model": GuestOut, "description": "Guest details"},
        401: {"model": ErrorEnvelope, "description": "Authentication required"},
        403: {"model": ErrorEnvelope, "description": "Forbidden"},
        404: {"model": ErrorEnvelope, "description": "Guest not found"},
        422: {"model": ErrorEnvelope, "description": "Validation error"},
    },
)
def get_guest(
    guest_id: int,
    account=Depends(require_staff),
    conn=Depends(db),
):
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            guest_id,
            full_name,
            email
        FROM guests
        WHERE guest_id = %s;
        """,
        (guest_id,),
    )

    row = cur.fetchone()
    cur.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Guest not found",
        )

    return {
        "guest_id": row[0],
        "full_name": row[1],
        "email": row[2],
    }