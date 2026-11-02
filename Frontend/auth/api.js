// Auth API client for ShipLens

const API_BASE_URL = "https://echolens-headoffice-project.onrender.com";

const TOKEN_KEY = "shiplens_auth_token";
const USER_KEY = "shiplens_user_data";

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthSession(token, userData) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData));
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Resolve a page path that works from the portal root and from inside a
 * workspace folder, so the app runs from any host or subdirectory.
 */
function appPath(target) {
  const currentPath = globalThis.location.pathname;
  const insideWorkspace = /\/(Administrator|Finance|Branch|Content|auth)\//.test(
    currentPath,
  );
  return insideWorkspace ? `../${target}` : target;
}

/**
 * Utility to generate a SHA-256 hash string for password payloads
 */
async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Centralized API Fetcher
 */
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (
      response.status === 401 &&
      !globalThis.location.pathname.endsWith("index.html")
    ) {
      clearAuthSession();
      globalThis.location.href = appPath("index.html");
      return null;
    }

    return response;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Helper to unwrap standard { status: "success", data: ... } responses
 */
async function handleApiResponse(response) {
  if (!response) return null;
  const json = await response.json();
  if (response.ok && json.status === "success") {
    return json.data !== undefined ? json.data : true;
  }
  throw new Error(json.detail || "Request execution failed.");
}

// Shared UI Helpers

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_LEAD: "HR Lead",
  FINANCE_REVIEWER: "Finance Reviewer",
  BRANCH_LEAD: "Branch Lead",
  CONTENT_EDITOR: "Content Editor",
};

function formatRole(role) {
  return ROLE_LABELS[role] || role || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

/**
 * Show a message inside a page-level inline error container.
 * Falls back to a dismissible toast when the container is missing.
 */
function showInlineError(node, message) {
  if (!node) {
    showToast(message);
    return;
  }
  node.textContent = message;
  node.style.display = "block";
}

function showToast(message, type = "error") {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

/**
 * Clear a chart container before re-rendering. Chartist appends new SVG
 * nodes on every call, so reloads would otherwise stack duplicate charts.
 */
function resetChart(selector) {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = "";
}

/**
 * Replace a table body with a load-failure message instead of leaving the
 * "Loading…" row on screen forever.
 */
function renderLoadError(tbody, colspan, label) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center subtext">Could not load ${label}. Check that the API is running, then refresh.</td></tr>`;
}

// Auth Login & Logout

async function apiLogin(email, password) {
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: email,
      password: password, // Send exact unhashed string matching 'Test@1234'
    }),
  });
  return response;
}

async function apiLogout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } finally {
    clearAuthSession();
    globalThis.location.href = appPath("index.html");
  }
}
