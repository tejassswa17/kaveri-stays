# Frontend Implementation Plan — Kaveri Stays

## 1. Technology Selection & Rationale

- **Framework**: React 18+ with TypeScript
  - *Rationale*: Type-safe component architecture strictly aligned with backend Pydantic models.
- **Build Tool**: Vite
  - *Rationale*: Fast development HMR, optimal bundle generation, and native development server proxy for seamless local API communication.
- **Styling**: Tailwind CSS (PostCSS)
  - *Rationale*: High performance, zero-runtime utility styling enabling a cohesive, premium hospitality design system.
- **Routing**: React Router v6
  - *Rationale*: Declarative client-side routing, nested layouts, and route guards based on authenticated role.
- **Icons**: Lucide React
  - *Rationale*: Lightweight, clean SVG iconography across navigation, stats, and badges.
- **HTTP Client**: Axios with interceptors
  - *Rationale*: Interceptor-based automatic Bearer token injection, single-use refresh token rotation with queue retry, and centralized error normalization.

---

## 2. Proposed Project Structure

```
c:/Users/tejas/kaveri-api/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx                   # Application bootstrap
│   │   ├── App.tsx                    # Root routing & layout provider
│   │   ├── index.css                  # Tailwind directives & theme custom styles
│   │   │
│   │   ├── types/                     # TypeScript types (matching OpenAPI schemas)
│   │   │   ├── auth.ts                # Auth request/response models & User session
│   │   │   ├── property.ts            # Property, Room, Availability models
│   │   │   ├── booking.ts             # Booking, Status enum, Transitions
│   │   │   ├── payment.ts             # Payment installment, PaymentList, Idempotency
│   │   │   ├── review.ts              # Review request/response
│   │   │   ├── guest.ts               # Guest models & pagination
│   │   │   ├── report.ts              # Occupancy, ADR, RevPAR report models
│   │   │   └── api.ts                 # ErrorEnvelope, PageMeta, APIResponse
│   │   │
│   │   ├── api/                       # Centralized API Services
│   │   │   ├── client.ts              # Axios instance with auth & refresh interceptors
│   │   │   ├── auth.ts                # Login, register, refresh, logout, me
│   │   │   ├── properties.ts          # List properties, get property, rooms, availability
│   │   │   ├── bookings.ts            # List, create, get, check-in, check-out, cancel, no-show
│   │   │   ├── payments.ts            # List payments, record payment with Idempotency-Key
│   │   │   ├── reviews.ts             # Create review post-checkout
│   │   │   ├── guests.ts              # List guests with email filter, get guest
│   │   │   └── reports.ts             # Occupancy, ADR, RevPAR reports
│   │   │
│   │   ├── context/                   # Global State Providers
│   │   │   ├── AuthContext.tsx        # Authentication state, current user, login/logout
│   │   │   └── ToastContext.tsx       # Toast notifications dispatch
│   │   │
│   │   ├── hooks/                     # Custom Hooks
│   │   │   ├── useAuth.ts             # Hook to access AuthContext
│   │   │   ├── useToast.ts            # Hook to trigger success/error toasts
│   │   │   └── useAsync.ts            # Lightweight hook for API calls (loading, data, error)
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # Reusable UI Primitives
│   │   │   │   ├── Button.tsx         # Primary, secondary, outline, danger, loading
│   │   │   │   ├── Input.tsx          # Text, date, number with error message
│   │   │   │   ├── Select.tsx         # Form dropdown select
│   │   │   │   ├── Modal.tsx          # Accessible modal dialog
│   │   │   │   ├── Table.tsx          # Responsive data table with mobile card view
│   │   │   │   ├── Badge.tsx          # Status badges (confirmed, checked_in, etc.)
│   │   │   │   ├── Loading.tsx        # Spinner and skeleton loaders
│   │   │   │   ├── EmptyState.tsx     # Clean empty message with action button
│   │   │   │   ├── ErrorState.tsx     # Error banner with retry trigger
│   │   │   │   ├── PageHeader.tsx     # Page title, subtitle, and action button area
│   │   │   │   ├── StatCard.tsx       # Dashboard KPI metric cards
│   │   │   │   └── Toast.tsx          # Toast notification container & item
│   │   │   │
│   │   │   └── layout/                # Layout Components
│   │   │       ├── Layout.tsx         # Main responsive app layout
│   │   │       ├── Sidebar.tsx        # Desktop sidebar with role-aware menu
│   │   │       ├── Navbar.tsx         # Top bar with user profile & mobile toggle
│   │   │       ├── MobileNav.tsx      # Slide-over mobile drawer navigation
│   │   │       └── ProtectedRoute.tsx # Route guard checking auth and allowed roles
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx      # Login form + Quick test login presets
│   │   │   │   └── RegisterPage.tsx   # Guest self-registration
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.tsx  # Role-tailored statistics & recent activity
│   │   │   ├── properties/
│   │   │   │   ├── PropertiesPage.tsx # Properties list with search & star rating
│   │   │   │   └── PropertyDetailPage.tsx # Property details, room list, & availability
│   │   │   ├── availability/
│   │   │   │   └── AvailabilityPage.tsx # Dedicated room search across dates
│   │   │   ├── bookings/
│   │   │   │   ├── BookingsPage.tsx   # Paginated bookings list with status/date filters
│   │   │   │   ├── NewBookingPage.tsx # Multi-step booking creation wizard
│   │   │   │   └── BookingDetailPage.tsx # Details, State actions, Payments, Reviews
│   │   │   ├── guests/
│   │   │   │   ├── GuestsPage.tsx     # Guest directory with email search
│   │   │   │   └── GuestDetailPage.tsx # Guest profile & reservation list
│   │   │   ├── reports/
│   │   │   │   └── ReportsPage.tsx    # Occupancy %, ADR, RevPAR analytics with graphs/tables
│   │   │   ├── profile/
│   │   │   │   └── ProfilePage.tsx    # Current account profile (/me) & permissions
│   │   │   └── NotFoundPage.tsx       # 404 page
│   │   │
│   │   └── utils/
│   │       ├── formatters.ts          # Currency (INR ₹), date formatting, string helpers
│   │       ├── dates.ts               # Date math, validation, default ranges
│   │       └── storage.ts             # LocalStorage token helper with safety checks
```

