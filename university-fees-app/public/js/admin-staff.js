// Admin: create staff/admin accounts and switch them on or off.
const tableBody = document.getElementById("staff-body");
const form = document.getElementById("staff-form");
const msg = document.getElementById("staff-msg");

async function loadStaff() {
  try {
    const me = await currentUserReady;
    const rows = await apiRequest("/admin/staff");
    tableBody.innerHTML = rows
      .map(
        (s) => `<tr>
          <td>${escapeHtml(s.full_name)}<br><span class="muted">${escapeHtml(s.email)}</span></td>
          <td>${s.role === "admin" ? "Administrator" : "Staff"}</td>
          <td>${escapeHtml(s.department || "—")}</td>
          <td>${s.is_active ? statusTag("success", "Active") : statusTag("inactive", "Deactivated")}</td>
          <td>${
            me && me.email === s.email
              ? `<span class="muted">You</span>`
              : `<button class="secondary inline-btn toggle-btn" data-id="${s.id}" data-active="${s.is_active}">
                   ${s.is_active ? "Deactivate" : "Reactivate"}</button>`
          }</td>
        </tr>`
      )
      .join("");

    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await apiRequest(`/admin/staff/${btn.dataset.id}/active`, {
            method: "PATCH",
            body: { is_active: btn.dataset.active !== "true" },
          });
          loadStaff();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.display = "none";
  const btn = document.getElementById("staff-btn");
  btn.disabled = true;
  try {
    await apiRequest("/admin/staff", {
      method: "POST",
      body: {
        full_name: document.getElementById("s-name").value.trim(),
        email: document.getElementById("s-email").value.trim(),
        department: document.getElementById("s-dept").value.trim(),
        role: document.getElementById("s-role").value,
        password: document.getElementById("s-password").value,
      },
    });
    form.reset();
    msg.className = "notice";
    msg.textContent = "Account created. Give them the temporary password; they can change it from My account.";
    loadStaff();
  } catch (err) {
    msg.className = "error";
    msg.textContent = err.message;
  }
  msg.style.display = "block";
  btn.disabled = false;
});

loadStaff();
