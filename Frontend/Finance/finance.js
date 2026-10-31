// Finance workspace controller

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = enforceSessionGuard(["FINANCE_REVIEWER"]);
  if (!currentUser) return;

  document.getElementById("user-display").innerText =
    `${currentUser.email} (${currentUser.role})`;
  document.getElementById("logout-btn").addEventListener("click", apiLogout);

  const reviewModal = document.getElementById("review-modal");
  document.getElementById("close-review-modal").addEventListener(
    "click",
    () => reviewModal.close(),
  );
  document.getElementById("refresh-finance-btn").addEventListener(
    "click",
    loadFinanceData,
  );

  // POST /collections/review
  document.getElementById("review-collection-form").addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const reviewError = document.getElementById("review-error");
      reviewError.style.display = "none";

      const collectionId =
        document.getElementById("review-collection-id").value;
      const decisionStr = document.getElementById("review-decision").value;
      const notes = document.getElementById("review-notes").value.trim();

      const isApproved = decisionStr === "APPROVED";

      if (!isApproved && !notes) {
        showInlineError(
          reviewError,
          "Add a note explaining why this collection is rejected.",
        );
        document.getElementById("review-notes").focus();
        return;
      }

      const payload = {
        collection_id: collectionId,
        approve: isApproved,
        notes: notes || null,
      };

      try {
        const res = await apiRequest("/collections/review", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await handleApiResponse(res);
        reviewModal.close();
        e.target.reset();
        showToast(
          isApproved ? "Collection approved." : "Collection rejected.",
          "success",
        );
        await loadFinanceData();
      } catch (err) {
        showInlineError(
          reviewError,
          err.message || "Could not save the review decision.",
        );
      }
    },
  );

  await loadFinanceData();
});

async function loadFinanceData() {
  const pendingTbody = document.getElementById("pending-table-body");
  const historyTbody = document.getElementById("history-table-body");

  try {
    const res = await apiRequest("/collections/list", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const collections = await handleApiResponse(res);

    pendingTbody.innerHTML = "";
    historyTbody.innerHTML = "";

    let pendingCount = 0;
    let rejectedCount = 0;
    let approvedSum = 0;

    const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    const branchVolume = {};

    collections.forEach((c) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      const branchKey = c.branch_name || c.branch_id || "Unassigned";
      branchVolume[branchKey] = (branchVolume[branchKey] || 0) +
        parseFloat(c.amount || 0);

      if (c.status === "PENDING") {
        pendingCount++;
        const row = document.createElement("tr");
        const actionBtn = document.createElement("button");
        actionBtn.className = "small-btn accent";
        actionBtn.textContent = "Review";
        actionBtn.addEventListener("click", () => openReviewModal(c));

        row.innerHTML = `
                    <td>${branchCell(c)}</td>
                    <td>${escapeHtml(c.title_en)}</td>
                    <td><strong>PKR ${
          parseFloat(c.amount || 0).toLocaleString()
        }</strong></td>
                    <td>${formatDate(c.collection_date)}</td>
                    <td class="action-cell"></td>
                `;

        row.querySelector(".action-cell").appendChild(actionBtn);
        pendingTbody.appendChild(row);
      } else {
        if (c.status === "APPROVED") {
          approvedSum += parseFloat(c.amount || 0);
        }
        if (c.status === "REJECTED") rejectedCount++;

        let badgeClass = c.status === "APPROVED" ? "badge ok" : "badge danger";

        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${branchCell(c)}</td>
                    <td>${escapeHtml(c.title_en)}</td>
                    <td>PKR ${parseFloat(c.amount || 0).toLocaleString()}</td>
                    <td><span class="${badgeClass}">${
          escapeHtml(c.status)
        }</span></td>
                    <td>${escapeHtml(c.review_notes || c.notes || "-")}</td>
                    <td>${formatDate(c.collection_date)}</td>
                `;
        historyTbody.appendChild(row);
      }
    });

    document.getElementById("stat-pending-count").innerText = pendingCount;
    document.getElementById("stat-approved-sum").innerText = approvedSum
      .toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById("stat-rejected-count").innerText = rejectedCount;

    if (pendingCount === 0) {
      pendingTbody.innerHTML =
        '<tr><td colspan="5" class="text-center">Nothing is waiting for review.</td></tr>';
    }

    if (collections.length - pendingCount === 0) {
      historyTbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No reviewed collections yet.</td></tr>';
    }

    renderFinanceCharts(statusCounts, branchVolume);
  } catch (err) {
    console.error(err);
    renderLoadError(pendingTbody, 5, "the review queue");
    renderLoadError(historyTbody, 6, "the review history");
    resetChart("#finance-status-chart");
    document.querySelector("#finance-status-chart").innerHTML =
      '<p class="subtext">Review mix is unavailable right now.</p>';
    resetChart("#branch-volume-chart");
    document.querySelector("#branch-volume-chart").innerHTML =
      '<p class="subtext">Branch volume is unavailable right now.</p>';
  }
}

function openReviewModal(collection) {
  document.getElementById("review-collection-id").value = collection.id;
  document.getElementById("review-error").style.display = "none";
  document.getElementById("review-detail-title").innerText =
    collection.title_en || "-";
  document.getElementById("review-detail-amount").innerText = parseFloat(
    collection.amount || 0,
  ).toLocaleString();
  document.getElementById("review-notes").value = "";
  document.getElementById("review-decision").value = "APPROVED";
  document.getElementById("review-modal").showModal();
}

/**
 * Branch is shown by name when the API provides one, with the full ID
 * available on hover instead of a permanently truncated ghost value.
 */
function branchCell(collection) {
  if (collection.branch_name) return escapeHtml(collection.branch_name);
  if (!collection.branch_id) return '<span class="subtext">Unassigned</span>';
  return `<span class="uuid" title="${
    escapeHtml(collection.branch_id)
  }" tabindex="0">${escapeHtml(collection.branch_id.substring(0, 8))}…</span>`;
}

function renderFinanceCharts(statusCounts, branchVolume) {
  if (typeof Chartist === "undefined") return;

  resetChart("#finance-status-chart");
  new Chartist.Pie("#finance-status-chart", {
    labels: ["Pending", "Approved", "Rejected"],
    series: [
      statusCounts.PENDING,
      statusCounts.APPROVED,
      statusCounts.REJECTED,
    ],
  }, {
    donut: true,
    donutWidth: 25,
    showLabel: true,
  });

  const branchLabels = Object.keys(branchVolume).map((label) =>
    label.length > 12 ? label.substring(0, 12) + "…" : label
  );
  const branchSeries = Object.values(branchVolume);

  resetChart("#branch-volume-chart");

  if (branchLabels.length === 0) {
    document.querySelector("#branch-volume-chart").innerHTML =
      '<p class="subtext">No collections to chart yet.</p>';
    return;
  }

  new Chartist.Bar("#branch-volume-chart", {
    labels: branchLabels,
    series: [branchSeries],
  }, {
    axisX: { offset: 30 },
    axisY: { offset: 40 },
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
