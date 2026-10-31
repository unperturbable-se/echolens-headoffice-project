# ShipLens 1.0 — Frontend Portal

The client-side interface for the ShipLens Branch-to-Head-Office Management
Platform. Built with light, framework-less Web Standards (HTML5, Vanilla
JavaScript) using **Missing.css** for classless UI styling and **Chartist.js**
for SVG analytics charts. The visual layer is a custom maritime operations
design system in `css/style.css` (deep maritime palette, Inter + Plus Jakarta Sans).

---

## Running locally

1. Start the backend API on `http://localhost:8000`.
2. Serve this folder over HTTP (for example `npx serve .` or
   `python3 -m http.server 5500`) and open `login.html`.
3. The API base URL lives in `auth/api.js` (`API_BASE_URL`). The backend
   must allow the frontend origin through CORS, since the two run on different
   ports.

---

## 📂 Folder Structure

```text
Frontend/
├── css/
│   ├── missing.min.css         # Classless UI styling framework
│   └── chartist.min.css        # SVG chart styling
├── js/
│   ├── missing.min.js          # Missing.css UI helper utilities
│   └── chartist.min.js         # Light SVG charting engine
├── auth/
│   ├── api.js           # Centralized API fetch handlers
│   └── session.js              # Session state & RBAC routing logic
├── login.html                  # Primary authentication entrypoint
├── Administrator/              # SUPER_ADMIN & HR_LEAD workspace
│   ├── index.html
│   └── admin.js
├── Finance/                    # FINANCE_REVIEWER workspace
│   ├── index.html
│   └── finance.js
├── Branch/                     # BRANCH_LEAD workspace
│   ├── index.html
│   └── branch.js
└── Content/                    # CONTENT_EDITOR workspace
    ├── index.html
    └── content.js
```
