// Branch workspace controller

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = enforceSessionGuard(["BRANCH_LEAD"]);
  if (!currentUser) return;

  document.getElementById("user-display").innerText =
    `${currentUser.email} (${currentUser.role})`;
  document.getElementById("logout-btn").addEventListener("click", apiLogout);

  const memberModal = document.getElementById("member-modal");
  const collectionModal = document.getElementById("collection-modal");
  const reportModal = document.getElementById("report-modal");

  document.getElementById("open-member-modal").addEventListener(
    "click",
    () => {
      document.getElementById("member-error").style.display = "none";
      memberModal.showModal();
    },
  );
  document.getElementById("close-member-modal").addEventListener(
    "click",
    () => memberModal.close(),
  );

  document.getElementById("open-collection-modal").addEventListener(
    "click",
    () => {
      document.getElementById("collection-error").style.display = "none";
      collectionModal.showModal();
    },
  );
  document.getElementById("close-collection-modal").addEventListener(
    "click",
    () => collectionModal.close(),
  );

  document.getElementById("open-report-modal").addEventListener(
    "click",
    () => {
      document.getElementById("report-error").style.display = "none";
      reportModal.showModal();
    },
  );
  document.getElementById("close-report-modal").addEventListener(
    "click",
    () => reportModal.close(),
  );

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("collection-date").value = today;
  document.getElementById("report-end-date").value = today;

  wireCnicFormatting();
  wirePhoneFormatting();

  await refreshBranchDashboard();

  // POST /members
  document.getElementById("add-member-form").addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const memberError = document.getElementById("member-error");
      memberError.style.display = "none";

      const cnic = document.getElementById("member-cnic").value.trim();
      const phone = document.getElementById("member-phone").value.trim();

      if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
        showInlineError(
          memberError,
          "Enter the CNIC as 13 digits: 42101-1234567-1.",
        );
        document.getElementById("member-cnic").focus();
        return;
      }

      if (!/^\+92 \d{3} \d{7}$/.test(phone)) {
        showInlineError(memberError, "Enter the phone as +92 300 1234567.");
        document.getElementById("member-phone").focus();
        return;
      }

      const payload = {
        branch_id: currentUser.branch_id || null,
        name_en: document.getElementById("member-name-en").value.trim(),
        name_ur: document.getElementById("member-name-ur").value.trim() ||
          document.getElementById("member-name-en").value.trim(),
        cnic: cnic,
        phone: phone,
      };

      try {
        const res = await apiRequest("/members", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await handleApiResponse(res);
        memberModal.close();
        e.target.reset();
        await loadMembers();
        showToast("Member registered.", "success");
      } catch (err) {
        showInlineError(
          memberError,
          err.message || "Could not register this member.",
        );
      }
    },
  );

  // POST /collections
  document.getElementById("submit-collection-form").addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const collectionError = document.getElementById("collection-error");
      collectionError.style.display = "none";

      const amount = parseFloat(
        document.getElementById("collection-amount").value,
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        showInlineError(
          collectionError,
          "Enter a collection amount above zero.",
        );
        document.getElementById("collection-amount").focus();
        return;
      }

      const payload = {
        title_en: document.getElementById("collection-title-en").value.trim(),
        title_ur: document.getElementById("collection-title-ur").value.trim() ||
          document.getElementById("collection-title-en").value.trim(),
        amount: amount,
        collection_date: document.getElementById("collection-date").value,
      };

      try {
        const res = await apiRequest("/collections", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await handleApiResponse(res);
        collectionModal.close();
        e.target.reset();
        document.getElementById("collection-date").value = today;
        await loadCollections();
        showToast("Collection sent for finance review.", "success");
      } catch (err) {
        showInlineError(
          collectionError,
          err.message || "Could not submit this collection.",
        );
      }
    },
  );

  // POST /reports
  document.getElementById("submit-report-form").addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const reportError = document.getElementById("report-error");
      reportError.style.display = "none";

      const weekStart = document.getElementById("report-start-date").value;
      const weekEnd = document.getElementById("report-end-date").value;

      if (weekStart && weekEnd && weekEnd < weekStart) {
        showInlineError(
          reportError,
          "The week end date cannot be before the week start date.",
        );
        document.getElementById("report-end-date").focus();
        return;
      }

      const payload = {
        week_start: weekStart,
        week_end: weekEnd,
        summary_en: document.getElementById("report-summary-en").value.trim(),
        summary_ur: document.getElementById("report-summary-ur").value.trim() ||
          document.getElementById("report-summary-en").value.trim(),
        total_members_active: parseInt(
          document.getElementById("report-total-active").value,
          10,
        ),
        new_registrations: parseInt(
          document.getElementById("report-new-regs").value,
          10,
        ),
      };

      try {
        const res = await apiRequest("/reports", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await handleApiResponse(res);
        reportModal.close();
        e.target.reset();
        document.getElementById("report-end-date").value = today;
        await loadWeeklyReports();
        showToast("Weekly report submitted.", "success");
      } catch (err) {
        showInlineError(
          reportError,
          err.message || "Could not submit this weekly report.",
        );
      }
    },
  );
});

/**
 * Format CNIC input as 42101-1234567-1 while typing.
 */
