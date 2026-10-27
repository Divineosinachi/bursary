(async function loadReceipt() {
  const body = document.getElementById("receipt-body");
  const reference = new URLSearchParams(window.location.search).get("reference");
  if (!reference) {
    body.innerHTML = `<p class="error">No payment reference given.</p>`;
    return;
  }

  try {
    const r = await apiRequest(`/payments/receipt/${encodeURIComponent(reference)}`);
    const row = (label, value) => `<div class="receipt-row"><span>${label}</span><span>${escapeHtml(value)}</span></div>`;
    body.innerHTML =
      row("Student", r.full_name) +
      row("Matric number", r.matric_number) +
      row("Level", r.level) +
      row("Session", r.session) +
      row("Payment for", r.fee_type === "school" ? "School fees" : "Hostel fees") +
      row("Amount paid", formatNaira(r.amount_naira)) +
      row("Payment method", r.channel || "—") +
      row("Date", formatDateTime(r.verified_at || r.created_at)) +
      row("Reference", r.reference) +
      `<button id="print-btn">Print receipt</button>`;
    document.getElementById("print-btn").addEventListener("click", () => window.print());
  } catch (err) {
    body.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
})();
