// Frontend/Administrator/admin.js

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = enforceSessionGuard(["SUPER_ADMIN", "HR_LEAD"]);
    if (!currentUser) return;

    document.getElementById("user-display").innerText = `${currentUser.email} (${currentUser.role})`;
    document.getElementById("logout-btn").addEventListener("click", apiLogout);

    const branchModal = document.getElementById("branch-modal");
    const userModal = document.getElementById("user-modal");

    document.getElementById("open-branch-modal").addEventListener("click", () => branchModal.showModal());
    document.getElementById("close-branch-modal").addEventListener("click", () => branchModal.close());

    document.getElementById("open-user-modal").addEventListener("click", () => userModal.showModal());
    document.getElementById("close-user-modal").addEventListener("click", () => userModal.close());

    await refreshAdminDashboard();

    // POST /branches
    document.getElementById("create-branch-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            code: document.getElementById("branch-code").value.trim(),
            name_en: document.getElementById("branch-name-en").value.trim(),
            name_ur: document.getElementById("branch-name-ur").value.trim(),
            city: document.getElementById("branch-city").value.trim(),
            address_en: document.getElementById("branch-name-en").value.trim() + " Office",
            address_ur: document.getElementById("branch-name-ur").value.trim() + " دفتر"
        };

        try {
            const res = await apiRequest("/branches", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            branchModal.close();
            e.target.reset();
            await loadBranches();
        } catch (err) {
            alert(err.message || "Branch creation failed.");
        }
    });

    // POST /users
    document.getElementById("create-user-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const branchVal = document.getElementById("user-branch-select").value;
        const rawPassword = document.getElementById("user-password").value;
        
        const passwordHash = await hashPassword(rawPassword);

        const payload = {
            branch_id: branchVal ? branchVal : null,
            name: document.getElementById("user-name").value.trim(),
            email: document.getElementById("user-email").value.trim(),
            password_hash: `sha256$1000$salt$${passwordHash}`,
            role: document.getElementById("user-role").value
        };

        try {
            const res = await apiRequest("/users", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            userModal.close();
            e.target.reset();
            await loadUsers();
        } catch (err) {
            alert(err.message || "User creation failed.");
        }
    });
});

async function refreshAdminDashboard() {
    await Promise.all([
        loadBranches(),
        loadUsers(),
        loadAuditLogs()
    ]);
}

async function loadBranches() {
    const tbody = document.getElementById("branches-table-body");
    const branchSelect = document.getElementById("user-branch-select");

    try {
        const res = await apiRequest("/branches/list", { method: "POST" });
        const branches = await handleApiResponse(res);

        document.getElementById("stat-branches-count").innerText = branches.length;
        tbody.innerHTML = "";
        branchSelect.innerHTML = '<option value="">-- System Wide (No Branch) --</option>';

        if (branches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No active branches found.</td></tr>';
            return;
        }

        branches.forEach(b => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><code>${escapeHtml(b.code)}</code></td>
                <td>${escapeHtml(b.name_en)}</td>
                <td>${escapeHtml(b.city)}</td>
                <td><span class="badge ${b.is_active ? 'ok' : 'danger'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${new Date(b.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(row);

            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = `${b.code} - ${b.name_en}`;
            branchSelect.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadUsers() {
    const tbody = document.getElementById("users-table-body");
    try {
        const res = await apiRequest("/users/list", { method: "POST" });
        const users = await handleApiResponse(res);

        document.getElementById("stat-users-count").innerText = users.length;
        tbody.innerHTML = "";

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No system users found.</td></tr>';
            return;
        }

        const roleCounts = {};

        users.forEach(u => {
            roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;

            const row = document.createElement("tr");
            const actionBtn = document.createElement("button");
            actionBtn.className = "small-btn";
            actionBtn.textContent = u.is_active ? "Deactivate" : "Activate";
            actionBtn.addEventListener("click", () => toggleUserActive(u.id, !u.is_active));

            row.innerHTML = `
                <td>${escapeHtml(u.full_name || u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="chip">${escapeHtml(u.role)}</span></td>
                <td><code>${u.branch_id ? escapeHtml(u.branch_id.substring(0, 8)) + '...' : 'System'}</code></td>
                <td><span class="badge ${u.is_active ? 'ok' : 'danger'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td class="action-cell"></td>
            `;
            
            row.querySelector(".action-cell").appendChild(actionBtn);
            tbody.appendChild(row);
        });

        renderRoleDistributionChart(roleCounts);
    } catch (err) {
        console.error(err);
    }
}

async function toggleUserActive(userId, newActiveState) {
    try {
        const res = await apiRequest("/users/active", {
            method: "POST",
            body: JSON.stringify({ user_id: userId, is_active: newActiveState })
        });
        await handleApiResponse(res);
        await loadUsers();
    } catch (err) {
        alert(err.message || "Failed to update user active status.");
    }
}

async function loadAuditLogs() {
    const feed = document.getElementById("audit-feed");
    try {
        const res = await apiRequest("/audit/list", {
            method: "POST",
            body: JSON.stringify({ limit: 10 })
        });

        const logs = await handleApiResponse(res);
        document.getElementById("stat-audit-count").innerText = logs.length;
        feed.innerHTML = "";

        if (logs.length === 0) {
            feed.innerHTML = '<p class="subtext">No audit events logged.</p>';
            return;
        }

        logs.forEach(log => {
            const item = document.createElement("div");
            item.className = "audit-item";
            item.innerHTML = `
                <p><strong>${escapeHtml(log.action)}</strong> on <code>${escapeHtml(log.resource)}</code></p>
                <span class="subtext">${new Date(log.created_at).toLocaleString()}</span>
            `;
            feed.appendChild(item);
        });
    } catch (err) {
        console.error(err);
    }
}

function renderRoleDistributionChart(roleCounts) {
    const labels = Object.keys(roleCounts);
    const series = Object.values(roleCounts);

    if (labels.length > 0 && typeof Chartist !== "undefined") {
        new Chartist.Pie("#roles-chart", {
            labels: labels,
            series: series
        }, {
            donut: true,
            donutWidth: 30,
            showLabel: true
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}