# HCM Lite (Saylani Hackathon)

MERN app: Admin / HR / Employee roles, attendance, leave, payroll, dashboards, AI assistant, announcements, notifications, audit log.

## Run locally
```bash
# backend
cd backend && cp .env.example .env   # set MONGODB_URI and JWT_SECRET
npm install && npm run dev            # http://localhost:5000
# frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :5000)
```
Open the app: a fresh database redirects to **first-run setup** (company name + Admin account).
Production: `npm run build` in `frontend`, host `dist/`, and route `/api` to the backend (or set a rewrite). Set `CLIENT_URL` on the backend to the frontend origin.

## AI key
Set `GEMINI_API_KEY` (or `OPENAI_API_KEY`) in `backend/.env` only. The browser never calls the provider. Smart leave and dashboard "Summarize" are rule-based on server data (no key needed). Chat tools use the caller's role.

## Demo flow
Admin setup -> create department -> Users: create HR -> HR registers employees (temp password, forced change at first sign-in) -> employee checks in -> applies leave (Smart leave) -> HR approves -> HR generates payroll -> Admin finalizes -> employee views payslip (Print -> Save as PDF) -> Admin opens Audit Log.

## Done
Auth + 3 roles with server-side checks, first-run setup, forced password change, departments, employee CRUD/directory, web check-in/out + corrections, leave with balance/overlap checks (422) and approval, payroll draft/finalize/lock, payslip view/print, role dashboards, AI chat, smart leave, summary, announcements, notifications, audit log.

## Not done / limitations
Company settings screen (office hours, grace, weekend, location are constants/env), public holidays and leave-type management, CSV import/export, designations, Employee 360 page, camera/face attendance, server-side payslip PDF (browser print used), tests, dashboard date/department filters, (done: set ADMIN_EMAIL, ADMIN_PASSWORD in .env).

## Logins (works right after start)
On start the backend auto-creates three logins if missing (set `AUTO_SEED_LOGINS=false` to disable, e.g. for the judging deployment so first-run setup appears):

| Role | Email | Password |
|---|---|---|
| Admin | admin@hcm.local | Admin@12345 |
| HR | hr@hcm.local | Hr@12345 |
| Employee | employee@hcm.local | Employee@12345 |

The sign-in page has Admin / HR / Employee buttons that fill these in. `cd backend && npm run seed-users` resets their passwords.
Real flow: Admin creates HR (User Management) -> HR registers employees (temp password, changed at first sign-in).
Sign up: only the Admin signs up (one per company, only if no Admin exists); HR and Employee accounts are created in the app.
"# hcm-lite" 
