// Admin: who did what in the staff and admin portals.
const body = document.getElementById("audit-body");

function describe(details) {
  if (!details) return "";
  return Object.entries(details)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(", ");
}

(async function loadAudit() {
  try {
    const rows = await apiRequest("/admin/audit-logs");
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="muted">Nothing logged yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r) => `<tr>
          <td>${formatDateTime(r.created_at)}</td>
          <td>${escapeHtml(r.actor_name || "—")}<br><span class="muted">${escapeHtml(r.actor_role)}</span></td>
          <td>${escapeHtml(r.action.replace(/_/g, " "))}</td>
          <td class="muted">${escapeHtml(describe(r.details))}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
})();
