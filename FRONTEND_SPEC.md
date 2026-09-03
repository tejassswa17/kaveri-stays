# Frontend Specification — Kaveri Stays Hotel Management System

**Document Version:** 1.0.0  
**Backend Reference:** FastAPI + PostgreSQL (Stages 1–10 Reconciled API, OpenAPI 3.1.0)  
**Target Clients:** Desktop, Tablet, Mobile (Responsive Web Application)

---

## 1. Executive Summary & Goals

Kaveri Stays is a multi-property hotel chain operating across South India (e.g. Ooty, Alleppey, Coorg). The frontend provides a production-grade, highly responsive, and role-tailored hotel management dashboard and booking interface.

### Core Objectives:
1. **Source of Truth Adherence**: Strictly consume existing FastAPI endpoints without inventing endpoints or fabricating mock behaviors.
2. **Dual-Token Authentication**: Secure JWT handling with automatic refresh token rotation (15-minute access token, 7-day single-use rotating refresh token).
3. **Role-Tailored User Experience**: Responsive navigation and views configured for 4 distinct roles (`guest`, `staff`, `manager`, `owner`).
4. **End-to-End Functional Workflows**:
   - Availability search with dynamic rate calculations.
   - Atomic booking creation with strict server-side capacity/rate enforcement.
   - Full booking state machine execution (`confirmed` → `checked_in` → `checked_out`, `cancelled`, `no_show`).
   - Idempotent payment processing with `Idempotency-Key` headers and overpayment protection.
   - Post-stay review submission for checked-out guests.
   - Scoped operational & financial analytics (Occupancy %, ADR, RevPAR).
5. **Zero Spec Drift & Resilience**: Robust handling of all HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`, `503`) with user-friendly error feedback.

---

## 2. User Roles & Access Control Matrix

The backend is the sole security authority. Frontend RBAC drives navigation, accessible routes, and UI affordances.

| Feature / Page | Guest | Staff | Manager | Owner | Backend Endpoint |
|---|:---:|:---:|:---:|:---:|---|
| **Public Property Browse** | ✅ | ✅ | ✅ | ✅ | `GET /properties`, `GET /properties/{id}` |
| **Availability Search** | ✅ | ✅ | ✅ | ✅ | `GET /properties/{id}/availability` |
| **Room Inventory List** | ❌ (403) | ✅ (Assigned Property) | ✅ (Assigned Property) | ✅ (All Properties) | `GET /properties/{id}/rooms` |
| **Guest Self-Registration** | ✅ | ❌ | ❌ | ❌ | `POST /auth/register` |
| **User Login & Session** | ✅ | ✅ | ✅ | ✅ | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me` |
| **Create Booking** | ✅ (Self) | ✅ (With guest_id) | ✅ (With guest_id) | ✅ (With guest_id) | `POST /bookings` |
| **List Bookings** | ✅ (Self only) | ✅ (Assigned Property) | ✅ (Assigned Property) | ✅ (All Properties) | `GET /bookings` |
| **View Booking Details** | ✅ (Self only) | ✅ (Assigned Property) | ✅ (Assigned Property) | ✅ (All Properties) | `GET /bookings/{id}` |
| **Check-In / Check-Out** | ❌ (403) | ✅ | ✅ | ✅ | `POST /bookings/{id}/check-in`, `POST /bookings/{id}/check-out` |
| **No-Show Transition** | ❌ (403) | ✅ | ✅ | ✅ | `POST /bookings/{id}/no-show` |
| **Cancel Booking** | ✅ (Self) | ✅ | ✅ | ✅ | `POST /bookings/{id}/cancel` |
| **List Payments & Balance**| ✅ (Self) | ✅ | ✅ | ✅ | `GET /bookings/{id}/payments` |
| **Record Payment (Idempotent)**| ✅ (Self) | ✅ | ✅ | ✅ | `POST /bookings/{id}/payments` |
| **Submit Post-Stay Review** | ✅ (Checked out) | ❌ (403) | ❌ (403) | ❌ (403) | `POST /bookings/{id}/review` |
| **Guest Directory & Lookup** | ❌ (403) | ✅ | ✅ | ✅ | `GET /guests`, `GET /guests/{id}` |
| **Occupancy Report** | ❌ (403) | ❌ (403) | ✅ (Assigned Property) | ✅ (All Properties) | `GET /reports/occupancy` |
| **ADR & RevPAR Reports** | ❌ (403) | ❌ (403) | ✅ (Assigned Property) | ✅ (All Properties) | `GET /reports/adr`, `GET /reports/revpar` |
| **User Role Assignment** | ❌ | ❌ | ❌ | ❌ | *Not exposed by API (DB Admin only)* |

> **User Management Note**: The backend does not expose user CRUD or role-assignment endpoints. In the Owner views, a dedicated notice will explain:  
> *"Role assignment and staff provisioning currently require backend/database administration; frontend user-management API is not currently exposed."*

---

## 3. Application Architecture & Routes

