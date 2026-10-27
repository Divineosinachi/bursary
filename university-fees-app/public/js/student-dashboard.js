function feeRow(label, fee, feeType, session) {
  const statusLabels = { paid: "Paid in full", partial: "Partially paid", unpaid: "Not yet paid" };
  const statusLabel = statusLabels[fee.status] || "Payment status unavailable";
  const feeCategory = feeType === "school" ? "ACADEMIC CHARGES" : "ACCOMMODATION";
  const due = Number(fee.due_naira);
  const paid = Number(fee.paid_naira);
  const balance = Number(fee.balance_naira);
  const progress = due > 0 ? Math.min(100, Math.max(0, (paid / due) * 100)) : 100;
  const actionHtml =
    balance <= 0
      ? `<p class="fee-settled">This fee is fully settled.</p>`
      : feeType === "school"
        ? `<div class="fee-payment-actions">
            <button data-fee-type="${feeType}" data-provider="paystack" class="pay-btn">Pay with Paystack</button>
            <button data-fee-type="${feeType}" data-provider="remita" class="pay-btn secondary">Generate Remita RRR</button>
          </div>`
        : `<button data-fee-type="${feeType}" data-provider="paystack" class="pay-btn">Pay ${formatNaira(balance)} with Paystack</button>`;

  return `
    <article class="fee-card">
      <div class="fee-card-heading">
        <div>
          <p class="fee-card-kicker">${feeCategory}</p>
          <h3 class="fee-name">${label}</h3>
        </div>
        ${statusTag(fee.status, statusLabel)}
      </div>
      <p class="fee-balance">${formatNaira(balance)}</p>
      <p class="fee-detail">Outstanding balance</p>
      <div class="fee-progress-row">
        <span>Paid ${formatNaira(paid)}</span>
        <span>of ${formatNaira(due)}</span>
      </div>
      <div
        class="progress-track fee-progress"
        role="progressbar"
        aria-label="${label} paid"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${Math.round(progress)}"
      ><span style="width:${progress}%"></span></div>
      <div class="fee-card-footer">
        <span>Total fee <strong>${formatNaira(due)}</strong></span>
        <div class="fee-card-actions">
          <a class="button secondary inline-btn invoice-btn" href="/student/invoice.html?fee_type=${feeType}&session=${encodeURIComponent(session)}">Generate invoice</a>
          ${actionHtml}
        </div>
      </div>
    </article>
  `;
}

const sessionSelect = document.getElementById("academic-session");
let selectedSession = "";

function updateSummary(fees) {
  const totalDue = fees.school.due_naira + fees.hostel.due_naira;
  const totalPaid = fees.school.paid_naira + fees.hostel.paid_naira;
  const totalBalance = fees.school.balance_naira + fees.hostel.balance_naira;
  const progress = totalDue > 0 ? Math.min(100, Math.max(0, (totalPaid / totalDue) * 100)) : 100;

  document.getElementById("total-due").textContent = formatNaira(totalDue);
  document.getElementById("total-paid").textContent = formatNaira(totalPaid);
  document.getElementById("summary-progress-label").textContent =
    totalBalance <= 0 ? "All fees are fully settled" : `${Math.round(progress)}% of total fees paid`;
  document.getElementById("total-outstanding").textContent = formatNaira(totalBalance);
}

function renderStudentProfile(student) {
  const name = student.full_name.trim();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  document.getElementById("profile-name").textContent = name;
  document.getElementById("student-avatar").textContent = initials || "S";
  document.getElementById("profile-email").textContent = student.email;
  document.getElementById("profile-matric").textContent = student.matric_number;
  document.getElementById("profile-level").textContent = `Level ${student.level}`;
  document.getElementById("profile-level-detail").textContent = `Level ${student.level}`;
  document.getElementById("dashboard-greeting").textContent = `Welcome back, ${name}`;
}

async function loadRecentActivity() {
  const activityBody = document.getElementById("activity-body");
  try {
    const payments = await apiRequest("/payments/history");
    if (payments.length === 0) {
      activityBody.innerHTML = `
        <div class="activity-empty">
          <span class="activity-empty-icon" aria-hidden="true">✓</span>
          <strong>No payment activity yet</strong>
          <p>Your fee payments and their status will appear here.</p>
        </div>`;
      return;
    }

    activityBody.innerHTML = payments.slice(0, 4).map((payment) => {
      const feeName = payment.fee_type === "school" ? "School fees" : "Hostel fees";
      const paymentLink = payment.status === "success"
        ? `<a href="/student/receipt.html?reference=${encodeURIComponent(payment.reference)}">View receipt</a>`
        : "";
      return `
        <article class="activity-row">
          <span class="activity-payment-icon" aria-hidden="true">₦</span>
          <div class="activity-description">
            <strong>${feeName}</strong>
            <span>${escapeHtml(payment.session)} · ${formatDate(payment.created_at)}</span>
          </div>
          <strong class="activity-amount">${formatNaira(payment.amount_naira)}</strong>
          ${statusTag(payment.status)}
          ${paymentLink}
        </article>`;
    }).join("");
  } catch (error) {
    activityBody.innerHTML = `<p class="error" role="alert">${escapeHtml(error.message)}</p>`;
  }
}

