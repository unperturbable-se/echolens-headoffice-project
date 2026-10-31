# ShipLens 1.0 Frontend Portal

## Overview
Maritime-themed logistics portal using Vanilla JS, HTML5, and a custom CSS Design System (`css/style.css`).

## Backend Integration
Production API: `https://echolens-headoffice-project.onrender.com`

## API Communication
Centralized in `auth/api.js`. Use `apiRequest(endpoint, options)` for all calls.
- **Request Pattern**: Headers auto-inject `Bearer` tokens.
- **Response Pattern**: Use `handleApiResponse(response)` to unwrap the `{ status, data, detail }` envelope.

## Key Endpoints
| Endpoint | Method | Workspace | Purpose |
| :--- | :--- | :--- | :--- |
| `/auth/login` | POST | Login | Authentication |
| `/auth/logout` | POST | All | Logout |
| `/branches/list` | POST | Admin | Branch directory |
| `/branches` | POST | Admin | Provision branch |
| `/users` | POST | Admin | User management |
| `/collections` | POST | Finance/Branch | Ledger operations |
| `/members` | POST | Branch | Membership management |
| `/notices` | POST | Content | Public announcements |
| `/inquiries` | POST | Content | Inquiry resolution |

## Development
1. **API**: Ensure the Render backend is reachable.
2. **Pathing**: `appPath()` handles absolute/relative redirection automatically.
3. **Helpers**: `showToast()` for feedback, `showInlineError()` for forms, `resetChart()` for UI updates.
