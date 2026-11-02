# ShipLens Platform: Complete Documentation

## Contents

1. [Architecture overview](#1-architecture-overview)
2. [Backend API](#2-backend-api)
3. [Database layer](#3-database-layer)
4. [Endpoint to database function map](#4-endpoint-to-database-function-map)
5. [Frontend portal](#5-frontend-portal)
6. [CI checks and deployment](#6-ci-checks-and-deployment)

---

## 1. Architecture overview

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Vanilla JS, HTML5, custom CSS (`css/style.css`) | Static site, maritime-themed logistics portal |
| Backend | JSON REST API (interactive spec at `/docs`, `/openapi.json`) | Production: `https://echolens-headoffice-project.onrender.com` |
| Database | PostgreSQL | All logic exposed as functions in the `api` schema |

Request flow: Frontend (`apiRequest`) -> Backend endpoint -> `api.*` PostgreSQL function (via `app_backend` role).

---

## 2. Backend API

Base URL: `https://your-backend`
Content type: `application/json`
Interactive spec: `/docs`, `/openapi.json`

### 2.1 Authentication

Endpoints marked **Auth: Bearer** require this header:

```
Authorization: Bearer <token>
```

The token comes from `POST /auth/login`. It is valid for 8 hours. The actor is always derived from the token, never from the request body.

Passwords are hashed with bcrypt. Clients send plain passwords over HTTPS; the server never accepts pre-made hashes.

### 2.2 Response format

Success:

```json
{ "status": "success", "data": { } }
```

Error:

```json
{ "detail": "message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid request or other database error |
| 401 | Missing, invalid, or expired token, or bad credentials |
| 403 | Forbidden for this role |
| 404 | Not found |
| 409 | Already exists, or collection is not pending |
| 422 | Request body failed validation |
| 500 | Internal error |

### 2.3 Quick reference

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| GET, HEAD | `/` | No | None | 200 |
| GET | `/health` | No | None | 200 |
| POST | `/auth/login` | No | Yes | 200 |
| POST | `/auth/logout` | Header only | None | 200 |
| POST | `/branches` | Bearer | Yes | 201 |
| POST | `/branches/list` | Bearer | None | 200 |
| POST | `/users` | Bearer | Yes | 201 |
| POST | `/users/active` | Bearer | Yes | 200 |
| POST | `/users/list` | Bearer | None | 200 |
| POST | `/collections` | Bearer | Yes | 201 |
| POST | `/collections/review` | Bearer | Yes | 200 |
| POST | `/collections/list` | Bearer | Yes | 200 |
| POST | `/reports` | Bearer | Yes | 201 |
| POST | `/reports/list` | Bearer | None | 200 |
| POST | `/members` | Bearer | Yes | 201 |
| POST | `/members/active` | Bearer | Yes | 200 |
| POST | `/members/list` | Bearer | None | 200 |
| POST | `/notices` | Bearer | Yes | 200 |
| POST | `/notices/list` | Bearer | None | 200 |
| POST | `/notices/published` | No | None | 200 |
| POST | `/inquiries` | No | Yes | 201 |
| POST | `/inquiries/resolve` | Bearer | Yes | 200 |
| POST | `/inquiries/list` | Bearer | None | 200 |
| POST | `/audit/list` | Bearer | Yes | 200 |
| POST | `/maintenance/purge-sessions` | No | None | 200 |

### 2.4 System

#### `GET /` and `HEAD /`

Auth: none. Parameters: none.

```json
{ "status": "online", "message": "ShipLens Management Platform API is running" }
```

#### `GET /health`

Auth: none. Parameters: none.

```json
{ "status": "healthy", "database": "connected" }
```

`database` is `"connected"` or `"disconnected"`.

### 2.5 Auth

#### `POST /auth/login`

Auth: none.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | 3 to 254 chars |
| `password` | string | Yes | 1 to 200 chars |

Response:

```json
{
  "status": "success",
  "data": {
    "token": "string",
    "expires_at": "ISO-8601 datetime",
    "user": { "id": "uuid", "role": "string", "branch_id": "uuid | null" }
  }
}
```

Errors: `401 invalid credentials`.

#### `POST /auth/logout`

Header: `Authorization: Bearer <token>`. Body: none.

Response: `{ "status": "success" }`

### 2.6 Branches

#### `POST /branches`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `code` | string | Yes | 1 to 32 chars |
| `name_en` | string | Yes | 1 to 200 chars |
| `name_ur` | string | Yes | 1 to 200 chars |
| `city` | string | Yes | 1 to 100 chars |
| `address_en` | string | Yes | 1 to 500 chars |
| `address_ur` | string | Yes | 1 to 500 chars |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /branches/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...branches ] }`

### 2.7 Users

#### `POST /users`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `branch_id` | UUID | No | Defaults to `null` |
| `name` | string | Yes | 1 to 200 chars |
| `email` | string | Yes | 3 to 254 chars |
| `password` | string | Yes | 8 to 72 chars. Hashed server-side with bcrypt |
| `role` | string | Yes | 1 to 50 chars |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /users/active`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `user_id` | UUID | Yes |
| `is_active` | boolean | Yes |

Response: `{ "status": "success" }`

#### `POST /users/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...users ] }`

### 2.8 Collections

#### `POST /collections`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title_en` | string | Yes | 1 to 200 chars |
| `title_ur` | string | Yes | 1 to 200 chars |
| `amount` | decimal | Yes | Greater than 0 |
| `collection_date` | date | Yes | `YYYY-MM-DD` |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /collections/review`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `collection_id` | UUID | Yes | |
| `approve` | boolean | Yes | `true` approves, `false` rejects |
| `notes` | string | No | Max 2000 chars |

Response: `{ "status": "success" }`

Errors: `409 collection is not pending`.

#### `POST /collections/list`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `status` | string | No | Filter by collection status. Omit for all |

Response: `{ "status": "success", "data": [ ...collections ] }`

### 2.9 Weekly reports

#### `POST /reports`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `week_start` | date | Yes | `YYYY-MM-DD` |
| `week_end` | date | Yes | `YYYY-MM-DD` |
| `summary_en` | string | Yes | 1 to 5000 chars |
| `summary_ur` | string | Yes | 1 to 5000 chars |
| `total_members_active` | integer | Yes | 0 or greater |
| `new_registrations` | integer | Yes | 0 or greater |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /reports/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...reports ] }`

### 2.10 Members

#### `POST /members`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `branch_id` | UUID | No | Defaults to `null` |
| `name_en` | string | Yes | 1 to 200 chars |
| `name_ur` | string | Yes | 1 to 200 chars |
| `cnic` | string | Yes | 1 to 50 chars |
| `phone` | string | Yes | 1 to 50 chars |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /members/active`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `member_id` | UUID | Yes |
| `is_active` | boolean | Yes |

Response: `{ "status": "success" }`

#### `POST /members/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...members ] }`

### 2.11 Notices

#### `POST /notices`

Auth: Bearer. Creates a notice, or updates one if `notice_id` is given.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `notice_id` | UUID | No | Omit to create, set to update |
| `title_en` | string | Yes | 1 to 200 chars |
| `title_ur` | string | Yes | 1 to 200 chars |
| `content_en` | string | Yes | 1 to 20000 chars |
| `content_ur` | string | Yes | 1 to 20000 chars |
| `publish` | boolean | Yes | `true` publishes, `false` saves as draft |

Response (200): `{ "status": "success", "data": { "id": "uuid" } }`

#### `POST /notices/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...notices ] }`

#### `POST /notices/published`

Auth: none. Body: none. Public list of published notices.

Response: `{ "status": "success", "data": [ ...notices ] }`

### 2.12 Inquiries

#### `POST /inquiries`

Auth: none. Public contact form.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1 to 200 chars |
| `email` | string | Yes | 3 to 254 chars |
| `subject` | string | Yes | 1 to 300 chars |
| `message` | string | Yes | 1 to 5000 chars |

Response (201): `{ "status": "success" }`

#### `POST /inquiries/resolve`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `inquiry_id` | UUID | Yes |

Response: `{ "status": "success" }`

#### `POST /inquiries/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...inquiries ] }`

### 2.13 Audit

#### `POST /audit/list`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `limit` | integer | No | 1 to 1000. Default 100 |

Response: `{ "status": "success", "data": [ ...audit logs ] }`

### 2.14 Maintenance

#### `POST /maintenance/purge-sessions`

Auth: none. Body: none. Deletes expired sessions.

Response: `{ "status": "success" }`

### 2.15 CORS

Allowed origins come from the `cors_origins` environment variable (comma-separated). Allowed methods: `GET`, `POST`. Allowed headers: `Authorization`, `Content-Type`. Credentials are allowed.

### 2.16 Response headers

Every response includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`, `Cache-Control: no-store`, and `Pragma: no-cache`.

