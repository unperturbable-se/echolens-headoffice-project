// Frontend/auth/session.js

/**
 * Role-to-Directory Routing Mapping
 */
const ROLE_ROUTES = {
  "SUPER_ADMIN": "/Frontend/Administrator/index.html",
  "HR_LEAD": "/Frontend/Administrator/index.html",
  "FINANCE_REVIEWER": "/Frontend/Finance/index.html",
  "BRANCH_LEAD": "/Frontend/Branch/index.html",
  "CONTENT_EDITOR": "/Frontend/Content/index.html",
};

/**
 * Redirect user based on their backend role string.
 */
function routeByRole(role) {
  const destination = ROLE_ROUTES[role] || "/Frontend/login.html";
  globalThis.location.href = destination;
}

/**
 * Verify session on protected pages. Call this at the top of your dashboard JS files.
 */
function enforceSessionGuard(allowedRoles = []) {
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token || !user) {
    clearAuthSession();
    globalThis.location.href = "/Frontend/login.html";
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // User logged in but unauthorized for this specific folder -> send to their matching dashboard
    routeByRole(user.role);
    return null;
  }

  return user;
}
