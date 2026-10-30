// Frontend/Finance/finance.js

document.addEventListener("DOMContentLoaded", async () => {
    const currentUser = enforceSessionGuard(["FINANCE_REVIEWER"]);
    if (!currentUser) return;

    document.getElementById("user-display").innerText = `${currentUser.email} (${currentUser.role})`;
    document.getElementById("logout-btn").addEventListener("click", apiLogout);

    const reviewModal = document.getElementById("review-modal");
    document.getElementById("close-review-modal").addEventListener("click", () => reviewModal.close());
    document.getElementById("refresh-finance-btn").addEventListener("click", loadFinanceData);

    // POST /collections/review
    document.getElementById("review-collection-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const collectionId = document.getElementById("review-collection-id").value;
        const decisionStr = document.getElementById("review-decision").value;
        const notes = document.getElementById("review-notes").value.trim();

        const isApproved = decisionStr === "APPROVED";

        if (!isApproved && !notes) {
            alert("A review note/reason is strictly required when rejecting a collection.");
            return;
        }

        const payload = {
            collection_id: collectionId,
            approve: isApproved,
            notes: notes || null
        };

        try {
            const res = await apiRequest("/collections/review", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            await handleApiResponse(res);
            reviewModal.close();
            e.target.reset();
            await loadFinanceData();
        } catch (err) {
            alert(err.message || "Failed to submit review decision.");
        }
    });

    await loadFinanceData();
});

async function loadFinanceData() {
    const pendingTbody = document.getElementById("pending-table-body");
    const historyTbody = document.getElementById("history-table-body");

    try {
        const res = await apiRequest("/collections/list", {
            method: "POST",
            body: JSON.stringify({})
        });

        const collections = await handleApiResponse(res);

        pendingTbody.innerHTML = "";
        historyTbody.innerHTML = "";

        let pendingCount = 0;
        let rejectedCount = 0;
        let approvedSum = 0;

        const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
        const branchVolume = {};

        collections.forEach(c => {
            statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
            branchVolume[c.branch_id] = (branchVolume[c.branch_id] || 0) + parseFloat(c.amount);

            if (c.status === "PENDING") {
                pendingCount++;
                const row = document.createElement("tr");
                const actionBtn = document.createElement("button");
                actionBtn.className = "small-btn accent";
                actionBtn.textContent = "Review";
                actionBtn.addEventListener("click", () => openReviewModal(c));

                row.innerHTML = `
                    <td><code>${escapeHtml(c.branch_id.substring(0, 8))}...</code></td>
                    <td>${escapeHtml(c.title_en)}</td>
                    <td><strong>PKR ${parseFloat(c.amount).toLocaleString()}</strong></td>
                    <td>${new Date(c.collection_date).toLocaleDateString()}</td>
                    <td class="action-cell"></td>
                `;

                row.querySelector(".action-cell").appendChild(actionBtn);
                pendingTbody.appendChild(row);

            } else {
                if (c.status === "APPROVED") approvedSum += parseFloat(c.amount);
                if (c.status === "REJECTED") rejectedCount++;

                let badgeClass = c.status === "APPROVED" ? "badge ok" : "badge danger";

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><code>${escapeHtml(c.branch_id.substring(0, 8))}...</code></td>
                    <td>${escapeHtml(c.title_en)}</td>
                    <td>PKR ${parseFloat(c.amount).toLocaleString()}</td>
                    <td><span class="${badgeClass}">${c.status}</span></td>
                    <td>${escapeHtml(c.review_notes || c.notes || '-')}</td>
                    <td>${new Date(c.collection_date).toLocaleDateString()}</td>
                `;
                historyTbody.appendChild(row);
            }
        });

        document.getElementById("stat-pending-count").innerText = pendingCount;
        document.getElementById("stat-approved-sum").innerText = approvedSum.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById("stat-rejected-count").innerText = rejectedCount;

        if (pendingCount === 0) {
            pendingTbody.innerHTML = '<tr><td colspan="5" class="text-center">No pending collection records to review.</td></tr>';
        }

        if (collections.length - pendingCount === 0) {
            historyTbody.innerHTML = '<tr><td colspan="6" class="text-center">No reviewed collection history.</td></tr>';
        }

        renderFinanceCharts(statusCounts, branchVolume);
    } catch (err) {
        console.error(err);
    }
}

function openReviewModal(collection) {
    document.getElementById("review-collection-id").value = collection.id;
    document.getElementById("review-detail-title").innerText = collection.title_en;
    document.getElementById("review-detail-amount").innerText = parseFloat(collection.amount).toLocaleString();
    document.getElementById("review-notes").value = "";
    document.getElementById("review-modal").showModal();
}

function renderFinanceCharts(statusCounts, branchVolume) {
    if (typeof Chartist === "undefined") return;

    new Chartist.Pie("#finance-status-chart", {
        labels: ["Pending", "Approved", "Rejected"],
        series: [statusCounts.PENDING, statusCounts.APPROVED, statusCounts.REJECTED]
    }, {
        donut: true,
        donutWidth: 25,
        showLabel: true
    });

    const branchLabels = Object.keys(branchVolume).map(id => id.substring(0, 6) + "..");
    const branchSeries = Object.values(branchVolume);

    if (branchLabels.length > 0) {
        new Chartist.Bar("#branch-volume-chart", {
            labels: branchLabels,
            series: [branchSeries]
        }, {
            axisX: { offset: 30 },
            axisY: { offset: 40 }
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