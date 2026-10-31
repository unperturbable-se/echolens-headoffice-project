// Content workspace controller

document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = enforceSessionGuard(["CONTENT_EDITOR"]);
  if (!currentUser) return;

  document.getElementById("user-display").innerText =
    `${currentUser.email} (${currentUser.role})`;
  document.getElementById("logout-btn").addEventListener("click", apiLogout);

  const noticeModal = document.getElementById("notice-modal");

  document.getElementById("open-notice-modal").addEventListener(
    "click",
    () => openNoticeModal(),
  );
  document.getElementById("close-notice-modal").addEventListener(
    "click",
    () => noticeModal.close(),
  );

  await refreshContentDashboard();

  // POST /notices
  document.getElementById("save-notice-form").addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const noticeError = document.getElementById("notice-error");
      noticeError.style.display = "none";

      const payload = {
        title_en: document.getElementById("notice-title-en").value.trim(),
        title_ur: document.getElementById("notice-title-ur").value.trim(),
        content_en: document.getElementById("notice-content-en").value.trim(),
        content_ur: document.getElementById("notice-content-ur").value.trim(),
        publish: document.getElementById("notice-publish-toggle").checked,
      };

      const missingUrdu = !payload.title_ur || !payload.content_ur;
      const missingEnglish = !payload.title_en || !payload.content_en;

      if (missingUrdu || missingEnglish) {
        showInlineError(
          noticeError,
          missingUrdu && missingEnglish
            ? "Add the notice in both English and Urdu before saving."
            : missingUrdu
            ? "The Urdu title and content are still empty."
            : "The English title and content are still empty.",
        );
        return;
      }

      const noticeId = document.getElementById("notice-id").value;

      try {
        const res = await apiRequest("/notices", {
          method: "POST",
          body: JSON.stringify(
            noticeId ? { ...payload, notice_id: noticeId } : payload,
          ),
        });
        await handleApiResponse(res);
        noticeModal.close();
        e.target.reset();
        document.getElementById("notice-id").value = "";
        await loadNotices();
        showToast(
          noticeId ? "Notice updated." : "Notice saved.",
          "success",
        );
      } catch (err) {
        showInlineError(
          noticeError,
          err.message || "Could not save this notice.",
        );
      }
    },
  );
});

function openNoticeModal(notice = null) {
  const form = document.getElementById("save-notice-form");
  form.reset();
  document.getElementById("notice-error").style.display = "none";
  document.getElementById("notice-id").value = notice ? notice.id : "";
  document.querySelector("#notice-modal header h3").textContent = notice
    ? "Edit public notice"
    : "Draft public notice";
  document.getElementById("save-notice-btn").textContent = notice
    ? "Save changes"
    : "Save notice";

  if (notice) {
    document.getElementById("notice-title-en").value = notice.title_en || "";
    document.getElementById("notice-title-ur").value = notice.title_ur || "";
    document.getElementById("notice-content-en").value = notice.content_en ||
      "";
    document.getElementById("notice-content-ur").value = notice.content_ur ||
      "";
    document.getElementById("notice-publish-toggle").checked = Boolean(
      notice.is_published || notice.publish,
    );
  }

  document.getElementById("notice-modal").showModal();
}

async function refreshContentDashboard() {
  await Promise.all([
    loadNotices(),
    loadInquiries(),
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
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No notices yet. Create the first one.</td></tr>';
      document.getElementById("stat-notices-count").innerText = 0;
      document.getElementById("stat-published-count").innerText = 0;
      resetChart("#notice-status-chart");
      document.querySelector("#notice-status-chart").innerHTML =
        '<p class="subtext">Publish a notice to see the split.</p>';
      return;
    }

    let publishedCount = 0;

    notices.forEach((n) => {
      if (n.is_published || n.publish) publishedCount++;

      const row = document.createElement("tr");
      const editBtn = document.createElement("button");
      editBtn.className = "small-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openNoticeModal(n));

      row.innerHTML = `
                <td>${escapeHtml(n.title_en)}</td>
                <td dir="rtl">${escapeHtml(n.title_ur)}</td>
                <td><span class="badge ${
        (n.is_published || n.publish) ? "ok" : "chip"
      }">${(n.is_published || n.publish) ? "Published" : "Draft"}</span></td>
                <td>${n.published_at ? formatDateTime(n.published_at) : "-"}</td>
                <td>${formatDate(n.created_at)}</td>
                <td class="action-cell"></td>
            `;

      row.querySelector(".action-cell").appendChild(editBtn);
      tbody.appendChild(row);
    });

    document.getElementById("stat-published-count").innerText = publishedCount;
    renderNoticeChart(publishedCount, notices.length - publishedCount);
  } catch (err) {
    console.error(err);
    renderLoadError(tbody, 6, "notices");
    document.getElementById("stat-notices-count").innerText = "–";
    document.getElementById("stat-published-count").innerText = "–";
  }
}

async function loadInquiries() {
  const tbody = document.getElementById("inquiries-table-body");
  try {
    const res = await apiRequest("/inquiries/list", { method: "POST" });
    const inquiries = await handleApiResponse(res);

    tbody.innerHTML = "";

    if (inquiries.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">No inquiries yet.</td></tr>';
      document.getElementById("stat-inquiries-count").innerText = 0;
      resetChart("#inquiry-status-chart");
      document.querySelector("#inquiry-status-chart").innerHTML =
        '<p class="subtext">No inquiries to summarise yet.</p>';
      return;
    }

    let unresolvedCount = 0;

    inquiries.forEach((inq) => {
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
                <td><strong>${
        escapeHtml(inq.sender_name || inq.name)
      }</strong><br><small class="subtext">${
        escapeHtml(inq.sender_email || inq.email)
      }</small></td>
                <td>${escapeHtml(inq.subject || "General Inquiry")}</td>
                <td>${escapeHtml(inq.message)}</td>
                <td><span class="badge ${inq.is_resolved ? "ok" : "danger"}">${
        inq.is_resolved ? "Resolved" : "Pending"
      }</span></td>
                <td>${formatDate(inq.created_at)}</td>
                <td class="action-cell"></td>
            `;

      row.querySelector(".action-cell").appendChild(actionBtn);
      tbody.appendChild(row);
    });

    document.getElementById("stat-inquiries-count").innerText = unresolvedCount;
    renderInquiryChart(inquiries.length - unresolvedCount, unresolvedCount);
  } catch (err) {
    console.error(err);
    renderLoadError(tbody, 6, "inquiries");
    document.getElementById("stat-inquiries-count").innerText = "–";
  }
}

async function resolveInquiry(inquiryId) {
  try {
    const res = await apiRequest("/inquiries/resolve", {
      method: "POST",
      body: JSON.stringify({ inquiry_id: inquiryId }),
    });
    await handleApiResponse(res);
    await loadInquiries();
    showToast("Inquiry marked as resolved.", "success");
  } catch (err) {
    showToast(err.message || "Could not resolve this inquiry.");
  }
}

function renderNoticeChart(published, drafts) {
  if (typeof Chartist === "undefined") return;

  resetChart("#notice-status-chart");
  new Chartist.Pie("#notice-status-chart", {
    labels: ["Published", "Drafts"],
    series: [published, drafts],
  }, {
    donut: true,
    donutWidth: 25,
    showLabel: true,
  });
}

function renderInquiryChart(resolved, pending) {
  if (typeof Chartist === "undefined") return;

  resetChart("#inquiry-status-chart");
  new Chartist.Pie("#inquiry-status-chart", {
    labels: ["Resolved", "Pending"],
    series: [resolved, pending],
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
