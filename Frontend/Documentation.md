# ShipLens Frontend Architecture & API Integration Guide

This document details the module hierarchy, authentication contracts, response wrappers, and endpoint parameter bindings across all frontend workspaces in the ShipLens platform.

---

## 1. Core System & Response Contracts

### Global Response Wrapper Pattern
All API endpoints return data wrapped inside a standardized `{ status: "success", data: ... }` JSON structure or error details `{ detail: "message" }`.

* **Success Contract:** `res.status === "success"` (payload unnested under `res.data`).
* **Error Contract:** Standard HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `500`) with error messaging contained in `detail`.

### Authentication & Token Management
* **Auth Protocol:** Bearer Token via `Authorization: Bearer <token>` HTTP header.
* **Token Lifetime:** Valid for 8 hours. Generated upon `POST /auth/login`.
* **Session Persistence:** Token stored locally and automatically injected into all authenticated API calls by `auth/api_client.js`.
* **RBAC Routing Matrix:**
  * `SUPER_ADMIN` & `HR_LEAD` $\rightarrow$ `/Frontend/Administrator/index.html`
  * `FINANCE_REVIEWER` $\rightarrow$ `/Frontend/Finance/index.html`
  * `BRANCH_LEAD` $\rightarrow$ `/Frontend/Branch/index.html`
  * `CONTENT_EDITOR` $\rightarrow$ `/Frontend/Content/index.html`

---

## 2. Shared Auth Utilities Module (`Frontend/auth/`)

### `api_client.js`
Centralized network transport layer handling Bearer header injection, response parsing, and error normalization.

* **Primary Function:** `apiRequest(endpoint, options)`
* **Authentication Handlers:**
  * `apiLogin(email, password)` $\rightarrow$ `POST /auth/login`
  * `apiLogout()` $\rightarrow$ `POST /auth/logout`

### `session.js` & `login.js`
* **`session.js`:** Enforces route guards on protected pages (`enforceSessionGuard()`), validates active token presence, and redirects unauthorized role tiers.
* **`login.js`:** Captures user inputs from `login.html`, invokes `apiLogin()`, stores returned token and user metadata (`id`, `role`, `branch_id`), and routes to the designated workspace.

---

## 3. Administrator Workspace Module (`Frontend/Administrator/`)

Serves **`SUPER_ADMIN`** and **`HR_LEAD`** roles.

### Primary Responsibilities
1. **Branch Provisioning:** Registering new organizational branches.
2. **User Management:** Creating system users with pre-hashed credentials, assigning roles/branches, and toggling active status.
3. **Audit Log Streams:** Monitoring system activity.

### Bound API Endpoints & Request Signatures

| Operation | Target Path | Method | Parameters & Constraints |
| :--- | :--- | :--- | :--- |
| **List Branches** | `/branches/list` | `POST` | *Body:* None. |
| **Create Branch** | `/branches` | `POST` | `code` (1-32 chars), `name_en` (1-200), `name_ur` (1-200), `city` (1-100), `address_en` (1-500), `address_ur` (1-500). |
| **List Users** | `/users/list` | `POST` | *Body:* None. |
| **Create User** | `/users` | `POST` | `name` (1-200), `email` (3-254), `password_hash` (pre-hashed string), `role` (1-50), `branch_id` (UUID or `null`). |
| **Toggle User Status**| `/users/active` | `POST` | `user_id` (UUID), `is_active` (boolean). |
| **View Audit Logs** | `/audit/list` | `POST` | `limit` (integer 1-1000, default 100). |

---

## 4. Finance Reviewer Workspace Module (`Frontend/Finance/`)

Serves **`FINANCE_REVIEWER`** role.

### Primary Responsibilities
1. **Inspection Queue:** Reviewing pending financial collection submissions.
2. **Approval Workflow:** Approving or rejecting entries (`approve: true/false`). Rejections require optional or mandatory note context (`notes`).
3. **History & Analytics:** Tracking approved monetary volume across branches.

### Bound API Endpoints & Request Signatures

