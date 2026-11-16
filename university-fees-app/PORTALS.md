# Portals and pages

The app has three portals. Each one has its own login page and its own token, so
being logged in to one never logs you in to another. Open `http://localhost:3000/`
for a landing page that links to all three.

## Public

| Page | URL | What it is |
|---|---|---|
| Welcome page | `/` or `/index.html` | Overview of student, staff and admin portals, payment features, getting-started steps, and department contact details |

Department of Computer and Robotics Education, University of Nigeria, Nsukka (UNN):
[okehdivine355@gmail.com](mailto:okehdivine355@gmail.com) · [+234 916 618 8870](tel:+2349166188870)

## Student portal — `/student/`

Students create their own accounts.

| Page | URL | What it does |
|---|---|---|
| Login | `/student/login.html` | Log in with email or matric number |
| Register | `/student/register.html` | Create a student account (name, matric number, level, email, password) |
| My fees | `/student/dashboard.html` | Student profile summary, selectable academic-session fee totals, recent payment activity, school and hostel balances, **Generate invoice** actions, Paystack payment buttons, and a **Generate Remita RRR** option for school fees |
| Fee invoice | `/student/invoice.html?fee_type=school&session=2025%2F2026` or `?fee_type=hostel&session=2025%2F2026` | Printable fee breakdown for the selected category and academic session; use the browser print dialog to print or save it as a PDF |
| Payment history | `/student/payments.html` | Every payment attempt, including Remita RRRs and a status-check action; successful payments have a receipt link |
| Receipt | `/student/receipt.html?reference=…` | Printable receipt for one successful payment |
| Profile | `/student/profile.html` | View student information and change password; request student-record changes from an administrator |

## Staff portal — `/staff/`

Read-only. Staff accounts are created by an admin (staff cannot sign themselves up).

| Page | URL | What it does |
|---|---|---|
| Login | `/staff/login.html` | Staff email and password |
| Overview | `/staff/dashboard.html` | Totals collected, payment counts, recent payments |
| Students | `/staff/students.html` | Search students and see school/hostel fee status for each |
| Payments | `/staff/payments.html` | All payments; search and filter by status |
| My account | `/staff/account.html` | Account details and change password |

## Admin portal — `/admin/`

Everything staff can see, plus management tools. Only an `admin` account can log in here.

| Page | URL | What it does |
|---|---|---|
| Login | `/admin/login.html` | Admin email and password |
| Overview | `/admin/dashboard.html` | Same overview as staff |
| Students | `/admin/students.html` | Search student records, view fee status, and edit student identity, academic, contact and origin details |
| Payments | `/admin/payments.html` | Same payment list as staff |
| Staff accounts | `/admin/staff.html` | Create staff or admin accounts; deactivate and reactivate them |
| Fee amounts | `/admin/fees.html` | Set the school fee and hostel fee for each level and academic session |
| Audit log | `/admin/audit-log.html` | Who logged in, changed fees, or managed accounts |
| My account | `/admin/account.html` | Account details and change password |

## API endpoints (for reference)

| Area | Endpoints |
|---|---|
| Login and account | `POST /api/auth/student/register`, `POST /api/auth/student/login`, `POST /api/auth/staff/login`, `POST /api/auth/admin/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Student | `GET /api/fees/sessions`, `GET /api/fees/me?session=…`, `POST /api/payments/initialize`, `GET /api/payments/verify/:reference`, `GET /api/payments/history`, `GET /api/payments/receipt/:reference` |
| Payment providers | Paystack redirect and webhook; Remita RRR generation and authenticated status verification |
| Staff and admin | `GET /api/staff/overview`, `GET /api/staff/students`, `GET /api/staff/payments` |
| Admin only | `GET/PUT /api/admin/students/:id`, `GET/POST /api/admin/staff`, `PATCH /api/admin/staff/:id/active`, `GET/PUT /api/admin/fees`, `GET /api/admin/audit-logs` |

## Roles at a glance

| | Student | Staff | Admin |
|---|---|---|---|
| Pay own fees, see own history and receipts | ✔ | | |
| View all students and payments | | ✔ | ✔ |
| Edit student information | | | ✔ |
| Create/deactivate staff accounts | | | ✔ |
| Change fee amounts | | | ✔ |
| Read the audit log | | | ✔ |

## Planned later

The admin database is on Supabase for now, like everything else. The plan is to
move it to a local, key-protected database on the admin's own machine later (run as
a Windows service, no XAMPP). The admin portal's code is kept separate (`src/routes/adminRoutes.js`
and `public/admin/`) so that move only touches that part.