async function loadFees() {
  const feesBody = document.getElementById("fees-body");
  const session = selectedSession;
  feesBody.innerHTML = `<p class="muted">Loading your fee status…</p>`;
  try {
    const data = await apiRequest(`/fees/me?session=${encodeURIComponent(session)}`);
    if (session !== selectedSession) return;
    renderStudentProfile(data.student);
    document.getElementById("session-title").textContent = `${data.fees.session} fee breakdown`;
    updateSummary(data.fees);

    feesBody.innerHTML =
      feeRow("School fees", data.fees.school, "school", session) +
      feeRow("Hostel fees", data.fees.hostel, "hostel", session);

    document.querySelectorAll(".pay-btn").forEach((btn) => {
    btn.addEventListener("click", () => startPayment(btn.dataset.feeType, btn.dataset.provider, btn));
    });
  } catch (err) {
    if (session !== selectedSession) return;
    feesBody.innerHTML = `<p class="error" role="alert">${escapeHtml(err.message)}</p>`;
  }
}

async function loadSessions() {
  const data = await apiRequest("/fees/sessions");
  if (data.sessions.length === 0) {
    throw new Error("No fee schedules are available for your level yet.");
  }

  selectedSession = data.sessions.includes(data.current_session)
    ? data.current_session
    : data.sessions[0];
  const requestedSession = new URLSearchParams(window.location.search).get("session");
  if (requestedSession && data.sessions.includes(requestedSession)) {
    selectedSession = requestedSession;
  }
  sessionSelect.innerHTML = data.sessions
    .map((session) => `<option value="${escapeHtml(session)}">${escapeHtml(session)}</option>`)
    .join("");
  sessionSelect.value = selectedSession;
  sessionSelect.disabled = false;
  sessionSelect.addEventListener("change", async () => {
    selectedSession = sessionSelect.value;
    await loadFees();
  });
}

async function startPayment(feeType, provider, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = provider === "remita" ? "Generating RRR…" : "Starting payment…";
  try {
    const data = await apiRequest("/payments/initialize", {
      method: "POST",
      body: { fee_type: feeType, session: selectedSession, provider },
    });
    if (provider === "remita") {
      const notice = document.getElementById("verify-notice");
      notice.innerHTML = `
        <p class="notice">Remita RRR generated for ${escapeHtml(data.session)} school fees: <strong>${escapeHtml(data.rrr)}</strong> (${formatNaira(data.amount_naira)}).</p>
        <p><a class="button inline-btn" href="${escapeHtml(data.payment_url)}" target="_blank" rel="noopener">Continue to Remita to pay</a>
        <button type="button" class="secondary inline-btn" id="check-remita-payment" data-reference="${escapeHtml(data.reference)}">Check payment status</button></p>`;
      document.getElementById("check-remita-payment").addEventListener("click", async (event) => {
        const checkButton = event.currentTarget;
        checkButton.disabled = true;
        try {
          const result = await apiRequest(`/payments/verify/${encodeURIComponent(data.reference)}`);
          notice.querySelector(".notice").textContent = result.status === "success"
            ? "Remita payment confirmed. Your school-fee balance has been updated."
            : "Remita has not confirmed this payment yet. Please try again shortly.";
          if (result.status === "success") await loadFees();
        } catch (error) {
          notice.insertAdjacentHTML("beforeend", `<p class="error" role="alert">${escapeHtml(error.message)}</p>`);
        } finally {
          checkButton.disabled = false;
        }
      });
    } else {
      window.location.href = data.authorization_url;
    }
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
  btn.disabled = false;
  btn.textContent = originalText;
}

async function checkReturnFromPaystack() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference");
  if (!reference) return;

  const notice = document.getElementById("verify-notice");
  notice.innerHTML = `<p class="fee-detail">Confirming your payment…</p>`;

  try {
    const result = await apiRequest(`/payments/verify/${encodeURIComponent(reference)}`);
    if (result.status === "success") {
      notice.innerHTML = `<p class="notice">Payment received — your ${escapeHtml(result.fee_type)} fee balance has been updated.
        <a href="/student/receipt.html?reference=${encodeURIComponent(reference)}">View receipt</a></p>`;
    } else {
      notice.innerHTML = `<p class="error">That payment did not go through. You can try again below.</p>`;
    }
  } catch (err) {
    notice.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }

  window.history.replaceState({}, "", window.location.pathname);
}

(async function init() {
  await checkReturnFromPaystack();
  try {
    await loadSessions();
  } catch (error) {
    document.getElementById("fees-body").innerHTML =
      `<p class="error" role="alert">${escapeHtml(error.message)}</p>`;
    sessionSelect.innerHTML = `<option value="">Unavailable</option>`;
  }
  if (selectedSession) await loadFees();
  await loadRecentActivity();
})();
