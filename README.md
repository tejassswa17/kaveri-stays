# Kaveri Stays — Hotel Management REST API

Production-grade, highly secure, and resilient hotel management and reservation REST API built with **FastAPI** and **PostgreSQL**.

---

## 1. System Architecture & Features

- **Database Engine**: PostgreSQL with `btree_gist` extension enforcing GiST temporal exclusion constraints (`no_overlapping_room_bookings` and `no_overlapping_rate_plans`).
- **Connection Management**: Thread-safe `ThreadedConnectionPool` (minconn=1, maxconn=10) with graceful 503 error handling on pool exhaustion.
- **Authentication**: Dual-token JWT architecture (15-minute access token, 7-day single-use rotating refresh token stored as bcrypt hashes).
- **Role-Based Access Control (RBAC)**:
  - `Guest`: Access restricted to self-profile and own bookings/payments/reviews.
  - `Staff`: Scoped to assigned property for room status, check-in, check-out, no-show transitions.
  - `Manager`: Scoped to assigned property for operational analytics (Occupancy %, ADR, RevPAR).
  - `Owner`: Unrestricted cross-property operations and multi-property consolidated reports.
- **Transactional Invariants**:
  - Double-booking prevention via PostgreSQL GiST exclusion constraint.
  - Idempotent payment processing with `Idempotency-Key` header and cumulative overpayment protection.
  - State machine lifecycle (`confirmed` -> `checked_in` -> `checked_out`, `confirmed` -> `cancelled`, `confirmed` -> `no_show`).
  - Verified post-stay single reviews (requires `checked_out` status).
  - Prorated season crossing rate calculations (e.g. Christmas peak pricing).
  - Login rate limiting (429 Too Many Requests) and email enumeration protection.

---

## 2. Project Structure

```
kaveri-api/
├── app/
│   ├── __init__.py
│   ├── auth.py             # JWT token generation, verification & bcrypt hashing
│   ├── database.py         # Threaded connection pool & context managers
│   ├── dependencies.py     # Role verification dependencies (guest, staff, manager, owner)
│   ├── main.py             # FastAPI app, exception handlers, rate limiter, write routes
│   ├── models.py           # Pydantic schemas (extra="forbid") & ErrorEnvelope
│   └── read_api.py         # Read routes, property availability, scoping & analytics
├── tests/
│   └── test_api_stages_5_and_8.py  # Comprehensive 24-test pytest suite (100% pass)
├── scripts/
│   ├── benchmark_stage_9.py        # EXPLAIN ANALYZE index proof & pool saturation test
│   ├── concurrency_test_8_10.py    # Multi-threaded simultaneous race condition test
│   ├── generate_openapi_yaml.py    # Generates reconciled 05_openapi_final.yaml
│   ├── generate_postman_collection.py # Generates 06_postman_collection.json & environments
│   ├── run_auth_matrix.py          # Executes 4-environment authorization matrix
│   └── run_newman.js               # Programmatic Newman test suite runner
├── 01_constraints.md       # Stage 1: Business rules and database constraints
├── 02_auth_design.md       # Stage 2: Authentication & authorization architecture
├── 03_authorization_matrix.md # Stage 3: Normative authorization matrix specification
├── 04_reconciliation.md    # Stage 4: Reconciliation between DB constraints & API models
├── 05_openapi_final.yaml   # Stage 5/6: Reconciled authoritative OpenAPI 3.1.0 specification
├── 06_spec_drift.md        # Stage 6: OpenAPI specification drift analysis
├── 07_authorization_matrix.md # Stage 7: Execution results across 4 environments
├── 08_break_it.md          # Stage 8: Security attacks and positive test executions
├── 09_performance.md       # Stage 9: Performance benchmarks & EXPLAIN ANALYZE proofs
└── README.md
```

---

## 3. Quick Start & Execution

### Prerequisites
- Python 3.11+
- PostgreSQL 14+ with database named `kaveri`
- Node.js 18+ (for Postman/Newman test runner)

### Environment Setup
Create `.env` in project root:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=kaveri
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
```

### Running the API
```bash
# Start FastAPI application with Uvicorn
.\venv\Scripts\uvicorn.exe app.main:app --port 8000 --host 127.0.0.1
```
API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`
OpenAPI JSON Schema: `http://127.0.0.1:8000/openapi.json`

---

## 4. Running Automated Tests & Verification

### 1. Pytest Test Suite & Coverage
```bash
.\venv\Scripts\pytest.exe -v --cov=app --cov-report=term-missing tests/
```
*Result: 24 passed in ~15s (100% pass rate, 73% total coverage).*

### 2. Multi-threaded Concurrency Test (Attack 8.10)
```bash
.\venv\Scripts\python.exe scripts/concurrency_test_8_10.py
```
*Result: Exactly 1 request receives 201 Created; conflicting simultaneous request receives 409 Conflict.*

### 3. EXPLAIN ANALYZE & Connection Pool Saturation
```bash
.\venv\Scripts\python.exe scripts/benchmark_stage_9.py
```
*Result: Proves GiST index usage on `stay` daterange and handles 11th pool connection gracefully.*

### 4. Postman / Newman Collection Runner
```bash
node scripts/run_newman.js
```
*Result: 21 requests executed, 33 assertions passed (0 failures).*

### 5. Authorization Matrix Verification
```bash
.\venv\Scripts\python.exe scripts/run_auth_matrix.py
```
*Result: Verifies full 4-role permission grid across all 15 core endpoints.*
