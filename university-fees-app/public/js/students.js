// Searchable student list with fee status. Shared by the staff and admin portals.
const searchInput = document.getElementById("search");
const tableBody = document.getElementById("students-body");
const editDialog = document.getElementById("student-edit-dialog");
const editForm = document.getElementById("student-edit-form");
const editMessage = document.getElementById("student-edit-message");
const editSaveButton = document.getElementById("student-edit-save");
let isAdmin = false;

function feeCell(fee) {
  if (!fee) return `<span class="muted">No fee set</span>`;
  const label = { paid: "Paid", partial: "Part-paid", unpaid: "Unpaid" }[fee.status];
  return `${statusTag(fee.status, label)}<br><span class="muted">${formatNaira(fee.paid_naira)} / ${formatNaira(fee.due_naira)}</span>`;
}

async function loadStudents() {
  try {
    const rows = await apiRequest(`/staff/students?q=${encodeURIComponent(searchInput.value)}`);
    const colspan = isAdmin ? 7 : 6;
    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="${colspan}" class="muted">No students found.</td></tr>`;
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
          ${isAdmin ? `<td><button type="button" class="secondary inline-btn edit-student-btn" data-student-id="${s.id}">Edit information</button></td>` : ""}
        </tr>`
      )
      .join("");
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

function showEditMessage(message) {
  editMessage.textContent = message;
  editMessage.hidden = false;
}

if (editDialog && editForm) {
  async function openStudentEditor(studentId) {
    editMessage.hidden = true;
    editForm.reset();
    editDialog.showModal();
    try {
      const student = await apiRequest(`/admin/students/${encodeURIComponent(studentId)}`);
      for (const field of [
        "full_name",
        "email",
        "matric_number",
        "level",
        "phone_number",
        "state_of_origin",
        "lga_of_origin",
        "home_town",
        "permanent_address",
        "contact_address",
      ]) {
        editForm.elements[field].value = student[field] || "";
      }
      editForm.dataset.studentId = student.id;
    } catch (error) {
      showEditMessage(error.message);
    }
  }

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest(".edit-student-btn");
    if (button) openStudentEditor(button.dataset.studentId);
  });

  document.getElementById("student-edit-close").addEventListener("click", () => editDialog.close());
  document.getElementById("student-edit-cancel").addEventListener("click", () => editDialog.close());
  editDialog.addEventListener("click", (event) => {
    if (event.target === editDialog) editDialog.close();
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    editMessage.hidden = true;
    editSaveButton.disabled = true;
    const fields = [
      "full_name",
      "email",
      "matric_number",
      "level",
      "phone_number",
      "state_of_origin",
      "lga_of_origin",
      "home_town",
      "permanent_address",
      "contact_address",
    ];
    const student = Object.fromEntries(
      fields.map((field) => [field, editForm.elements[field].value.trim()])
    );

    try {
      await apiRequest(`/admin/students/${encodeURIComponent(editForm.dataset.studentId)}`, {
        method: "PUT",
        body: student,
      });
      editDialog.close();
      await loadStudents();
    } catch (error) {
      showEditMessage(error.message);
    } finally {
      editSaveButton.disabled = false;
    }
  });
}

let timer;
searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(loadStudents, 250);
});

(async function initStudentsPage() {
  const user = await currentUserReady;
  isAdmin = user && user.role === "admin";
  await loadStudents();
})();
