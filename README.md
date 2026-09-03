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
├── frontend/               # Full React + TypeScript + Tailwind PMS web app
│   ├── src/                # Components, pages, hooks, contexts & API clients
│   ├── package.json        # Frontend dependencies
│   ├── vite.config.ts      # Vite dev server with backend API proxy
│   └── README.md           # Frontend setup & features guide
├── tests/
│   └── test_api_stages_5_and_8.py  # Comprehensive 24-test pytest suite
├── scripts/
│   ├── migrate_to_supabase.py      # Database schema creation & data migration script
│   ├── seed_rate_plans_2026_2027.sql # Rate plans SQL seed data
│   ├── verify_fastapi_with_supabase.py # Backend & Supabase integration check
│   ├── verify_supabase_migration.py    # Supabase migration verification
│   ├── verify_db_config.py         # Database configuration check
│   └── verify_rbac_roles.py        # RBAC role verification utility
├── FRONTEND_README.md      # Frontend architecture & user guide
├── FRONTEND_SPEC.md        # Detailed frontend UI & API specifications
├── FRONTEND_PLAN.md        # Frontend implementation plan
└── README.md
```

---

## 3. Quick Start & Execution

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ / Supabase database

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

### Running the Backend API
```bash
# In the project root
.\venv\Scripts\uvicorn.exe app.main:app --port 8000 --host 127.0.0.1
```
- API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`
- OpenAPI JSON Schema: `http://127.0.0.1:8000/openapi.json`

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://127.0.0.1:5173/`

---

## 4. Running Automated Tests & Verification

### Pytest Test Suite
```bash
.\venv\Scripts\pytest.exe -v tests/
```

### Database Verification
```bash
.\venv\Scripts\python.exe scripts/verify_fastapi_with_supabase.py
```

