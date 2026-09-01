# Stage 6 — Spec Drift

## 6.1 Hand-written specification vs generated specification

The Stage 3 hand-written specification is:

`03_openapi_original.yaml`

The implementation-generated specification was obtained from:

`GET /openapi.json`

The generated specification was saved locally as:

`openapi_generated.json`

### Path comparison

The original specification contains **18 paths**.

The generated FastAPI specification contains **24 paths**.

### Paths present in both specifications

The following paths are present in both:

- `/properties`
- `/properties/{property_id}`
- `/properties/{property_id}/rooms`
- `/properties/{property_id}/availability`
- `/guests`
- `/guests/{guest_id}`
- `/bookings`
- `/bookings/{booking_id}`
- `/reports/occupancy`
- `/reports/adr`
- `/reports/revpar`
- `/auth/register`
- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/auth/me`

These paths are implemented consistently with the original API surface.

---

## Differences

### 1. Booking status endpoint

Original specification:

`/bookings/{booking_id}/status`

The implemented API does not use one generic status endpoint.

Instead, it provides separate state-transition endpoints:

- `POST /bookings/{booking_id}/check-in`
- `POST /bookings/{booking_id}/check-out`
- `POST /bookings/{booking_id}/cancel`
- `POST /bookings/{booking_id}/no-show`

**Classification: Design/implementation change.**

The implementation deliberately models the booking state machine using explicit actions rather than allowing a caller to submit an arbitrary status.

This makes the allowed transitions clearer and allows authorization rules to be applied separately to each transition.

---

### 2. Payments endpoint

Original specification:

`/payments`

The implemented API uses:

`/bookings/{booking_id}/payments`

**Classification: Design/implementation change.**

Payments are associated with a particular booking, so nesting the payment resource under the booking makes the relationship explicit.

The implementation also provides:

`GET /bookings/{booking_id}/payments`

and

`POST /bookings/{booking_id}/payments`

---

### 3. Root endpoint

The generated specification contains:

`GET /`

The original specification did not contain this endpoint.

**Classification: Implementation addition.**

The endpoint is a simple API home/health response:

`Kaveri Stays API is running`

It does not change the booking or database contract.

---

### 4. Additional `/me` endpoint

The generated specification contains:

`GET /me`

The original specification contains:

`GET /auth/me`

The implementation therefore exposes both endpoints.

**Classification: Implementation addition / API compatibility choice.**

`/auth/me` remains available from the original contract, while `/me` is an additional authenticated endpoint.

---

## Path count summary

| Specification | Number of paths |
|---|---:|
| Original hand-written specification | 18 |
| Generated FastAPI specification | 24 |

The difference is therefore not caused by YAML versus JSON formatting. It represents actual differences in the API surface.

---

# 6.2 Status code audit

The implementation was audited so that status codes which can actually be returned by routes are declared in their FastAPI decorators.

Important examples include:

- `200` for successful GET and state-transition operations
- `201` for successful booking/payment/review creation
- `401` for authentication failures
- `403` for authorization failures
- `404` for resources that do not exist
- `409` for conflicts such as room overlap, duplicate review, idempotency conflicts, and overpayment
- `422` for validation errors

Database errors are handled centrally rather than using separate `IntegrityError` handlers throughout the application.

---

# 6.3 Response models

API routes use response models to control the fields returned to clients.

Database-only or sensitive fields are not exposed through booking, account, guest, or payment responses.

In particular, password hashes and refresh-token hashes are never returned by the API.

The booking detail response therefore contains only the fields intended for API consumers.

---

# 6.4 Documentation

The API uses route summaries, descriptions and tags so that the Swagger UI can be understood by a front-desk user.

The API groups related operations by resource, including:

- Authentication
- Properties
- Bookings
- Payments
- Guests
- Reports

State-changing booking operations are exposed as explicit actions such as check-in, check-out, cancellation and no-show.

---

# 6.12 Authoritative specification

The authoritative API contract is:

`05_openapi_final.yaml`

The FastAPI-generated `/openapi.json` is an implementation-generated specification.

The Postman collection is a consumer and testing artifact.

The three should not be maintained independently without verification.

To prevent drift:

1. Keep `05_openapi_final.yaml` under version control.
2. Generate `/openapi.json` from the running FastAPI application.
3. Compare the generated specification against `05_openapi_final.yaml`.
4. Review any endpoint, parameter, schema or status-code differences.
5. Run the Postman collection against the implemented API.
6. Include the specification and Postman checks in the maintenance/review process.

This makes changes to the API contract deliberate and makes accidental implementation drift easier to detect.