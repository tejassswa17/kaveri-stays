from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# =========================================================
# ERROR ENVELOPE (Task 3.10)
# =========================================================

class ErrorDetail(BaseModel):
    loc: list[str | int] = Field(default_factory=list)
    msg: str
    type: str = "error"


class ErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


# =========================================================
# AUTH
# =========================================================

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)


class RegisterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int
    guest_id: int
    email: str
    role: str


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str


class RefreshResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str


class LogoutResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str


class AuthMeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int
    role: str


# =========================================================
# BOOKINGS
# =========================================================

class BookingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    room_id: int = Field(ge=1)
    check_in: date
    check_out: date
    guests: int = Field(ge=1)
    guest_id: int | None = Field(
        default=None,
        ge=1,
    )
    deposit: str | None = None

    @field_validator("check_out")
    @classmethod
    def validate_dates(cls, value, info):
        check_in = info.data.get("check_in")

        if check_in is not None and value <= check_in:
            raise ValueError(
                "check_out must be after check_in"
            )

        return value


class BookingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: int
    guest_id: int
    room_id: int
    check_in: date
    check_out: date
    guests: int
    status: str
    total_amount: str | None = None


# =========================================================
# PAYMENTS
# =========================================================

class PaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: str
    method: str


class PaymentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_id: int
    booking_id: int
    amount: str
    method: str
    created_at: str


class PaymentListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PaymentResponse]
    total_paid: str
    balance: str


# =========================================================
# REVIEWS
# =========================================================

class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int = Field(
        ge=1,
        le=5,
    )
    comment: str | None = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    review_id: int
    booking_id: int
    rating: int
    comment: str | None = None


# =========================================================
# HOME
# =========================================================

class HomeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str