from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator


# =========================================================
# AUTH
# =========================================================

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# =========================================================
# BOOKINGS
# =========================================================

class BookingRequest(BaseModel):
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


# =========================================================
# PAYMENTS
# =========================================================

class PaymentRequest(BaseModel):
    amount: str
    method: str


# =========================================================
# REVIEWS
# =========================================================

class ReviewRequest(BaseModel):
    rating: int = Field(
        ge=1,
        le=5,
    )
    comment: str | None = None