---

## 3. Database layer

All database logic lives in PostgreSQL functions under the `api` schema. The backend connects as the `app_backend` role, which is the only role with execute rights.

### 3.1 Function definitions

```sql
CREATE OR REPLACE FUNCTION api.get_login(p_email public.citext)
CREATE OR REPLACE FUNCTION api.create_session(p_user UUID, p_hash CHAR, p_ip INET, p_ua TEXT, p_exp TIMESTAMPTZ)
CREATE OR REPLACE FUNCTION api.validate_session(p_hash CHAR)
CREATE OR REPLACE FUNCTION api.delete_session(p_hash CHAR)
CREATE OR REPLACE FUNCTION api.create_branch(p_actor UUID, p_code TEXT, p_name_en TEXT, p_name_ur TEXT, p_city TEXT, p_addr_en TEXT, p_addr_ur TEXT)
CREATE OR REPLACE FUNCTION api.create_user(p_actor UUID, p_branch UUID, p_name TEXT, p_email public.citext, p_hash TEXT, p_role public.user_role)
CREATE OR REPLACE FUNCTION api.set_user_active(p_actor UUID, p_id UUID, p_active BOOLEAN)
CREATE OR REPLACE FUNCTION api.submit_collection(p_actor UUID, p_title_en TEXT, p_title_ur TEXT, p_amount NUMERIC, p_date DATE)
CREATE OR REPLACE FUNCTION api.review_collection(p_actor UUID, p_id UUID, p_approve BOOLEAN, p_notes TEXT)
CREATE OR REPLACE FUNCTION api.submit_weekly_report(p_actor UUID, p_start DATE, p_end DATE, p_en TEXT, p_ur TEXT, p_active INT, p_new INT)
CREATE OR REPLACE FUNCTION api.add_member(p_actor UUID, p_branch UUID, p_name_en TEXT, p_name_ur TEXT, p_cnic TEXT, p_phone TEXT)
CREATE OR REPLACE FUNCTION api.set_member_active(p_actor UUID, p_id UUID, p_active BOOLEAN)
CREATE OR REPLACE FUNCTION api.save_notice(p_actor UUID, p_id UUID, p_title_en TEXT, p_title_ur TEXT, p_content_en TEXT, p_content_ur TEXT, p_publish BOOLEAN)
CREATE OR REPLACE FUNCTION api.submit_inquiry(p_name TEXT, p_email public.citext, p_subject TEXT, p_message TEXT)
CREATE OR REPLACE FUNCTION api.resolve_inquiry(p_actor UUID, p_id UUID)
CREATE OR REPLACE FUNCTION api.list_branches(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_users(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_collections(p_actor UUID, p_status public.approval_status DEFAULT NULL)
CREATE OR REPLACE FUNCTION api.list_weekly_reports(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_members(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_notices(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_inquiries(p_actor UUID)
CREATE OR REPLACE FUNCTION api.list_audit_logs(p_actor UUID, p_limit INT DEFAULT 100)
CREATE OR REPLACE FUNCTION api.list_published_notices()
```

