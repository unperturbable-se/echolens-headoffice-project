// Frontend/Branch/branch.js

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = enforceSessionGuard(["BRANCH_LEAD"]);
    if (!currentUser) return;

    document.getElementById("user-display").innerText = `${currentUser.email} (${currentUser.role})`;
    document.getElementById("logout-btn").addEventListener("click", apiLogout);

    const memberModal = document.getElementById("member-modal");
    const collectionModal = document.getElementById("collection-modal");
    const reportModal = document.getElementById("report-modal");

    document.getElementById("open-member-modal").addEventListener("click", () => memberModal.showModal());
    document.getElementById("close-member-modal").addEventListener("click", () => memberModal.close());

    document.getElementById("open-collection-modal").addEventListener("click", () => collectionModal.showModal());
    document.getElementById("close-collection-modal").addEventListener("click", () => collectionModal.close());

    document.getElementById("open-report-modal").addEventListener("click", () => reportModal.showModal());
    document.getElementById("close-report-modal").addEventListener("click", () => reportModal.close());

    const today = new Date().toISOString().split('T')[0];
    document.getElementById("collection-date").value = today;
    document.getElementById("report-end-date").value = today;

    await refreshBranchDashboard();

    // POST /members
    document.getElementById("add-member-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            branch_id: currentUser.branch_id || null,
            name_en: document.getElementById("member-name-en").value.trim(),
            name_ur: document.getElementById("member-name-ur").value.trim() || document.getElementById("member-name-en").value.trim(),
            cnic: document.getElementById("member-cnic").value.trim() || "N/A",
            phone: document.getElementById("member-phone").value.trim() || "N/A"
        };

        try {
            const res = await apiRequest("/members", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            memberModal.close();
            e.target.reset();
            await loadMembers();
        } catch (err) {
            alert(err.message || "Failed to register member.");
        }
    });

    // POST /collections
    document.getElementById("submit-collection-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            title_en: document.getElementById("collection-title-en").value.trim(),
            title_ur: document.getElementById("collection-title-ur").value.trim() || document.getElementById("collection-title-en").value.trim(),
            amount: parseFloat(document.getElementById("collection-amount").value),
            collection_date: document.getElementById("collection-date").value
        };

        try {
            const res = await apiRequest("/collections", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            collectionModal.close();
            e.target.reset();
            await loadCollections();
        } catch (err) {
            alert(err.message || "Failed to submit collection log.");
        }
    });

    // POST /reports
    document.getElementById("submit-report-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            week_start: document.getElementById("report-start-date").value,
            week_end: document.getElementById("report-end-date").value,
            summary_en: document.getElementById("report-summary-en").value.trim(),
            summary_ur: document.getElementById("report-summary-ur").value.trim() || document.getElementById("report-summary-en").value.trim(),
            total_members_active: parseInt(document.getElementById("report-total-active").value, 10),
            new_registrations: parseInt(document.getElementById("report-new-regs").value, 10)
        };

        try {
            const res = await apiRequest("/reports", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            reportModal.close();
            e.target.reset();
            await loadWeeklyReports();
        } catch (err) {
            alert(err.message || "Failed to submit weekly report.");
        }
    });
});

async function refreshBranchDashboard() {
    await Promise.all([
        loadMembers(),
        loadCollections(),
        loadWeeklyReports()
    ]);
}

