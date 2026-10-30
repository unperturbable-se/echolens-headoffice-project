# ShipLens 1.0 — Frontend Portal

The client-side interface for the ShipLens Branch-to-Head-Office Management
Platform. Built with light, framework-less Web Standards (HTML5, Vanilla
JavaScript) using **Missing.css** for classless UI styling and **Chartist.js**
for SVG analytics charts.

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
│   ├── api_client.js           # Centralized API fetch handlers
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