```
/
├── /login                         # Public Login (Email + Password)
├── /register                      # Public Guest Registration
├── /dashboard                     # Role-Aware Dashboard (Statistics & Quick Actions)
├── /properties                    # Property Catalog
│   └── /properties/:id            # Property Details + Room list (Staff/Mgr/Owner) + Availability
├── /availability                  # Standalone / Global Availability Search
├── /bookings                      # Bookings List (Scoped by Role)
│   ├── /bookings/new              # Create New Booking (Step-by-step wizard)
│   └── /bookings/:id              # Booking Details, State Transitions, Payments, Reviews
├── /guests                        # Guest Directory (Staff, Manager, Owner)
│   └── /guests/:id                # Guest Profile & Booking History
├── /reports                       # Analytics & Reports (Manager, Owner)
│   ├── Occupancy %
│   ├── ADR (Average Daily Rate)
│   └── RevPAR (Revenue Per Available Room)
└── /profile                       # Current User Profile (/me) & Session Details
```

---

## 4. API Integration & Centralized Client Specification

All requests flow through a typed API client configured with an Axios / Fetch interceptor:

### 4.1 Authentication Flow & Token Lifecycle
1. **Login (`POST /auth/login`)**:
   - Accepts `{ email, password }`.
   - Stores `access_token` in memory/secure storage, `refresh_token` in localStorage.
   - Fetches user profile via `GET /me` and stores in `AuthContext`.
2. **Proactive & Reactive Token Refresh (`POST /auth/refresh`)**:
   - Access tokens expire in 15 minutes.
   - Axios response interceptor intercepts `401 Unauthorized` responses.
   - Automatically executes single-use refresh token rotation:
     - If refresh succeeds: updates `access_token` and `refresh_token`, retries the failed request seamlessly.
     - If refresh fails (revoked/expired): clears session state, redirects to `/login` with an informative session-expired message.
3. **Logout (`POST /auth/logout`)**:
   - Calls `POST /auth/logout` with `{ refresh_token }` to revoke token on the server.
   - Clears client-side auth state and redirects to `/login`.

### 4.2 Error Handling & Envelope Parsing
The backend returns standard `ErrorEnvelope`:
```json
{
  "error": "DATABASE_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION_ERROR | RATE_LIMITED | SERVICE_UNAVAILABLE",
  "message": "Human readable description",
  "details": [
    { "loc": ["body", "guests"], "msg": "Guest count exceeds room capacity", "type": "value_error" }
  ]
}
```
The API client transforms backend errors into structured error objects rendered via toast alerts or inline form validation messages.

---

## 5. Page Specifications & Acceptance Criteria

### 5.1 Authentication (`/login`, `/register`)
- **Login**: Email + password inputs, rate-limit alert (429 handling with Retry-After countdown), demo quick-login buttons for testing (Guest, Staff, Manager Ooty, Manager Coorg, Owner).
- **Register**: Full name, email, password (min 8 chars). Successful registration auto-directs to login.
- **Acceptance Criteria**: Form validation occurs before submission; 401 returns unified "Invalid email or password"; 429 informs user to wait.

### 5.2 Role-Aware Dashboard (`/dashboard`)
- **Guest Dashboard**: Displays upcoming and past personal bookings, quick "Book a Room" button, active reservation status cards.
- **Staff Dashboard**: Assigned property room occupancy summary, today's pending check-ins and check-outs, quick guest lookup.
- **Manager Dashboard**: Assigned property operational metrics (Occupancy %, total active stays), quick links to monthly ADR/RevPAR reports.
- **Owner Dashboard**: Multi-property portfolio summary (All properties), aggregated occupancy and revenue KPIs.

### 5.3 Properties & Rooms (`/properties`, `/properties/:id`)
- **List Properties**: Card grid with property name, city badge, star rating, "Check Availability" and "View Rooms" actions.
- **Property Details**: Header with metadata, integrated availability search widget, and room inventory table (for Staff/Manager/Owner) showing Room #, Room Type, Max Occupancy.

### 5.4 Availability & Booking Workflow (`/availability`, `/bookings/new`)
1. **Search Parameters**: Property selector, Check-In date, Check-Out date, optional Room Type filter.
2. **Validation**: Check-out must be after check-in (`to > from`).
3. **Available Room Cards**: Shows room number, type, max occupancy, nightly rate, and computed total rate for the stay.
4. **Booking Form**:
   - Guests: Guest count selector (validated $\le$ max occupancy).
   - Staff/Manager/Owner: Guest selector/lookup dropdown or guest_id input.
   - Optional deposit amount input (validated $\le$ total rate).
5. **Execution**: Submits `POST /bookings`.
6. **Error States**: 409 Conflict ("Room is already taken for these dates"), 422 ("Guest count exceeds room capacity").
7. **Success**: Navigates to `/bookings/:id` with confirmation toast.

