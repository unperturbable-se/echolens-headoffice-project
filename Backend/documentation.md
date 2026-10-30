# ShipLens Platform API

Base URL: `https://your-backend`
Content type: `application/json`
Interactive spec: `/docs`, `/openapi.json`

## Authentication

Endpoints marked **Auth: Bearer** require this header:

```
Authorization: Bearer <token>
```

The token comes from `POST /auth/login`. It is valid for 8 hours. The actor is always derived from the token, never from the request body.

## Response format

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

---

## Quick reference

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

---

## System

### `GET /` and `HEAD /`

Auth: none. Parameters: none.

Response:

```json
{ "status": "online", "message": "ShipLens Management Platform API is running" }
```

### `GET /health`

Auth: none. Parameters: none.

Response:

```json
{ "status": "healthy", "database": "connected" }
```

`database` is `"connected"` or `"disconnected"`.

---

## Auth

### `POST /auth/login`

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

### `POST /auth/logout`

Header: `Authorization: Bearer <token>`. Body: none.

Response: `{ "status": "success" }`

---

## Branches

### `POST /branches`

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

### `POST /branches/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...branches ] }`

---

## Users

### `POST /users`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `branch_id` | UUID | No | Defaults to `null` |
| `name` | string | Yes | 1 to 200 chars |
| `email` | string | Yes | 3 to 254 chars |
| `password_hash` | string | Yes | 1 to 500 chars. Must be pre-hashed, e.g. `pbkdf2_sha256$<iterations>$<salt>$<hex>` |
| `role` | string | Yes | 1 to 50 chars |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

### `POST /users/active`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `user_id` | UUID | Yes |
| `is_active` | boolean | Yes |

Response: `{ "status": "success" }`

### `POST /users/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...users ] }`

---

## Collections

### `POST /collections`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title_en` | string | Yes | 1 to 200 chars |
| `title_ur` | string | Yes | 1 to 200 chars |
| `amount` | decimal | Yes | Greater than 0 |
| `collection_date` | date | Yes | `YYYY-MM-DD` |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

### `POST /collections/review`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `collection_id` | UUID | Yes | |
| `approve` | boolean | Yes | `true` approves, `false` rejects |
| `notes` | string | No | Max 2000 chars |

Response: `{ "status": "success" }`

Errors: `409 collection is not pending`.

### `POST /collections/list`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `status` | string | No | Filter by collection status. Omit for all |

Response: `{ "status": "success", "data": [ ...collections ] }`

---

## Weekly reports

### `POST /reports`

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

### `POST /reports/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...reports ] }`

---

## Members

### `POST /members`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `branch_id` | UUID | No | Defaults to `null` |
| `name_en` | string | Yes | 1 to 200 chars |
| `name_ur` | string | Yes | 1 to 200 chars |
| `cnic` | string | Yes | 1 to 50 chars |
| `phone` | string | Yes | 1 to 50 chars |

Response (201): `{ "status": "success", "data": { "id": "uuid" } }`

### `POST /members/active`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `member_id` | UUID | Yes |
| `is_active` | boolean | Yes |

Response: `{ "status": "success" }`

### `POST /members/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...members ] }`

---

## Notices

### `POST /notices`

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

### `POST /notices/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...notices ] }`

### `POST /notices/published`

Auth: none. Body: none. Public list of published notices.

Response: `{ "status": "success", "data": [ ...notices ] }`

---

## Inquiries

### `POST /inquiries`

Auth: none. Public contact form.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1 to 200 chars |
| `email` | string | Yes | 3 to 254 chars |
| `subject` | string | Yes | 1 to 300 chars |
| `message` | string | Yes | 1 to 5000 chars |

Response (201): `{ "status": "success" }`

### `POST /inquiries/resolve`

Auth: Bearer.

| Field | Type | Required |
|-------|------|----------|
| `inquiry_id` | UUID | Yes |

Response: `{ "status": "success" }`

### `POST /inquiries/list`

Auth: Bearer. Body: none.

Response: `{ "status": "success", "data": [ ...inquiries ] }`

---

## Audit

### `POST /audit/list`

Auth: Bearer.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `limit` | integer | No | 1 to 1000. Default 100 |

Response: `{ "status": "success", "data": [ ...audit logs ] }`

---

## Maintenance

### `POST /maintenance/purge-sessions`

Auth: none. Body: none. Deletes expired sessions.

Response: `{ "status": "success" }`

---

## CORS

Allowed origins come from the `cors_origins` environment variable (comma-separated). Allowed methods: `GET`, `POST`. Allowed headers: `Authorization`, `Content-Type`. Credentials are allowed.

## Response headers

Every response includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`, `Cache-Control: no-store`, and `Pragma: no-cache`.