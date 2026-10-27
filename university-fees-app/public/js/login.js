// One login script for all three portals. The portal comes from <body data-portal>.
if (getToken()) go(portal.home);

const form = document.getElementById("login-form");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("password").value;

  try {
    const data = await apiRequest(`/auth/${portalName}/login`, {
      method: "POST",
      body: portalName === "student" ? { identifier, password } : { email: identifier, password },
    });
    saveToken(data.token);
    go(portal.home);
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
