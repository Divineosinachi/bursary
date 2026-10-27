function renderHistory(rows) {
  const body = document.getElementById("history-body");
  if (rows.length === 0) {
    body.innerHTML = `<p class="muted">No payments yet.</p>`;
    return;
  }

  const tr = rows.map((payment) => `
    <tr>
      <td>${formatDate(payment.created_at)}</td>
      <td>${escapeHtml(payment.session)}</td>
      <td>${payment.fee_type === "school" ? "School fee" : "Hostel fee"}</td>
      <td>${payment.provider === "remita"
        ? `Remita${payment.provider_reference ? ` - RRR ${escapeHtml(payment.provider_reference)}` : ""}`
        : "Paystack"}</td>
      <td>${formatNaira(payment.amount_naira)}</td>
      <td>${statusTag(payment.status)}</td>
      <td>${payment.status === "success"
        ? `<a href="/student/receipt.html?reference=${encodeURIComponent(payment.reference)}">Receipt</a>`
        : payment.provider === "remita" && payment.provider_reference
          ? `<button type="button" class="inline-btn verify-remita" data-reference="${escapeHtml(payment.reference)}">Check status</button>`
          : ""}</td>
    </tr>`).join("");

  body.innerHTML = `
    <div class="table-scroll"><table class="history">
      <thead><tr><th>Date</th><th>Session</th><th>Type</th><th>Method / RRR</th><th>Amount</th><th>Status</th><th></th></tr></thead>
      <tbody>${tr}</tbody>
    </table></div>`;

  body.querySelectorAll(".verify-remita").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await apiRequest(`/payments/verify/${encodeURIComponent(button.dataset.reference)}`);
        if (result.status === "success") {
          await loadHistory();
        } else {
          button.textContent = "Still pending";
          button.disabled = false;
        }
      } catch (error) {
        button.disabled = false;
        button.textContent = error.message;
      }
    });
  });
}

async function loadHistory() {
  const body = document.getElementById("history-body");
  body.innerHTML = `<p class="muted">Loading...</p>`;
  try {
    renderHistory(await apiRequest("/payments/history"));
  } catch (error) {
    body.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

loadHistory();
