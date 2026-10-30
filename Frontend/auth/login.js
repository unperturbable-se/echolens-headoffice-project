// Frontend/auth/login.js

document.addEventListener("DOMContentLoaded", () => {
    // If user already has a active session, route them to their matching dashboard
    try {
        const user = typeof getStoredUser === "function" ? getStoredUser() : null;
        const token = typeof getAuthToken === "function" ? getAuthToken() : null;

        if (token && user && user.role) {
            routeByRole(user.role);
            return;
        }
    } catch (err) {
        console.warn("Session check skipped on login page:", err);
    }

    const loginForm = document.getElementById("login-form");
    const errorDiv = document.getElementById("error-message");
    const submitBtn = document.getElementById("submit-btn");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorDiv.style.display = "none";
        submitBtn.disabled = true;
        submitBtn.innerText = "Authenticating...";

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await apiLogin(email, password);

            if (response && response.ok) {
                const resData = await handleApiResponse(response);
                
                // Res payload: { token: "...", user: { id, role, branch_id } }
                setAuthSession(resData.token, resData.user);
                routeByRole(resData.user.role);
            } else if (response) {
                const errorJson = await response.json();
                errorDiv.innerText = errorJson.detail || "Invalid email or password credentials.";
                errorDiv.style.display = "block";
            } else {
                errorDiv.innerText = "No response received from authentication server.";
                errorDiv.style.display = "block";
            }
        } catch (err) {
            errorDiv.innerText = err.message || "Unable to connect to live authentication service.";
            errorDiv.style.display = "block";
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Authenticate Session";
        }
    });
});