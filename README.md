# InteLog-project — Intern Management System

A final year Project.

A full-stack web platform for managing intern onboarding, daily logbooks, supervisor approvals, and admin oversight.

---

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18, Vite 5, React Router 6, Axios         |
| Backend  | FastAPI, SQLAlchemy 2, psycopg2, python-jose    |
| Database | PostgreSQL                                      |
| Auth     | JWT (access + refresh tokens), Google OAuth2   |

---

## Quick Start

### 1. Database

Make sure PostgreSQL is running, then create the database and run migrations:

```sql
-- In psql or pgAdmin:
CREATE DATABASE intern_mis;
\c intern_mis
\i database/001_initial.sql
\i database/002_seed.sql
```

Default admin account created by seed:
- **Email:** `admin@mis.local`
- **Password:** `Admin@123`

---

### 2. Backend

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Start the server (from project root)
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

---

### 3. Frontend

```bash
# Install dependencies (run once)
cd frontend
npm install

# Start dev server
npm run dev
```

Open: http://localhost:5173

---

## Environment Variables

Copy `backend/.env` and fill in your values:

### Database
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/intern_mis
```

### JWT
```
SECRET_KEY=your-random-64-char-hex-string
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
```

### SMTP Email (for password reset and OTP emails)

**Option A — Gmail with App Password (recommended):**
1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create an App Password for "Mail"
4. Set in `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # 16-char app password
SMTP_FROM=your-gmail@gmail.com
SMTP_USE_TLS=True
```

**Option B — Development (no email server needed):**

Leave `SMTP_USER` and `SMTP_PASSWORD` blank. All emails (OTP codes, reset links) will be **printed to the backend terminal** instead of sent. Copy the link/code from there.

```
SMTP_USER=
SMTP_PASSWORD=
```

### Google OAuth2 (optional)
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/login
```
Leave as default placeholders to disable Google login.

---

## Default Logins

| Role       | Email              | Password   | Login URL                          |
|------------|--------------------|------------|------------------------------------|
| Admin      | admin@mis.local    | Admin@123  | http://localhost:5173/admin/login  |
| Supervisor | (create via admin) | (you set)  | http://localhost:5173/supervisor/login |
| Intern     | (register)         | (you set)  | http://localhost:5173/login        |

---

## Features

- **Intern onboarding** — signup → pending → admin approval → active
- **Daily logbook** — create, save draft, submit for approval
- **Geofencing** — GPS validation before log submission (200m radius)
- **OTP approvals** — supervisor approves logs via email OTP
- **PII scrubbing** — regex-based redaction of IDs, phones, emails
- **Productivity flagging** — auto-flag short or low-effort logs
- **Password reset** — email link with 30-min expiry
- **Dark/light theme** — persisted in localStorage
- **Role-based access** — intern / supervisor / admin portals

---

## Project Structure

```
InteLog/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── config.py            # Environment variable loading
│   ├── database.py          # DB engine and session
│   ├── dependencies.py      # Auth dependencies (get_current_user, require_role)
│   ├── routers/             # auth, admin, supervisor, intern, geo
│   ├── services/            # auth, email, geo, otp, pii, productivity
│   └── uploads/             # Uploaded evidence images
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Router, ThemeProvider, AuthProvider
│   │   ├── components/      # All UI components
│   │   └── services/api.js  # Axios instance with JWT interceptor
│   └── vite.config.js       # Dev server + proxy config
└── database/
    ├── 001_initial.sql      # Schema creation
    └── 002_seed.sql         # Default admin + site location
```
