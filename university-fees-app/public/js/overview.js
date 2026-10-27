// Overview dashboard, shared by the staff and admin portals.
(async function loadOverview() {
  const body = document.getElementById("overview-body");
  try {
    const o = await apiRequest("/staff/overview");
    const stat = (value, label) => `<div class="stat"><p class="stat-value">${value}</p><p class="stat-label">${label}</p></div>`;

    const recent = o.recent_payments.length
      ? `<div class="table-scroll"><table class="history">
          <thead><tr><th>Date</th><th>Student</th><th>Matric no.</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>${o.recent_payments
            .map(
              (r) => `<tr>
                <td>${formatDate(r.created_at)}</td>
                <td>${escapeHtml(r.full_name)}</td>
                <td>${escapeHtml(r.matric_number)}</td>
                <td>${r.fee_type === "school" ? "School" : "Hostel"}</td>
                <td>${formatNaira(r.amount_naira)}</td>
                <td>${statusTag(r.status)}</td>
              </tr>`
            )
            .join("")}</tbody>
        </table></div>`
      : `<p class="muted">No payments yet.</p>`;

    body.innerHTML = `
      <div class="stat-grid">
        ${stat(o.total_students, "Registered students")}
        ${stat(formatNaira(o.collected_naira), `Collected, session ${escapeHtml(o.session)}`)}
        ${stat(formatNaira(o.school_collected_naira), "School fees collected")}
        ${stat(formatNaira(o.hostel_collected_naira), "Hostel fees collected")}
        ${stat(o.successful_payments, "Successful payments")}
        ${stat(o.pending_payments, "Pending payments")}
      </div>
      <div class="panel">
        <h2 style="font-size:1.2rem;">Recent payments</h2>
        ${recent}
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="panel"><p class="error">${escapeHtml(err.message)}</p></div>`;
  }
})();