### 3.2 Permissions

```sql
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api, private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO app_backend;
```

### 3.3 Python call signatures

```python
cur.execute("SELECT * FROM api.get_login(%s::public.citext)", (p_email,))
"SELECT api.create_session(%s::uuid, %s::char, %s::inet, %s, %s::timestamptz)"
cur.execute("SELECT * FROM api.validate_session(%s::char)", (p_hash,))
cur.execute("SELECT api.delete_session(%s::char)", (p_hash,))
"SELECT api.create_branch(%s::uuid, %s, %s, %s, %s, %s, %s)"
"SELECT api.create_user(%s::uuid, %s::uuid, %s, %s::public.citext, %s, %s::public.user_role)"
"SELECT api.set_user_active(%s::uuid, %s::uuid, %s)"
"SELECT api.submit_collection(%s::uuid, %s, %s, %s::numeric, %s::date)"
"SELECT api.review_collection(%s::uuid, %s::uuid, %s, %s)"
"SELECT api.submit_weekly_report(%s::uuid, %s::date, %s::date, %s, %s, %s::int, %s::int)"
"SELECT api.add_member(%s::uuid, %s::uuid, %s, %s, %s, %s)"
"SELECT api.set_member_active(%s::uuid, %s::uuid, %s)"
"SELECT api.save_notice(%s::uuid, %s::uuid, %s, %s, %s, %s, %s)"
"SELECT api.submit_inquiry(%s, %s::public.citext, %s, %s)"
"SELECT api.resolve_inquiry(%s::uuid, %s::uuid)"
cur.execute("SELECT api.list_branches(%s::uuid) AS data", (p_actor,))
cur.execute("SELECT api.list_users(%s::uuid) AS data", (p_actor,))
"SELECT api.list_collections(%s::uuid, %s::public.approval_status) AS data"
cur.execute("SELECT api.list_weekly_reports(%s::uuid) AS data", (p_actor,))
cur.execute("SELECT api.list_members(%s::uuid) AS data", (p_actor,))
cur.execute("SELECT api.list_notices(%s::uuid) AS data", (p_actor,))
cur.execute("SELECT api.list_inquiries(%s::uuid) AS data", (p_actor,))
"SELECT api.list_audit_logs(%s::uuid, %s::int) AS data"
cur.execute("SELECT api.list_published_notices() AS data")
```

