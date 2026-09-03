# Kaveri Stays — Frontend PMS Application

Production-ready, responsive, and role-aware hotel property management frontend built for the **Kaveri Stays FastAPI + PostgreSQL** backend.

---

## 1. Overview & Architecture

The Kaveri Stays frontend provides a complete user experience for guests, hotel staff, property managers, and chain owners. It adheres strictly to the existing backend API models, state machine transitions, and database constraints without introducing mock hotel data, unauthorized role mutations, or artificial endpoints.

### Key Technologies
- **Core**: React 18 + TypeScript 5
- **Tooling**: Vite (with reverse proxy configuration for `/auth`, `/properties`, `/bookings`, `/guests`, `/reports`, `/me`, `/openapi.json`)
- **Styling**: TailwindCSS with curated dark hospitality design tokens (`brand` teal/emerald, indigo, slate, amber, rose)
- **Routing**: `react-router-dom` v6 with role-aware route guards (`ProtectedRoute`)
- **Icons**: `lucide-react`
- **HTTP Client**: `axios` with automatic token injection, single-use refresh token rotation queue, and RFC-compliant error parsing

---

## 2. Quickstart & Running Locally

### Prerequisites
- Node.js (v18+)
- Python (v3.11+) with PostgreSQL server running the `kaveri` database

### Starting the Backend
```bash
# In the project root (c:\Users\tejas\kaveri-api)
.\venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Starting the Frontend
```bash
cd frontend
npm install
npm run dev
```
The application will be available at **`http://127.0.0.1:5173/`**.

### Building for Production
```bash
cd frontend
npm run build
```
Generates a static production bundle in `frontend/dist/`.

---

## 3. Security & Authentication Architecture

### 1. Dual JWT & Single-Use Refresh Token Rotation
- **Access Token**: Short-lived JWT stored in memory / local storage for API authorization.
- **Refresh Token**: Single-use token. When an endpoint returns a `401 Unauthorized`, the Axios response interceptor pauses concurrent requests in a queue (`failedQueue`), triggers `POST /auth/refresh`, updates the token pair, and seamlessly retries the queued requests.
- **Token Invariant**: Old refresh tokens are immediately revoked upon rotation by the backend bcrypt hash ledger.

### 2. Role-Based Access Control (RBAC)
The application dynamically adapts navigation, actions, and API scoping according to the caller's role returned by `GET /me`:

| Feature / Page | Guest | Staff | Manager | Owner |
|---|:---:|:---:|:---:|:---:|
| **Public Registration** (`/register`) | Yes | — | — | — |
| **Email/Password Login** (`/login`) | Yes | Yes | Yes | Yes |
| **Dashboard** (`/dashboard`) | Personal Stats | Assigned Property | Assigned Property | Global KPIs |
| **Properties Catalog** (`/properties`) | View | View | View | View |
| **Room Inventory List** (`/properties/:id`) | Hidden | Scoped | Scoped | Global |
| **Availability & Rates** (`/availability`) | Search | Search | Search | Search |
| **Create Booking** (`/bookings/new`) | Self | On Behalf (Guest Picker) | On Behalf (Guest Picker) | On Behalf (Guest Picker) |
| **Check-In / No-Show** | — | Allowed | Allowed | Allowed |
| **Check-Out** | — | Allowed | Allowed | Allowed |
| **Cancellation** | Self Bookings | Allowed | Allowed | Allowed |
| **Submit Stay Review** | Post-Checkout (Once) | — | — | — |
| **Installment Payments** | Allowed | Desk Payment | Desk Payment | Desk Payment |
| **Guest Directory** (`/guests`) | Hidden | Scoped | Scoped | Global |
| **Analytics & Reports** (`/reports`) | Hidden | Hidden | Assigned Property | All Properties |

> **Administrative Notice**: Role provisioning is maintained directly in the PostgreSQL database. The application does not expose role-assignment APIs or mock role-management UIs.

---

## 4. Core Features & Capabilities

### 1. Booking Creation Wizard (`/bookings/new`)
- Step 1: Select property and check-in / check-out dates.
- Step 2: Live room query displays dynamically priced available rooms with capacity constraints (`max_occupancy`).
- Step 3: For staff/manager, provides a registered guest search/picker. Allows entering an optional initial advance deposit.
- Step 4: Atomically commits reservation and routes to the detailed booking view.

### 2. Booking Lifecycle & State Transitions (`/bookings/:id`)
Enforces the backend state machine:
- `confirmed` $\rightarrow$ `checked_in`, `cancelled`, `no_show`
- `checked_in` $\rightarrow$ `checked_out`
- `checked_out` $\rightarrow$ Allows guest to submit a 1–5 star review and comment (only once per booking).

### 3. Idempotent Payment Installments
- Displays real-time breakdown of calculated total amount, sum of payments made, and remaining balance.
- Recording a payment auto-generates a unique `Idempotency-Key` header (`idem_<uuid>`) to prevent duplicate transactions on network retries.
- Client-side validation prevents payments greater than the remaining balance or less than/equal to zero.

### 4. Operational Analytics & Reports (`/reports`)
- Scoped to managers (for their assigned property) and owners (with a multi-property filter selector).
- Real-time monthly metrics computed server-side:
  - **Occupancy Rate (%)**: Monthly room utilization with visual progress bars.
  - **Average Daily Rate (ADR)**: Average revenue per occupied room.
  - **RevPAR (Revenue per Available Room)**: Overall property yield metric.

---

## 5. Testing & Verification

1. **Static Analysis & Build Verification**:
   - `tsc -b && vite build` passed with **0 errors**.
2. **End-to-End API Proxy Validation**:
   - User registration (`POST /auth/register`) $\rightarrow$ Verified.
   - Authentication & JWT issuance (`POST /auth/login`) $\rightarrow$ Verified.
   - Profile resolution (`GET /me`) $\rightarrow$ Verified.
   - Date availability search (`GET /properties/:id/availability?from=...&to=...`) $\rightarrow$ Verified.
   - Booking creation with deposit (`POST /bookings`) $\rightarrow$ Verified.
   - Multi-installment payments with `Idempotency-Key` (`POST /bookings/:id/payments`) $\rightarrow$ Verified balance decrement.
   - Refresh token single-use rotation and old token revocation (`POST /auth/refresh`) $\rightarrow$ Verified 401 on replay.