async function loadMembers() {
    const tbody = document.getElementById("members-table-body");
    try {
        const res = await apiRequest("/members/list", { method: "POST" });
        const members = await handleApiResponse(res);

        document.getElementById("stat-members-count").innerText = members.length;
        tbody.innerHTML = "";

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No branch members registered.</td></tr>';
            return;
        }

        members.forEach(m => {
            const row = document.createElement("tr");
            const actionBtn = document.createElement("button");
            actionBtn.className = "small-btn";
            actionBtn.textContent = m.is_active ? "Deactivate" : "Activate";
            actionBtn.addEventListener("click", () => toggleMemberActive(m.id, !m.is_active));

            row.innerHTML = `
                <td>${escapeHtml(m.name_en || m.full_name_en)}</td>
                <td dir="rtl">${escapeHtml(m.name_ur || m.full_name_ur || '-')}</td>
                <td><code>${escapeHtml(m.cnic || m.cnic_or_id || '-')}</code></td>
                <td>${escapeHtml(m.phone || '-')}</td>
                <td>${new Date(m.joined_date || m.created_at).toLocaleDateString()}</td>
                <td><span class="badge ${m.is_active ? 'ok' : 'danger'}">${m.is_active ? 'Active' : 'Inactive'}</span></td>
                <td class="action-cell"></td>
            `;

            row.querySelector(".action-cell").appendChild(actionBtn);
            tbody.appendChild(row);
        });

        renderMemberTrajectoryChart(members);
    } catch (err) {
        console.error(err);
    }
}

async function toggleMemberActive(memberId, newActiveState) {
    try {
        const res = await apiRequest("/members/active", {
            method: "POST",
            body: JSON.stringify({ member_id: memberId, is_active: newActiveState })
        });
        await handleApiResponse(res);
        await loadMembers();
    } catch (err) {
        alert(err.message || "Failed to update member status.");
    }
}

async function loadCollections() {
    const tbody = document.getElementById("collections-table-body");
    try {
        const res = await apiRequest("/collections/list", {
            method: "POST",
            body: JSON.stringify({})
        });

        const collections = await handleApiResponse(res);
        document.getElementById("stat-collections-count").innerText = collections.length;
        tbody.innerHTML = "";

        if (collections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No collection logs recorded.</td></tr>';
            return;
        }

        const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

        collections.forEach(c => {
            statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;

            let badgeClass = 'chip';
            if (c.status === 'APPROVED') badgeClass = 'badge ok';
            if (c.status === 'REJECTED') badgeClass = 'badge danger';

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHtml(c.title_en)}</td>
                <td><strong>PKR ${parseFloat(c.amount).toLocaleString()}</strong></td>
                <td>${new Date(c.collection_date).toLocaleDateString()}</td>
                <td><span class="${badgeClass}">${c.status}</span></td>
                <td>${escapeHtml(c.review_notes || '-')}</td>
            `;
            tbody.appendChild(row);
        });

        renderCollectionStatusChart(statusCounts);
    } catch (err) {
        console.error(err);
    }
}

async function loadWeeklyReports() {
    const tbody = document.getElementById("reports-table-body");
    try {
        const res = await apiRequest("/reports/list", { method: "POST" });
        const reports = await handleApiResponse(res);

        document.getElementById("stat-reports-count").innerText = reports.length;
        tbody.innerHTML = "";

        if (reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No weekly reports submitted.</td></tr>';
            return;
        }

        reports.forEach(r => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><code>${r.week_start}</code> to <code>${r.week_end}</code></td>
                <td>${escapeHtml(r.summary_en)}</td>
                <td>${r.total_members_active}</td>
                <td>+${r.new_registrations}</td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
    }
}

function renderMemberTrajectoryChart(members) {
    if (members.length === 0 || typeof Chartist === "undefined") return;

    const monthCounts = {};
    members.forEach(m => {
        const month = new Date(m.joined_date || m.created_at).toLocaleString('default', { month: 'short' });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    new Chartist.Line("#members-chart", {
        labels: Object.keys(monthCounts),
        series: [Object.values(monthCounts)]
    }, {
        low: 0,
        showArea: true
    });
}

function renderCollectionStatusChart(statusCounts) {
    if (typeof Chartist === "undefined") return;

    new Chartist.Pie("#collections-status-chart", {
        labels: ["Pending", "Approved", "Rejected"],
        series: [statusCounts.PENDING, statusCounts.APPROVED, statusCounts.REJECTED]
    }, {
        donut: true,
        donutWidth: 25,
        showLabel: true
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}