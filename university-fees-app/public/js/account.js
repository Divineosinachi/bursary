// Account/profile page, shared by all three portals: shows who you are and lets you change your password.
(async function showAccount() {
  const user = await currentUserReady;
  if (!user) return;

  const profileForm = document.getElementById("profile-form");
  if (user.role === "student" && profileForm) {
    const initials = user.full_name.trim().split(/\s+/).slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase()).join("");
    document.getElementById("profile-avatar").textContent = initials || "S";
    document.getElementById("profile-sidebar-name").textContent = user.full_name;
    document.getElementById("profile-sidebar-level").textContent = `Level ${user.level}`;
    document.getElementById("profile-full-name").textContent = user.full_name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-matric").textContent = user.matric_number;
    document.getElementById("profile-academic-level").textContent = `Level ${user.level}`;

    for (const field of [
      "phone_number",
      "permanent_address",
      "contact_address",
      "state_of_origin",
      "lga_of_origin",
      "home_town",
    ]) {
      profileForm.elements[field].value = user[field] || "";
    }
    return;
  }

  const row = (label, value) => `<div class="receipt-row"><span>${label}</span><span>${escapeHtml(value || "—")}</span></div>`;

  let html = row("Name", user.full_name) + row("Email", user.email);
  if (user.role === "student") {
    html += row("Matric number", user.matric_number) + row("Level", user.level);
  } else {
    html += row("Role", user.role === "admin" ? "Administrator" : "Staff") + row("Department", user.department);
  }
  document.getElementById("account-details").innerHTML = html;
})();

const profileForm = document.getElementById("profile-form");
if (profileForm) {
  const profileMsg = document.getElementById("profile-msg");
  const profileSaveBtn = document.getElementById("profile-save-btn");
  const profileFields = [
    "phone_number",
    "permanent_address",
    "contact_address",
    "state_of_origin",
    "lga_of_origin",
    "home_town",
  ];

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileMsg.className = "error";
    profileMsg.style.display = "none";
    profileSaveBtn.disabled = true;

    const profile = Object.fromEntries(
      profileFields.map((field) => [field, profileForm.elements[field].value.trim()])
    );

    try {
      const result = await apiRequest("/auth/student/profile", {
        method: "PUT",
        body: profile,
      });
      Object.assign(currentUser, result.profile);
      profileMsg.className = "notice";
      profileMsg.textContent = result.message;
    } catch (error) {
      profileMsg.textContent = error.message;
    } finally {
      profileMsg.style.display = "block";
      profileSaveBtn.disabled = false;
    }
  });
}

const form = document.getElementById("password-form");
const msg = document.getElementById("password-msg");
const btn = document.getElementById("password-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.className = "error";
  msg.style.display = "none";

  const current = document.getElementById("current-password").value;
  const next = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  if (next !== confirm) {
    msg.textContent = "The new passwords don't match.";
    msg.style.display = "block";
    return;
  }

  btn.disabled = true;
  try {
    await apiRequest("/auth/change-password", {
      method: "POST",
      body: { current_password: current, new_password: next },
    });
    form.reset();
    msg.className = "notice";
    msg.textContent = "Password changed.";
  } catch (err) {
    msg.className = "error";
    msg.textContent = err.message;
  }
  msg.style.display = "block";
  btn.disabled = false;
});
