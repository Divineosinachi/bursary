// Searchable student list with fee status. Shared by the staff and admin portals.
const searchInput = document.getElementById("search");
const tableBody = document.getElementById("students-body");

function feeCell(fee) {
  if (!fee) return `<span class="muted">No fee set</span>`;
  const label = { paid: "Paid", partial: "Part-paid", unpaid: "Unpaid" }[fee.status];
  return `${statusTag(fee.status, label)}<br><span class="muted">${formatNaira(fee.paid_naira)} / ${formatNaira(fee.due_naira)}</span>`;
}

async function loadStudents() {
  try {
    const rows = await apiRequest(`/staff/students?q=${encodeURIComponent(searchInput.value)}`);
    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="muted">No students found.</td></tr>`;
      return;
    }
    tableBody.innerHTML = rows
      .map(
        (s) => `<tr>
          <td>${escapeHtml(s.full_name)}<br><span class="muted">${escapeHtml(s.email)}</span></td>
          <td>${escapeHtml(s.matric_number)}</td>
          <td>${escapeHtml(s.level)}</td>
          <td>${feeCell(s.school)}</td>
          <td>${feeCell(s.hostel)}</td>
          <td>${formatDate(s.created_at)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

let timer;
searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(loadStudents, 250);
});

loadStudents();