| Operation | Target Path | Method | Parameters & Constraints |
| :--- | :--- | :--- | :--- |
| **List Collections** | `/collections/list` | `POST` | `status` (string filter: `PENDING`, `APPROVED`, `REJECTED`, or omitted for all). |
| **Review Collection**| `/collections/review` | `POST` | `collection_id` (UUID), `approve` (boolean: `true`=Approve, `false`=Reject), `notes` (string, max 2000 chars). |

---

## 5. Branch Lead Workspace Module (`Frontend/Branch/`)

Serves **`BRANCH_LEAD`** role.

### Primary Responsibilities
1. **Branch Membership:** Registering local branch members with CNIC and phone details, toggling member activity.
2. **Collection Logging:** Logging financial drives for Finance review.
3. **Weekly Operations:** Submitting weekly activity digests and member counts.

### Bound API Endpoints & Request Signatures

| Operation | Target Path | Method | Parameters & Constraints |
| :--- | :--- | :--- | :--- |
| **List Members** | `/members/list` | `POST` | *Body:* None. |
| **Add Member** | `/members` | `POST` | `name_en` (1-200), `name_ur` (1-200), `cnic` (1-50), `phone` (1-50), `branch_id` (UUID or `null`). |
| **Toggle Member Status**| `/members/active` | `POST` | `member_id` (UUID), `is_active` (boolean). |
| **Submit Collection**| `/collections` | `POST` | `title_en` (1-200), `title_ur` (1-200), `amount` (decimal > 0), `collection_date` (`YYYY-MM-DD`). |
| **List Collections** | `/collections/list` | `POST` | `status` (string or omitted). |
| **Submit Weekly Report**| `/reports` | `POST` | `week_start` (`YYYY-MM-DD`), `week_end` (`YYYY-MM-DD`), `summary_en` (1-5000), `summary_ur` (1-5000), `total_members_active` (int $\ge 0$), `new_registrations` (int $\ge 0$). |
| **List Reports** | `/reports/list` | `POST` | *Body:* None. |

---

## 6. Content Editor Workspace Module (`Frontend/Content/`)

Serves **`CONTENT_EDITOR`** role.

### Primary Responsibilities
1. **Public Notices:** Creating, drafting, and publishing bilingual notices (`title_en`, `title_ur`, `content_en`, `content_ur`, `publish`).
2. **Inquiry Desk:** Managing public inquiries submitted through the portal and marking them as resolved.

### Bound API Endpoints & Request Signatures

| Operation | Target Path | Method | Parameters & Constraints |
| :--- | :--- | :--- | :--- |
| **Save / Update Notice**| `/notices` | `POST` | `notice_id` (UUID, omit to create), `title_en` (1-200), `title_ur` (1-200), `content_en` (1-20000), `content_ur` (1-20000), `publish` (boolean). |
| **List Notices** | `/notices/list` | `POST` | *Body:* None. |
| **List Inquiries** | `/inquiries/list` | `POST` | *Body:* None. |
| **Resolve Inquiry** | `/inquiries/resolve` | `POST` | `inquiry_id` (UUID). |

---

## 7. Key Data Schema Differences Identified for JS Adaptations

1. **Response Unwrapping:** Every successful API call returns `{ status: "success", data: ... }`. The JS files must extract `json.data` rather than assuming the response array or object is at the top level.
2. **Users Endpoint (`/users`):** Field is `name` (not `full_name`) and requires a pre-hashed string in `password_hash`.
3. **Collections Review (`/collections/review`):** Uses a boolean `approve` (not a string status `"APPROVED"`) and field name `notes` (not `review_notes`).
4. **Members Endpoint (`/members`):** Fields are `name_en`, `name_ur`, `cnic`, `phone` (not `full_name_en` or `cnic_or_id`).
5. **Weekly Reports (`/reports`):** Fields are `week_start` and `week_end` (not `week_start_date` and `week_end_date`).
6. **Notices Endpoint (`/notices`):** Field is `publish` (boolean, not `is_published`), supports updating via optional `notice_id`.