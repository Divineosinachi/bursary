// Shared by every page in every portal: page map, login token, API calls,
// the header/navigation bar, and small formatting helpers.
//
// Each page sets <body data-portal="student|staff|admin" data-page="..."> and
// (for login/register pages) data-public="true".

const PORTALS = {
  student: {
    title: "Bursary Student Portal",
    tokenKey: "unifee_token_student",
    login: "/student/login.html",
    home: "/student/dashboard.html",
    nav: [
      ["dashboard", "My fees", "/student/dashboard.html"],
      ["payments", "Payment history", "/student/payments.html"],
      ["profile", "Profile", "/student/profile.html"],
    ],
  },
  staff: {
    title: "Bursary Staff Portal",
    tokenKey: "unifee_token_staff",
    login: "/staff/login.html",
    home: "/staff/dashboard.html",
    nav: [
      ["dashboard", "Overview", "/staff/dashboard.html"],
      ["students", "Students", "/staff/students.html"],
      ["payments", "Payments", "/staff/payments.html"],
      ["account", "My account", "/staff/account.html"],
    ],
  },
  admin: {
    title: "Bursary Admin Portal",
    tokenKey: "unifee_token_admin",
    login: "/admin/login.html",
    home: "/admin/dashboard.html",
    nav: [
      ["dashboard", "Overview", "/admin/dashboard.html"],
      ["students", "Students", "/admin/students.html"],
      ["payments", "Payments", "/admin/payments.html"],
      ["staff", "Staff accounts", "/admin/staff.html"],
      ["fees", "Fee amounts", "/admin/fees.html"],
      ["audit", "Audit log", "/admin/audit-log.html"],
      ["account", "My account", "/admin/account.html"],
    ],
  },
};

const portalName = document.body.dataset.portal || "student";
const portal = PORTALS[portalName];
const API_BASE = "/api";

// ---------- Token ----------
function getToken() {
  try { return localStorage.getItem(portal.tokenKey); } catch (e) { return null; }
}
function saveToken(token) {
  try { localStorage.setItem(portal.tokenKey, token); } catch (e) { /* storage blocked */ }
}
function clearToken() {
  try { localStorage.removeItem(portal.tokenKey); } catch (e) { /* storage blocked */ }
}
function go(path) {
  window.location.href = path;
}

// ---------- API ----------
async function apiRequest(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      'Cannot connect to the portal server. Start it with "npm start" and open http://localhost:3000.'
    );
  }

  const data = await res.json().catch(() => ({}));

  // Only treat 401 as "session expired" if we actually had a session.
  // On a login form, 401 just means wrong credentials.
  if (res.status === 401 && token) {
    clearToken();
    go(portal.login);
    throw new Error("Session expired");
  }

  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ---------- Formatting ----------
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}
function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function statusTag(status, label) {
  return `<span class="status-tag ${escapeHtml(status)}">${escapeHtml(label || status)}</span>`;
}

// ---------- Header and navigation ----------
let currentUser = null;
const currentUserReady = (async function renderShell() {
  const shell = document.getElementById("shell");
  const isPublic = document.body.dataset.public === "true";

  if (!isPublic && !getToken()) {
    go(portal.login);
    return null;
  }

  let html = `
    <div class="letterhead">
      <h1>${escapeHtml(portal.title)}</h1>
      <p id="shell-subtitle">${escapeHtml(document.body.dataset.subtitle || "")}&nbsp;</p>
      <hr>
    </div>`;

  if (!isPublic) {
    const active = document.body.dataset.page;
    const links = portal.nav
      .map(([key, label, href]) => `<a href="${href}" class="${key === active ? "active" : ""}">${label}</a>`)
      .join("");
    html += `<nav class="portal-nav">${links}<span class="spacer"></span>
      <button class="secondary inline-btn" id="logout-btn">Log out</button></nav>`;
  }
  shell.innerHTML = html;

  const logout = document.getElementById("logout-btn");
  if (logout) {
    logout.addEventListener("click", () => {
      clearToken();
      go(portal.login);
    });
  }

  if (isPublic) return null;

  try {
    currentUser = await apiRequest("/auth/me");
    const subtitle = document.getElementById("shell-subtitle");
    subtitle.textContent =
      currentUser.role === "student"
        ? `${currentUser.full_name} · ${currentUser.matric_number} · Level ${currentUser.level}`
        : `${currentUser.full_name} · ${currentUser.role === "admin" ? "Administrator" : "Staff"}`;
  } catch (err) {
    /* apiRequest already redirects to login on an expired session */
  }
  return currentUser;
})();
