# Ankara Admin — Super Admin / Control Center

Internal ops console for **platform superusers** (`IsPlatformAdmin`) of the Ankara/Daraja
multi-tenant MFI loan SaaS. This is a standalone app, separate from the tenant-facing
`ankaraweb` app — organizations (MFIs) never see or use it.

It faithfully reuses ankaraweb's Daraja design system (verbatim `globals.css` and
`components/ui/`) so the brand green, cream surfaces, radii, and Comic Sans typography are
byte-identical to the tenant app. Everything else — shell, auth, pages, data fetching — is
built fresh against the backend's admin API.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS v4
- shadcn (base-nova style) on top of `@base-ui/react`
- Redux Toolkit (auth state)
- axios (API client with access/refresh token handling)
- Runs on **port 3100** (tenant `ankaraweb` runs on 3000, so both can run side by side)

## Running the admin app

```bash
cd ankara-admin
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE_URL
npm install
npm run dev                        # http://localhost:3100
```

`.env.local.example`:
```
NEXT_PUBLIC_API_BASE_URL=https://ankara.getdaraja.com/api/v1
```

Point it at your backend instead for local work, e.g.:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Backend dependency (IMPORTANT)

This app talks to `ankara-backend`'s `admin_api` — 34 endpoints under `/api/v1/admin/`, all
gated by `IsPlatformAdmin`. As of this writing that backend code exists **uncommitted /
untracked** in `ankara-backend`:

- `admin_api/` (the app itself: views, serializers, urls)
- migration `0007_organization_status…` (adds org status/suspension fields, etc.)
- edits to `auth/models.py`, `core/permissions.py` (adds `IsPlatformAdmin`), `daraja/urls.py`
  (mounts `admin_api` under `/api/v1/admin/`)

To exercise this app end-to-end you need that backend running with the migration applied,
and a **Django superuser with `organization=None`** to log in as (a normal tenant staff user
will not pass `IsPlatformAdmin`).

- Local mysqlclient is known to be broken per project notes — validate/run the backend with
  a SQLite settings override instead (a backend-side concern, outside this app).
- Point `NEXT_PUBLIC_API_BASE_URL` at whichever backend you bring up:
  - Local: `http://localhost:8000/api/v1`
  - Prod: `https://ankara.getdaraja.com/api/v1`

## Type reconciliation caveat

All page TypeScript types (`types/admin.ts` and inline page types) were derived by reading
the actual backend views/serializers in `admin_api/`, but were **not exercised against a
live API** during this build — the backend was never running in this environment. The most
likely spots to need a small adjustment on first live run:

- The login request/response field names (`lib/auth.ts`, `POST /admin/auth/login/`) —
  e.g. `email` vs `username`, exact token key names.
- The JWT refresh path in `lib/axiosInstance.ts` (`POST {BASE}/auth/token/refresh/`).

If login or silent refresh misbehaves against a live backend, reconcile these two spots
first.

## Route map

15 routes under `app/(app)/` (guarded, behind the sidebar shell) plus the public
`app/login/` route. Each row is the primary `admin_api` endpoint(s) the page reads from or
writes to (all under `/api/v1/admin/` unless noted).

| Route | Purpose | Endpoints used |
|---|---|---|
| `/login` | Superuser login | `POST /admin/auth/login/`, `GET /admin/me/`, `POST /auth/token/refresh/` |
| `/` | Overview dashboard — platform KPIs + alerts | `GET /admin/overview/stats/` |
| `/organizations` | Org list — search, status filter, pagination | `GET /admin/organizations/` |
| `/organizations/[id]` | Org detail — portfolio, staff, users, payments, suspend/activate, record payment | `GET /admin/organizations/{id}/`, `POST /admin/organizations/{id}/suspend/`, `POST /admin/organizations/{id}/activate/`, `POST /admin/payments/record/` |
| `/borrowers` | Cross-tenant borrower list — search, pagination | `GET /admin/borrowers/` |
| `/borrowers/[id]` | Borrower detail — profile, KYC, loans, repayments | `GET /admin/borrowers/{id}/` |
| `/loans` | Cross-tenant loan list — status/search filters | `GET /admin/loans/` |
| `/loans/[id]` | Loan detail — schedule, collateral, repayments, status history, adjust | `GET /admin/loans/{id}/`, `POST /admin/loans/{id}/adjust/` |
| `/transactions` | Mtaji ledger list — reverse action per row | `GET /admin/transactions/`, `POST /admin/transactions/{id}/reverse/` |
| `/search` | Global cross-entity search (orgs/borrowers/loans/repayments/payments) | `GET /admin/search/` |
| `/subscriptions` | Packages, discounts, payments (billing ops) | `GET/POST/PATCH/DELETE /admin/packages/`, `GET/POST/PATCH /admin/discounts/`, `GET /admin/payments/`, `GET /admin/overview/stats/` |
| `/support` | Support issue list — filters, create | `GET /admin/issues/`, `POST /admin/issues/` |
| `/support/[id]` | Issue detail — status/priority/assignee, notes thread | `GET /admin/issues/{id}/`, `PATCH /admin/issues/{id}/`, `POST /admin/issues/{id}/notes/` |
| `/system` | System health, recent activity/errors, feature flags | `GET /admin/system/health/`, `POST /admin/system/flags/` |
| `/audit` | Paginated audit log with before/after diff | `GET /admin/audit/` |

Financial-mutation endpoints (`organizations/{id}/suspend|activate`,
`loans/{id}/adjust`, `transactions/{id}/reverse`) all require a `reason` and are gated
behind `DangerousActionModal` confirmations client-side; the backend audits every one.

## Design system

`app/globals.css`, `lib/utils.ts`, and everything in `components/ui/` are **verbatim
copies** of the corresponding files in `ankaraweb`. Do not hand-edit or re-author them —
if they drift, re-copy from `ankaraweb` rather than patching divergently. This byte-identity
is verified as part of the project's acceptance gate (see task 14 verification: globals.css,
lib/utils.ts, and all 24 `components/ui/*` files compare identical to `ankaraweb`, and
`Comic Sans MS` / `#33993C` are present in `globals.css`).

## No mock data, no dead buttons

Every page reads live data through `useAdminResource` (a thin polling/refetch wrapper
around the axios client) and every action button performs a real API call. There is no
mock/dummy/lorem-ipsum data or placeholder array anywhere in `app/`, `components/`, or
`lib/` — this was verified by grep as part of the acceptance gate.
