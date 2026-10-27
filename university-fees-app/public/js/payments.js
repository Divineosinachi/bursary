// All payments with filters. Shared by the staff and admin portals.
const searchInput = document.getElementById("search");
const statusSelect = document.getElementById("status");
const tableBody = document.getElementById("payments-body");

async function loadPayments() {
  try {
    const params = new URLSearchParams({ q: searchInput.value, status: statusSelect.value });
    const rows = await apiRequest(`/staff/payments?${params}`);
    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="muted">No payments found.</td></tr>`;
      return;
    }
    tableBody.innerHTML = rows
      .map(
        (p) => `<tr>
          <td>${formatDateTime(p.created_at)}</td>
          <td>${escapeHtml(p.full_name)}</td>
          <td>${escapeHtml(p.matric_number)}</td>
          <td>${p.fee_type === "school" ? "School" : "Hostel"}</td>
          <td>${formatNaira(p.amount_naira)}</td>
          <td>${statusTag(p.status)}</td>
          <td class="muted">${escapeHtml(p.reference)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

let timer;
searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(loadPayments, 250);
});
statusSelect.addEventListener("change", loadPayments);

loadPayments();
