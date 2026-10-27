const portalSelect = document.getElementById("portal");
const portalNames = new Set(["student", "staff", "admin"]);
const requestedPortal = new URLSearchParams(window.location.search).get("portal");
if (portalNames.has(requestedPortal)) portalSelect.value = requestedPortal;

const form = document.getElementById("forgot-password-form");
const errorMsg = document.getElementById("error-msg");
const noticeMsg = document.getElementById("notice-msg");
const submitBtn = document.getElementById("submit-btn");
const loginLink = document.getElementById("back-to-login");

function updateLoginLink() {
  loginLink.href = `/${portalSelect.value}/login.html`;
}
portalSelect.addEventListener("change", updateLoginLink);
updateLoginLink();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMsg.style.display = "none";
  noticeMsg.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  try {
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        portal: portalSelect.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to send a reset link. Try again.");
    noticeMsg.textContent = data.message;
    noticeMsg.style.display = "block";
  } catch (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send reset link";
  }
});
