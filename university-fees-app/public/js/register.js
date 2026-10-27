// Student self-registration. (Staff and admin accounts are created by an admin.)
if (getToken()) go(portal.home);

const form = document.getElementById("register-form");
const errorMsg = document.getElementById("error-msg");
const submitBtn = document.getElementById("submit-btn");

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.style.display = "none";

  const email = document.getElementById("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showError("Enter a valid email address, such as name@example.com.");
  }

  const password = document.getElementById("password").value;
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/.test(password)) {
    return showError("Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.");
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  try {
    const data = await apiRequest("/auth/student/register", {
      method: "POST",
      body: {
        full_name: document.getElementById("full_name").value.trim(),
        matric_number: document.getElementById("matric_number").value.trim(),
        level: document.getElementById("level").value,
        email,
        password,
      },
    });
    saveToken(data.token);
    go(portal.home);
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
});