### 5.5 Booking Details & Lifecycle Management (`/bookings/:id`)
- **Summary**: Booking ID, Guest ID, Room ID, Check-in / Check-out dates, Guest count, Total calculated amount.
- **Status Badge**: `confirmed` (blue), `checked_in` (emerald), `checked_out` (purple), `cancelled` (rose), `no_show` (amber).
- **Action Toolbar (Role & State Constrained)**:
  - `confirmed` state:
    - Staff/Manager/Owner: **Check In** button (`POST /bookings/{id}/check-in`), **No Show** button (`POST /bookings/{id}/no-show`).
    - Guest & Staff/Manager/Owner: **Cancel Booking** button (`POST /bookings/{id}/cancel`) with confirmation dialog.
  - `checked_in` state:
    - Staff/Manager/Owner: **Check Out** button (`POST /bookings/{id}/check-out`).
  - `checked_out` state:
    - Guest: **Submit Review** button (`POST /bookings/{id}/review` rating 1-5 & comment).
- **Payments Section**: Displays payment installments list (`GET /bookings/{id}/payments`), total paid, remaining balance, and "Record Payment" button triggering payment modal.

### 5.6 Payments Workflow (`POST /bookings/{id}/payments`)
- **Record Payment Modal**: Amount input (prefilled with remaining balance), Method dropdown (`cash`, `card`, `upi`, `bank_transfer`).
- **Idempotency Key**: Auto-generates UUID / cryptographically unique `Idempotency-Key` header per submission to ensure double-clicks never double-charge.
- **Balance Validation**: Rejects amounts exceeding remaining balance with clear UI notice.

### 5.7 Guest Directory (`/guests`, `/guests/:id`)
- Available to Staff, Manager, Owner.
- Paginated table with guest ID, Full Name, Email.
- Search input with email filtering (`GET /guests?email=...`).
- Guest detail view displaying guest profile and quick action to create booking for this guest.

### 5.8 Analytics & Reports (`/reports`)
- Available to Manager (assigned property) and Owner (all properties / selectable property).
- Three core report tabs:
  1. **Occupancy Rate (%)** (`GET /reports/occupancy?from=...&to=...&property_id=...`)
  2. **Average Daily Rate (ADR)** (`GET /reports/adr?from=...&to=...&property_id=...`)
  3. **Revenue Per Available Room (RevPAR)** (`GET /reports/revpar?from=...&to=...&property_id=...`)
- Filter bar: Date range (from/to) + Property dropdown (locked for Manager, selectable for Owner).
- Visual presentation: Formatted data tables + visual comparison bar/metric cards + trend indicators.

---

## 6. UI Design System & Component Specifications

- **Theme & Aesthetic**: Modern, premium hospitality design with rich slate/emerald/amber color accents, sleek dark/light balance, clean typography (Inter / Outfit), crisp borders, and subtle elevation.
- **Component Primitives**:
  - `Button`: Primary, secondary, outline, danger, ghost variants; loading state with spinner.
  - `Input` / `Select`: Floating label or clean stacked label, error message display, icon support.
  - `Modal`: Accessible backdrop, focus trap, ESC key dismiss, smooth scale-in animation.
  - `Table`: Responsive card view on mobile, zebra striping, sorted headers, pagination footer.
  - `Badge`: Status badges for booking status (`confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`), roles (`guest`, `staff`, `manager`, `owner`), and star ratings.
  - `StatCard`: KPI value, title, icon, trend/property indicator.
  - `EmptyState`: Contextual illustration, message, and call-to-action button.
  - `ErrorState`: Alert box with retry action and detailed error messages.
  - `LoadingSkeleton` / `Spinner`: Non-blocking loading states during API queries.
  - `ToastContainer`: Non-intrusive floating feedback notifications for API actions.

---

## 7. Responsiveness & Device Breakpoints

- **Mobile (< 640px)**:
  - Bottom navigation bar or slide-out drawer navigation.
  - Tables convert into structured, touch-friendly card lists.
  - Full-width modal sheets for action dialogs.
- **Tablet (640px - 1024px)**:
  - Collapsible sidebar navigation.
  - 2-column grid cards for properties and dashboard stats.
  - Horizontally scrollable tables with sticky action columns.
- **Desktop (> 1024px)**:
  - Persistent left sidebar with active route highlighting.
  - 3 or 4-column statistical grids and rich data tables.

---

## 8. Verification & Acceptance Checklist

1. **Auth & Security**:
   - Valid credentials log in and persist across reloads.
   - Dual-token rotation silently refreshes expired access tokens.
   - Logout clears tokens and invalidates refresh token server-side.
2. **Scoping & RBAC**:
   - Guest cannot view other guests' data or access staff routes.
   - Staff/Manager cannot view or operate on other properties.
   - Owner can inspect and query all properties and consolidated reports.
3. **Core Workflows**:
   - Availability search correctly reflects existing reservations and GiST exclusion rules.
   - Booking creation succeeds with correct rate plan calculations.
   - State machine buttons appear only for legal transitions.
   - Payments update booking balance with idempotent replay safety.
   - Reviews succeed only post-checkout and reject duplicates.
4. **Code Quality**:
   - 0 TypeScript errors (`tsc --noEmit`).
   - 0 Vite build errors (`npm run build`).
   - Zero console errors or unhandled promise rejections.