---

## 4. Endpoint to database function map

Derived from the function names and the endpoint list above.

| Endpoint | Database function(s) |
|----------|----------------------|
| `POST /auth/login` | `api.get_login`, `api.create_session` |
| `POST /auth/logout` | `api.delete_session` |
| Any Bearer endpoint (token check) | `api.validate_session` |
| `POST /branches` | `api.create_branch` |
| `POST /branches/list` | `api.list_branches` |
| `POST /users` | `api.create_user` |
| `POST /users/active` | `api.set_user_active` |
| `POST /users/list` | `api.list_users` |
| `POST /collections` | `api.submit_collection` |
| `POST /collections/review` | `api.review_collection` |
| `POST /collections/list` | `api.list_collections` |
| `POST /reports` | `api.submit_weekly_report` |
| `POST /reports/list` | `api.list_weekly_reports` |
| `POST /members` | `api.add_member` |
| `POST /members/active` | `api.set_member_active` |
| `POST /members/list` | `api.list_members` |
| `POST /notices` | `api.save_notice` |
| `POST /notices/list` | `api.list_notices` |
| `POST /notices/published` | `api.list_published_notices` |
| `POST /inquiries` | `api.submit_inquiry` |
| `POST /inquiries/resolve` | `api.resolve_inquiry` |
| `POST /inquiries/list` | `api.list_inquiries` |
| `POST /audit/list` | `api.list_audit_logs` |
| `POST /maintenance/purge-sessions` | Not listed in the provided function set |

Parameter naming differences between layers:

| API field | Database parameter |
|-----------|--------------------|
| `collection_id`, `user_id`, `member_id`, `inquiry_id` | `p_id` |
| `notice_id` | `p_id` |
| `collection_date` | `p_date` |
| `week_start`, `week_end` | `p_start`, `p_end` |
| `summary_en`, `summary_ur` | `p_en`, `p_ur` |
| `total_members_active`, `new_registrations` | `p_active`, `p_new` |
| `approve` | `p_approve` |
| `publish` | `p_publish` |
| `is_active` | `p_active` |
| `limit` | `p_limit` |
| `address_en`, `address_ur` | `p_addr_en`, `p_addr_ur` |
| `password` (plain) | `p_hash` (bcrypt, hashed by backend) |
| Actor (from token) | `p_actor` |

---

## 5. Frontend portal

### 5.1 Overview

Maritime-themed logistics portal using Vanilla JS, HTML5, and a custom CSS Design System (`css/style.css`).

### 5.2 Backend integration

Production API: `https://echolens-headoffice-project.onrender.com`

### 5.3 API communication

Centralized in `auth/api.js`. Use `apiRequest(endpoint, options)` for all calls.

- **Request pattern**: Headers auto-inject `Bearer` tokens.
- **Response pattern**: Use `handleApiResponse(response)` to unwrap the `{ status, data, detail }` envelope.

### 5.4 Key endpoints used by the frontend

