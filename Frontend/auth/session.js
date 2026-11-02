// Session routing & RBAC guards

/**
 * Workspace folder for each backend role.
 */
const ROLE_ROUTES = {
  "SUPER_ADMIN": "Administrator/index.html",
  "HR_LEAD": "Administrator/index.html",
  "FINANCE_REVIEWER": "Finance/index.html",
  "BRANCH_LEAD": "Branch/index.html",
  "CONTENT_EDITOR": "Content/index.html",
};

/**
 * Redirect user based on their backend role string.
 */
function routeByRole(role) {
  const destination = ROLE_ROUTES[role];
  globalThis.location.href = destination
    ? appPath(destination)
    : appPath("index.html");
}

/**
 * Verify session on protected pages. Call this at the top of your dashboard JS files.
 */
function enforceSessionGuard(allowedRoles = []) {
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token || !user) {
    clearAuthSession();
    globalThis.location.href = appPath("index.html");
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // User logged in but unauthorized for this specific folder -> send to their matching dashboard
    showToast("You do not have access to that workspace.", "error");
    routeByRole(user.role);
    return null;
  }

  return user;
}
