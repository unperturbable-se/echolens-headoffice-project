// Frontend/auth/api_client.js

const API_BASE_URL = "http://127.0.0.1:8000"; //"https://echolens-headoffice-project.onrender.com";

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
      !globalThis.location.pathname.endsWith("login.html")
    ) {
      clearAuthSession();
      globalThis.location.href = "/Frontend/login.html";
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

// -------------------------------------------------------------------
// Authentication API Calls
// -------------------------------------------------------------------

// Frontend/auth/api_client.js
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
    globalThis.location.href = "/Frontend/login.html";
  }
}
