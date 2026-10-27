const invoiceParams = new URLSearchParams(window.location.search);
const feeType = invoiceParams.get("fee_type");
const session = invoiceParams.get("session");
const feeLabels = { school: "School fees", hostel: "Hostel fees" };
const invoiceContent = document.getElementById("invoice-content");
const printButton = document.getElementById("print-invoice");

function invoiceRow(label, amount, className = "") {
  return `<tr class="${className}"><th scope="row">${label}</th><td>${formatNaira(amount)}</td></tr>`;
}

async function loadInvoice() {
  if (!Object.prototype.hasOwnProperty.call(feeLabels, feeType)) {
    invoiceContent.innerHTML = `<p class="error" role="alert">Choose a valid fee category from your student dashboard.</p>`;
    return;
  }

  try {
    const feesPath = session ? `/fees/me?session=${encodeURIComponent(session)}` : "/fees/me";
    const data = await apiRequest(feesPath);
    const student = data.student;
    const fee = data.fees[feeType];
    const generatedAt = new Date();

    document.getElementById("student-name").textContent = student.full_name;
    document.getElementById("student-matric").textContent = student.matric_number;
    document.getElementById("student-level").textContent = `Level ${student.level}`;
    document.getElementById("fee-category").textContent = feeLabels[feeType];
    document.getElementById("invoice-session").textContent = data.fees.session;
    document.getElementById("invoice-date").textContent = formatDate(generatedAt);
    document.getElementById("generated-at").textContent = formatDateTime(generatedAt);

    const paidInFull = fee.balance_naira <= 0;
    const statusLabel = paidInFull ? "Paid in full" : fee.paid_naira > 0 ? "Partially paid" : "Unpaid";
    invoiceContent.innerHTML = `
      <div class="invoice-status-row">
        <h3>Fee breakdown</h3>
        ${statusTag(fee.status, statusLabel)}
      </div>
      <div class="table-scroll">
        <table class="invoice-table">
          <thead><tr><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
          <tbody>
            ${invoiceRow(`${feeLabels[feeType]} · ${data.fees.session}`, fee.due_naira)}
            ${invoiceRow("Payments received", -fee.paid_naira, "invoice-credit")}
            ${invoiceRow("Outstanding balance", fee.balance_naira, "invoice-total")}
          </tbody>
        </table>
      </div>
      <p class="invoice-payable-label">Amount payable</p>
      <p class="invoice-payable">${formatNaira(fee.balance_naira)}</p>
      ${
        paidInFull
          ? `<p class="notice">This fee has been fully paid. This invoice is provided as a fee statement.</p>`
          : `<p class="muted invoice-payment-note">Pay the outstanding balance through the student dashboard to complete this fee.</p>`
      }
    `;

    printButton.disabled = false;
    printButton.addEventListener("click", () => window.print(), { once: true });
  } catch (error) {
    invoiceContent.innerHTML = `<p class="error" role="alert">${escapeHtml(error.message)}</p>`;
  }
}

loadInvoice();
