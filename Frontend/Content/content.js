// Frontend/Content/content.js

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = enforceSessionGuard(["CONTENT_EDITOR"]);
    if (!currentUser) return;

    document.getElementById("user-display").innerText = `${currentUser.email} (${currentUser.role})`;
    document.getElementById("logout-btn").addEventListener("click", apiLogout);

    const noticeModal = document.getElementById("notice-modal");

    document.getElementById("open-notice-modal").addEventListener("click", () => noticeModal.showModal());
    document.getElementById("close-notice-modal").addEventListener("click", () => noticeModal.close());

    await refreshContentDashboard();

    // POST /notices
    document.getElementById("save-notice-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            title_en: document.getElementById("notice-title-en").value.trim(),
            title_ur: document.getElementById("notice-title-ur").value.trim(),
            content_en: document.getElementById("notice-content-en").value.trim(),
            content_ur: document.getElementById("notice-content-ur").value.trim(),
            publish: document.getElementById("notice-publish-toggle").checked
        };

        try {
            const res = await apiRequest("/notices", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            noticeModal.close();
            e.target.reset();
            await loadNotices();
        } catch (err) {
            alert(err.message || "Failed to save notice.");
        }
    });
});

async function refreshContentDashboard() {
    await Promise.all([
        loadNotices(),
        loadInquiries()
    ]);
}

async function loadNotices() {
    const tbody = document.getElementById("notices-table-body");
    try {
        const res = await apiRequest("/notices/list", { method: "POST" });
        const notices = await handleApiResponse(res);

        document.getElementById("stat-notices-count").innerText = notices.length;
        tbody.innerHTML = "";

        if (notices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No notices created yet.</td></tr>';
            return;
        }

        let publishedCount = 0;

        notices.forEach(n => {
            if (n.is_published || n.publish) publishedCount++;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHtml(n.title_en)}</td>
                <td dir="rtl">${escapeHtml(n.title_ur)}</td>
                <td><span class="badge ${(n.is_published || n.publish) ? 'ok' : 'chip'}">${(n.is_published || n.publish) ? 'Published' : 'Draft'}</span></td>
                <td>${n.published_at ? new Date(n.published_at).toLocaleString() : '-'}</td>
                <td>${new Date(n.created_at).toLocaleDateString()}</td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById("stat-published-count").innerText = publishedCount;
        renderNoticeChart(publishedCount, notices.length - publishedCount);
    } catch (err) {
        console.error(err);
    }
}

async function loadInquiries() {
    const tbody = document.getElementById("inquiries-table-body");
    try {
        const res = await apiRequest("/inquiries/list", { method: "POST" });
        const inquiries = await handleApiResponse(res);

        tbody.innerHTML = "";

        if (inquiries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No public inquiries found.</td></tr>';
            document.getElementById("stat-inquiries-count").innerText = 0;
            return;
        }

        let unresolvedCount = 0;

        inquiries.forEach(inq => {
            if (!inq.is_resolved) unresolvedCount++;

            const row = document.createElement("tr");
            const actionBtn = document.createElement("button");
            actionBtn.className = "small-btn accent";
            actionBtn.textContent = inq.is_resolved ? "Resolved" : "Mark Resolved";
            actionBtn.disabled = inq.is_resolved;
            
            if (!inq.is_resolved) {
                actionBtn.addEventListener("click", () => resolveInquiry(inq.id));
            }

            row.innerHTML = `
                <td><strong>${escapeHtml(inq.sender_name || inq.name)}</strong><br><small class="subtext">${escapeHtml(inq.sender_email || inq.email)}</small></td>
                <td>${escapeHtml(inq.subject || 'General Inquiry')}</td>
                <td>${escapeHtml(inq.message)}</td>
                <td><span class="badge ${inq.is_resolved ? 'ok' : 'danger'}">${inq.is_resolved ? 'Resolved' : 'Pending'}</span></td>
                <td>${new Date(inq.created_at).toLocaleDateString()}</td>
                <td class="action-cell"></td>
            `;

            row.querySelector(".action-cell").appendChild(actionBtn);
            tbody.appendChild(row);
        });

        document.getElementById("stat-inquiries-count").innerText = unresolvedCount;
        renderInquiryChart(inquiries.length - unresolvedCount, unresolvedCount);
    } catch (err) {
        console.error(err);
    }
}

async function resolveInquiry(inquiryId) {
    try {
        const res = await apiRequest("/inquiries/resolve", {
            method: "POST",
            body: JSON.stringify({ inquiry_id: inquiryId })
        });
        await handleApiResponse(res);
        await loadInquiries();
    } catch (err) {
        alert(err.message || "Failed to mark inquiry as resolved.");
    }
}

function renderNoticeChart(published, drafts) {
    if (typeof Chartist === "undefined") return;

    new Chartist.Pie("#notice-status-chart", {
        labels: ["Published", "Drafts"],
        series: [published, drafts]
    }, {
        donut: true,
        donutWidth: 25,
        showLabel: true
    });
}

function renderInquiryChart(resolved, pending) {
    if (typeof Chartist === "undefined") return;

    new Chartist.Pie("#inquiry-status-chart", {
        labels: ["Resolved", "Pending"],
        series: [resolved, pending]
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