function wireCnicFormatting() {
  const input = document.getElementById("member-cnic");
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 13);
    let formatted = digits;
    if (digits.length > 5) formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    if (digits.length > 12) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${
        digits.slice(12)
      }`;
    }
    input.value = formatted;
  });
}

/**
 * Format phone input as +92 300 1234567 while typing.
 */
function wirePhoneFormatting() {
  const input = document.getElementById("member-phone");
  input.addEventListener("input", () => {
    let digits = input.value.replace(/\D/g, "");
    if (digits.startsWith("92")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    let formatted = "+92";
    if (digits.length > 0) formatted += ` ${digits.slice(0, 3)}`;
    if (digits.length > 3) formatted += ` ${digits.slice(3)}`;
    input.value = formatted;
  });
}

async function refreshBranchDashboard() {
  await Promise.all([
    loadMembers(),
    loadCollections(),
    loadWeeklyReports(),
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
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center">No members yet. Register the first member.</td></tr>';
      return;
    }

    members.forEach((m) => {
      const row = document.createElement("tr");
      const actionBtn = document.createElement("button");
      actionBtn.className = "small-btn";
      actionBtn.textContent = m.is_active ? "Deactivate" : "Activate";
      actionBtn.addEventListener(
        "click",
        () => toggleMemberActive(m.id, !m.is_active),
      );

      row.innerHTML = `
                <td>${escapeHtml(m.name_en || m.full_name_en)}</td>
                <td dir="rtl">${
        escapeHtml(m.name_ur || m.full_name_ur || "-")
      }</td>
                <td><code>${escapeHtml(m.cnic || m.cnic_or_id || "-")}</code></td>
                <td>${escapeHtml(m.phone || "-")}</td>
                <td>${formatDate(m.joined_date || m.created_at)}</td>
                <td><span class="badge ${m.is_active ? "ok" : "danger"}">${
        m.is_active ? "Active" : "Inactive"
      }</span></td>
                <td class="action-cell"></td>
            `;

      row.querySelector(".action-cell").appendChild(actionBtn);
      tbody.appendChild(row);
    });

    renderMemberTrajectoryChart(members);
  } catch (err) {
    console.error(err);
    renderLoadError(tbody, 7, "branch members");
    document.getElementById("stat-members-count").innerText = "–";
    resetChart("#members-chart");
    document.querySelector("#members-chart").innerHTML =
      '<p class="subtext">Member growth is unavailable right now.</p>';
  }
}

async function toggleMemberActive(memberId, newActiveState) {
  try {
    const res = await apiRequest("/members/active", {
      method: "POST",
      body: JSON.stringify({ member_id: memberId, is_active: newActiveState }),
    });
    await handleApiResponse(res);
    await loadMembers();
    showToast(
      newActiveState ? "Member reactivated." : "Member deactivated.",
      "success",
    );
  } catch (err) {
    showToast(err.message || "Could not update member status.");
  }
}

async function loadCollections() {
  const tbody = document.getElementById("collections-table-body");
  try {
    const res = await apiRequest("/collections/list", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const collections = await handleApiResponse(res);
    document.getElementById("stat-collections-count").innerText =
      collections.length;
    tbody.innerHTML = "";

    if (collections.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center">No collections logged yet.</td></tr>';
      return;
    }

    const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

    collections.forEach((c) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;

      let badgeClass = "chip";
      if (c.status === "APPROVED") badgeClass = "badge ok";
      if (c.status === "REJECTED") badgeClass = "badge danger";

      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${escapeHtml(c.title_en)}</td>
                <td><strong>PKR ${
        parseFloat(c.amount || 0).toLocaleString()
      }</strong></td>
                <td>${formatDate(c.collection_date)}</td>
                <td><span class="${badgeClass}">${
        escapeHtml(c.status)
      }</span></td>
                <td>${escapeHtml(c.review_notes || c.notes || "-")}</td>
            `;
      tbody.appendChild(row);
    });

    renderCollectionStatusChart(statusCounts);
  } catch (err) {
    console.error(err);
    renderLoadError(tbody, 5, "collections");
    document.getElementById("stat-collections-count").innerText = "–";
    resetChart("#collections-status-chart");
    document.querySelector("#collections-status-chart").innerHTML =
      '<p class="subtext">Collection status is unavailable right now.</p>';
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
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center">No weekly reports yet.</td></tr>';
      return;
    }

    reports.forEach((r) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td><code>${r.week_start}</code> to <code>${r.week_end}</code></td>
                <td>${escapeHtml(r.summary_en)}</td>
                <td>${r.total_members_active}</td>
                <td>+${r.new_registrations}</td>
                <td>${formatDate(r.created_at)}</td>
            `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    renderLoadError(tbody, 5, "weekly reports");
    document.getElementById("stat-reports-count").innerText = "–";
  }
}

function renderMemberTrajectoryChart(members) {
  resetChart("#members-chart");

  if (members.length === 0 || typeof Chartist === "undefined") {
    document.querySelector("#members-chart").innerHTML =
      '<p class="subtext">Register members to see growth here.</p>';
    return;
  }

  const monthCounts = {};
  members.forEach((m) => {
    const month = new Date(m.joined_date || m.created_at).toLocaleString(
      "default",
      { month: "short" },
    );
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });

  new Chartist.Line("#members-chart", {
    labels: Object.keys(monthCounts),
    series: [Object.values(monthCounts)],
  }, {
    low: 0,
    showArea: true,
  });
}

function renderCollectionStatusChart(statusCounts) {
  resetChart("#collections-status-chart");

  if (typeof Chartist === "undefined") return;

  new Chartist.Pie("#collections-status-chart", {
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
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
