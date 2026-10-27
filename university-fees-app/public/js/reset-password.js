const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const portalNames = new Set(["student", "staff", "admin"]);
const portal = params.get("portal");
const form = document.getElementById("reset-password-form");
const errorMsg = document.getElementById("error-msg");
const noticeMsg = document.getElementById("notice-msg");
const submitBtn = document.getElementById("submit-btn");
const loginLink = document.getElementById("back-to-login");

if (portalNames.has(portal)) loginLink.href = `/${portal}/login.html`;
window.history.replaceState(null, "", window.location.pathname);

if (!token || !portalNames.has(portal)) {
  form.style.display = "none";
  errorMsg.textContent = "This password reset link is invalid or has expired.";
  errorMsg.style.display = "block";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMsg.style.display = "none";
  noticeMsg.style.display = "none";

  const newPassword = document.getElementById("new-password").value;
  const confirmation = document.getElementById("confirm-password").value;
  if (newPassword !== confirmation) {
    errorMsg.textContent = "The passwords do not match.";
    errorMsg.style.display = "block";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";
  try {
    const response = await fetch("/api/auth/password-reset/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, portal, new_password: newPassword }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to reset the password. Request a new link.");
    form.style.display = "none";
    noticeMsg.textContent = `${data.message} `;
    noticeMsg.style.display = "block";
  } catch (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Save new password";
  }
});