| Endpoint | Method | Workspace | Purpose |
|:---------|:-------|:----------|:--------|
| `/auth/login` | POST | Login | Authentication |
| `/auth/logout` | POST | All | Logout |
| `/branches/list` | POST | Admin | Branch directory |
| `/branches` | POST | Admin | Provision branch |
| `/users` | POST | Admin | User management |
| `/collections` | POST | Finance/Branch | Ledger operations |
| `/members` | POST | Branch | Membership management |
| `/notices` | POST | Content | Public announcements |
| `/inquiries` | POST | Content | Inquiry resolution |

### 5.5 Development

1. **API**: Ensure the Render backend is reachable.
2. **Pathing**: `appPath()` handles absolute/relative redirection automatically.
3. **Helpers**: `showToast()` for feedback, `showInlineError()` for forms, `resetChart()` for UI updates.

---

## 6. CI checks and deployment

All workflows run on GitHub Actions and live in `.github/workflows/`.

### 6.1 Summary

| Workflow | Triggers | Scope | Purpose |
|----------|----------|-------|---------|
| CodeQL | Push and PR to `master` (paths `Backend/**`, `Frontend/**`), weekly cron `42 7 * * 3` (Wednesday 07:42 UTC) | Backend, Frontend | Security static analysis |
| Backend CI | Push and PR (paths `Backend/**`, `Database/**`) | Backend, Database | Build image, load SQL, health check |
| Ruff | Every push and PR | Whole repo | Python lint |
| Deploy static content to Pages | Push to `master`, manual dispatch | `Frontend` | Publish static site |

### 6.2 CodeQL

Runs a matrix of two jobs with `fail-fast: false`, so one language failing does not cancel the other.

| Language | Path |
|----------|------|
| `python` | `Backend` |
| `javascript-typescript` | `Frontend` |

- Query suite: `security-extended`.
- `build-mode: none`, no build step needed.
- Ignored paths: `**/node_modules`, `**/.venv`.
- Results are uploaded under category `/language:<language>`.
- Permissions: `security-events: write`, `packages: read`, `actions: read`, `contents: read`.

### 6.3 Backend CI

Verifies that the backend container starts against a database built from the SQL files.

Environment:

- PostgreSQL 17 service (`appdb`, user `postgres`) on port 5432, with a `pg_isready` health check (5s interval, 10 retries).
- Both libpq variables (`PGHOST`, `PGUSER`, ...) and app variables (`db_host`, `db_port`, `db_name`, `db_user`, `db_password`) are set.
- `DB_SSLMODE=disable` for the CI database.

Steps:

1. **Checkout** the repo.
2. **Set up Docker Buildx.**
3. **Build image** from `Backend` as `backend:test`, using the GitHub Actions cache (`type=gha`).
4. **Create Supabase roles**: creates `anon` and `authenticated` as `NOLOGIN`, since the SQL references them.
5. **Run SQL files** in order: `Database/schema.sql`, `Database/seed.sql`, `Database/api.sql`. Uses `ON_ERROR_STOP=1`, so any SQL error fails the job.
6. **Run container** with host networking, passing the `db_*` variables and `PORT=8000`.
7. **Health check**: polls `GET /health` up to 30 times, 2 seconds apart, prints container logs, then asserts the body is exactly `{"status":"healthy","database":"connected"}`.

### 6.4 Ruff

- Concurrency group per workflow and ref; a newer run cancels the in-progress one.
- Python 3.12 with pip cache keyed on `Backend/requirements*.txt` and `Backend/pyproject.toml`.
- Command: `ruff check --extend-ignore B008,BLE001 .`
- Ignored rules: `B008` (function calls in argument defaults) and `BLE001` (blind `except`).

### 6.5 Deployment (GitHub Pages)

Deploys only the `Frontend` folder as a static site, with no build step.

1. **Checkout.**
2. **Clean static assets**: removes `Frontend/Documentation.md`, `Frontend/.agents`, and `Frontend/*.json` so they are not published.
3. **Upload artifact** from `./Frontend`.
4. **Deploy** with `actions/deploy-pages@v4`; the page URL is exposed on the `github-pages` environment.

Notes:

- In **Settings, Pages, Build and deployment, Source**, select **GitHub Actions**. Branch-based deployment would serve the repo root regardless of this workflow.
- The folder name `Frontend` is case-sensitive on Linux runners.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Concurrency group `pages` allows one deployment at a time; per the workflow's setting, queued runs are skipped in favor of the latest (`cancel-in-progress: true`), although the inline comment says not to cancel in-progress runs. These two disagree.