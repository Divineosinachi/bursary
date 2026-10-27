// Admin: set school and hostel fees for each level and academic session.
const body = document.getElementById("fees-body");
const sessionInput = document.getElementById("fees-session-input");
let availableSessions = [];

async function loadFees() {
  try {
    const session = sessionInput.value.trim();
    const data = await apiRequest(`/admin/fees?session=${encodeURIComponent(session)}`);
    availableSessions = data.sessions;
    document.getElementById("fees-session").textContent = `Session ${data.session}. Amounts are in Naira.`;

    body.innerHTML = data.levels
      .map(
        (l) => `<tr data-level="${l.level}">
          <td>${l.level} Level</td>
          <td><input type="number" min="0" step="0.01" class="fee-input school" value="${l.school_fee_naira ?? ""}" placeholder="Not set"></td>
          <td><input type="number" min="0" step="0.01" class="fee-input hostel" value="${l.hostel_fee_naira ?? ""}" placeholder="Not set"></td>
          <td><button class="inline-btn save-btn">Save</button> <span class="row-msg muted"></span></td>
        </tr>`
      )
      .join("");

    document.querySelectorAll(".save-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("tr");
        const note = row.querySelector(".row-msg");
        if (sessionInput.value.trim() !== session) {
          note.textContent = "Load this session before saving.";
          return;
        }
        btn.disabled = true;
        note.textContent = "";
        try {
          await apiRequest("/admin/fees", {
            method: "PUT",
            body: {
              level: row.dataset.level,
              session,
              school_fee_naira: row.querySelector(".school").value,
              hostel_fee_naira: row.querySelector(".hostel").value,
            },
          });
          if (!availableSessions.includes(session)) {
            availableSessions.push(session);
            const datalist = document.getElementById("available-sessions");
            datalist.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(session)}"></option>`);
          }
          note.textContent = "Saved";
        } catch (err) {
          note.textContent = err.message;
        }
        btn.disabled = false;
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function init() {
  try {
    const data = await apiRequest("/admin/fees");
    availableSessions = data.sessions;
    sessionInput.value = data.session;
    sessionInput.setAttribute("list", "available-sessions");
    const datalist = document.createElement("datalist");
    datalist.id = "available-sessions";
    datalist.innerHTML = availableSessions
      .map((session) => `<option value="${escapeHtml(session)}"></option>`)
      .join("");
    sessionInput.after(datalist);
    await loadFees();
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="error">${escapeHtml(err.message)}</td></tr>`;
  }
}

document.getElementById("load-session-btn").addEventListener("click", async () => {
  if (!sessionInput.reportValidity()) return;
  await loadFees();
});

init();