---

## 3. Implementation Order

### Step 1: Project Setup & Tooling Configuration
- Initialize Vite + React + TypeScript in `frontend/`.
- Configure Tailwind CSS with customized hospitality palette (Emerald, Indigo, Slate, Amber).
- Configure `vite.config.ts` proxy forwarding `/auth`, `/bookings`, `/properties`, `/guests`, `/reports`, `/me` to `http://127.0.0.1:8000`.

### Step 2: TypeScript Interfaces & Centralized API Client
- Create type definitions mirroring Pydantic schemas in `app/models.py` and `app/read_api.py`.
- Configure `src/api/client.ts` Axios instance with Bearer token injection and single-use refresh token rotation queue.
- Implement API modules (`auth.ts`, `properties.ts`, `bookings.ts`, `payments.ts`, `reviews.ts`, `guests.ts`, `reports.ts`).

### Step 3: Authentication Context & Route Guards
- Build `AuthContext` managing access token in memory, refresh token in localStorage, active user profile from `/me`, and role-based helpers (`isGuest`, `isStaff`, `isManager`, `isOwner`).
- Implement `ProtectedRoute` validating authentication status and role access.

### Step 4: Core Reusable UI Component Library
- Implement `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `Loading`, `EmptyState`, `ErrorState`, `PageHeader`, `StatCard`, `Toast`.

### Step 5: Layout Shell & Navigation
- Build `Sidebar`, `Navbar`, `MobileNav`, and `Layout` with role-aware menu filtering:
  - **Guest**: Dashboard, Properties, Check Availability, My Bookings, Profile.
  - **Staff**: Dashboard, Properties & Rooms, Reservations, Check-in/out, Guests, Profile.
  - **Manager**: Dashboard, Properties & Rooms, Reservations, Guests, Reports (Occupancy, ADR, RevPAR), Profile.
  - **Owner**: Dashboard, Properties & Rooms, Reservations, Guests, Consolidated Reports, Profile.

### Step 6: Auth Pages (`/login`, `/register`)
- Implement `LoginPage` with input validation, error envelope handling, 429 countdown, and quick-login demo accounts (`Guest`, `Staff`, `Manager Ooty`, `Manager Coorg`, `Owner`).
- Implement `RegisterPage` for new guest self-registration.

### Step 7: Dashboard Page (`/dashboard`)
- Build role-tailored dashboard:
  - Guest: Active bookings, quick availability check, past stays.
  - Staff: Room status summary, pending check-ins/outs, recent bookings.
  - Manager: Scoped occupancy %, quick ADR/RevPAR overview, property bookings.
  - Owner: Cross-property portfolio overview, aggregate stats, recent bookings.

### Step 8: Properties & Rooms & Availability
- `PropertiesPage`: List of properties with city, star rating, and actions.
- `PropertyDetailPage`: Property header, Room inventory table (for Staff/Manager/Owner), and embedded availability search.
- `AvailabilityPage`: Date range picker, room type filter, availability card grid with nightly & total rates.

### Step 9: Booking Workflow (`/bookings/new`)
- Step-by-step room booking wizard:
  - Select property & dates $\rightarrow$ Check availability $\rightarrow$ Select room $\rightarrow$ Enter guest count & deposit $\rightarrow$ Submit `POST /bookings`.
  - Handle staff/manager/owner assigning guest via guest lookup.
  - Display exact total amount calculated from server-side rate plans.

### Step 10: Bookings Management & State Machine (`/bookings`, `/bookings/:id`)
- `BookingsPage`: Filterable by status (`confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`), date range, and sort order.
- `BookingDetailPage`: Complete booking details, dynamic action buttons for legal transitions:
  - Check-in (`POST /bookings/:id/check-in`)
  - Check-out (`POST /bookings/:id/check-out`)
  - Cancel (`POST /bookings/:id/cancel`)
  - No-show (`POST /bookings/:id/no-show`)
  - Review (`POST /bookings/:id/review` - allowed only for checked-out guests)

### Step 11: Payments Workflow (`/bookings/:id`)
- Embedded payments section in `BookingDetailPage`:
  - List of installments (`GET /bookings/:id/payments`).
  - Total paid vs. Total amount and remaining balance.
  - "Record Payment" modal with auto-generated `Idempotency-Key` header and balance limit verification.

### Step 12: Guests Directory (`/guests`, `/guests/:id`)
- Staff/Manager/Owner guest directory table with real-time email search.
- Guest detail page showing profile details and booking history.

### Step 13: Reports & Analytics (`/reports`)
- Manager and Owner analytics:
  - Occupancy % monthly report table & trend cards.
  - Average Daily Rate (ADR) report.
  - Revenue Per Available Room (RevPAR) report.
  - Date range filtering and property selector (scoped for Manager, global for Owner).

### Step 14: Profile Page (`/profile`)
- Display current user account ID, email, role, full name, assigned property ID, and active token status.

### Step 15: Verification & End-to-End Testing
- Start FastAPI backend + start frontend.
- Execute full test matrix across Guest, Staff, Manager (Ooty), Manager (Coorg), and Owner.
- Verify responsive layout on Mobile (375px), Tablet (768px), Desktop (1280px).
- Verify build with `tsc --noEmit` and `npm run build`.

### Step 16: Documentation & Deliverables
- Create `FRONTEND_README.md` with complete installation, run scripts, configuration, and limitations.
