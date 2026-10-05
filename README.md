# 🌿 Sahayog — NGO Field Workforce Management Platform

> **Seva Setu** · Bridging the gap between NGO administrators and field workers through smart, transparent, and biometric-powered workforce management.

---

## 📌 Project Overview

**Sahayog** (meaning *"help / collaboration"* in Hindi) is a full-stack web application built for **NGOs and civic organizations** to manage their field operations end-to-end. The platform bridges three layers of an NGO hierarchy — **Administrators**, **Team Leads**, and **Field Workers** — providing each role with a dedicated, purpose-built dashboard.

### Core Problem It Solves

Traditional NGO workforce management relies on paper registers and manual reporting, making it prone to proxy attendance, data loss, and poor accountability. Sahayog replaces this with:

- 🔐 **Biometric face-recognition attendance** to prevent proxy check-ins
- 📍 **GPS geo-fencing** to verify workers are physically at the task site
- 📋 **Digital task assignment** with structured field reporting
- 📊 **Real-time analytics** for administrators and team leads

---

## 🚀 Features Implemented

### 👷 Field Worker Portal

| Feature | Description |
|---|---|
| **Worker Dashboard** | Personalized view of today's tasks, attendance status, and recent activity |
| **Guided Check-In / Check-Out** | Step-by-step wizard: GPS → Face Capture → Before/After Photo → Confirm |
| **GPS Geo-Fencing** | Haversine-based proximity check; out-of-range check-ins are flagged (not blocked) |
| **Biometric Face Recognition** | Webcam live capture verified against a registered face encoding via Flask microservice |
| **Early Checkout Protection** | Forces workers to submit a written reason if checking out before scheduled end time |
| **Task Management** | View assigned tasks, details, location on map, and work type |
| **Field Reports** | Dynamic forms configured per-task; supports photo evidence uploads (up to 5 images) |
| **Leave Requests** | Apply for leave with type selection; track approval status in real time |
| **Attendance History** | View personal attendance logs with verification status and flagging notes |

### 👔 Team Lead Portal

| Feature | Description |
|---|---|
| **Team Lead Dashboard** | Live stats: Active tasks, Workers present ratio, Flagged records, Pending leaves |
| **Smart Task Creation** | Multi-step task builder with debounced location lookup, conflict-aware worker scheduling, and fatigue warnings (>35 hrs/week) |
| **Task Management** | View all created tasks, drill into individual task detail pages |
| **Attendance Review** | Review and approve/reject worker attendance records with mandatory action remarks |
| **Flagged Records** | Dedicated view for proximity-flagged or face-match-failed check-ins requiring resolution |
| **Leave Management** | Approve or reject leave applications with remark history |
| **Field Reports** | Browse field reports submitted by workers for their assigned tasks |

### 🛡️ Admin Portal

| Feature | Description |
|---|---|
| **Admin Dashboard** | Organization-wide operational overview with rich Chart.js analytics |
| **NGO Attendance Trend** | Rolling 30-day line chart showing overall attendance rate |
| **Verification Status Chart** | Doughnut chart: Verified / Pending / Flagged / Rejected proportions |
| **Team Performance Comparison** | Horizontal bar chart ranking teams by compliance rate |
| **Task Type Analysis** | Grouped bar chart: attendance ratios by work category |
| **Delta Tracking** | Month-over-month variance indicators (↑ 5.2% / ↓ 2%) |
| **User Management** | Activate/deactivate users, assign roles, view all registered users |
| **Lead Nudge System** | Identify team leads who have not submitted weekly summaries and send nudge alerts |
| **Report Generation** | Paginated structured reports with one-click CSV export |

### 🔒 Cross-Cutting Features

- JWT-based authentication with role-based route protection
- Responsive sidebar + hamburger drawer (mobile-first) powered by Framer Motion
- Cloudinary cloud storage for face images, attendance photos, and field report uploads
- Toast notifications for all async actions
- Soft organic design system with curated color palette (primary green `#246427`, accent gold `#F8AC3B`)

---

## 🏗️ Tech Stack

### Frontend (`/client`)

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | TailwindCSS v3 |
| Animations | Framer Motion |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| HTTP Client | Axios |
| Camera | react-webcam |
| Notifications | react-toastify |
| Date Utilities | date-fns |
| Fonts | Google Fonts — Outfit (UI), Merriweather (brand logo) |

### Backend (`/server`)

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express v5 |
| Database | MongoDB Atlas via Mongoose |
| Authentication | JWT (jsonwebtoken) + bcrypt |
| File Uploads | Multer + multer-storage-cloudinary |
| Cloud Storage | Cloudinary |
| Input Validation | express-validator |
| Environment | dotenv |

### Python Microservice (`/python_service`)

| Layer | Technology |
|---|---|
| Framework | Flask + Flask-CORS |
| Face Recognition | face_recognition (dlib-based, 128-dim encodings) |
| Image Processing | Pillow + NumPy |
| Database Access | PyMongo (shared MongoDB URI) |
| Environment | python-dotenv |

### Database Schema — Key Models

| Model | Purpose |
|---|---|
| `User` | All roles (ADMIN, TEAM_LEAD, FIELD_WORKER) with face encoding storage |
| `Task` | Task definitions with location, time window, assigned workers |
| `AttendanceRecord` | Check-in/out events with GPS data, face match results, and photos |
| `LeaveRequest` | Leave applications with approval workflow |
| `FieldReport` | Dynamic field reports with photo evidence |
| `Notification` | System notifications and lead nudges |
| `ActivityLog` | Audit trail for all key actions |
| `AdminReport` | Organization-level compiled reports |

---

## ⚙️ Installation & Running the Project

### Prerequisites

- **Node.js** v18+ and npm
- **Python 3.10.x** (required for `dlib` and `face_recognition`)
- **MongoDB Atlas** account (or local MongoDB)
- **Cloudinary** account (free tier is sufficient)

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/PBL_Seva_Setu2.git
cd PBL_Seva_Setu2
```

---

### Step 2 — Set Up the Backend Server

```bash
cd server
npm install
```

Create a `.env` file inside `/server` (refer to `.env.example`):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=<AppName>
PORT=5000
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here

# Python Face Recognition Service
PYTHON_SERVICE_URL=http://localhost:5001
```

**Seed the database with demo users and tasks:**

```bash
node seed.js
```

**Start the server:**

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

---

### Step 3 — Set Up the Python Face Recognition Microservice

> ⚠️ **Requires Python 3.10.x** — `dlib` is not compatible with newer Python versions on Windows.

```bash
cd python_service
py -3.10 -m pip install -r requirements.txt
```

> If you encounter a `dlib` installation error, install in two steps:
> ```bash
> py -3.10 -m pip install dlib-bin==19.24.6 face-recognition-models==0.3.0
> py -3.10 -m pip install face-recognition==1.3.0 --no-deps
> ```

Create a `.env` file inside `/python_service`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/
MONGODB_DB_NAME=sevasetu
```

**Start the microservice:**

```bash
# Windows PowerShell
.\run.ps1

# Or directly:
py -3.10 app.py
```

The face service will be available at `http://localhost:5001`.

> 💡 **Mock Mode:** If `face_recognition` is not installed, the service automatically falls back to mock mode (always returns `match: true`), allowing full development and testing without biometric hardware.

---

### Step 4 — Set Up the Frontend Client

```bash
cd client
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

---

### Running All Three Services Together

Open three separate terminal windows:

| Terminal | Command | URL |
|---|---|---|
| Backend | `cd server && npm run dev` | `http://localhost:5000` |
| Python Service | `cd python_service && py -3.10 app.py` | `http://localhost:5001` |
| Frontend | `cd client && npm run dev` | `http://localhost:5173` |

---

## 🔑 Demo Credentials (after running `node seed.js`)

| Role | Username | Password |
|---|---|---|
| 🛡️ Admin | `admin@sevasetu.gov.in` | `password123` |
| 👔 Team Lead | `lead@sevasetu.gov.in` | `password123` |
| 👷 Field Worker | `worker@sevasetu.gov.in` | `password123` |
| 👷 Field Worker | `anjali@sevasetu.gov.in` | `password123` |

---

## 📸 Screenshots

![Sahayog Landing Page](./1.png)
![Worker Dashboard](./2.png)
![Mark Attendance](./3.png)
![Admin Dashboard](./4.png)

---

## 🌐 Deployment Link

> If deployed, add your live URL here:
>
> **Live App:** `https://your-deployment-url.com`

---

## 📁 Project Structure

```
PBL_Seva_Setu2/
├── client/                     # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── admin/          # AdminDashboard, UserManagement
│       │   ├── teamlead/       # Dashboard, Tasks, Attendance, Leave, Reports, Flags
│       │   └── worker/         # Dashboard, Tasks, Attendance, Leave, Reports
│       ├── components/         # Layout, LoginModal, RegisterModal, ProtectedRoute
│       ├── context/            # AuthContext (JWT auth state)
│       └── utils/
├── server/                     # Node.js + Express backend
│   ├── models/                 # Mongoose schemas (User, Task, Attendance, etc.)
│   ├── routes/                 # API route definitions
│   ├── controllers/            # Business logic handlers
│   ├── middlewares/            # Auth middleware, error handler
│   ├── services/               # External service integrations (Cloudinary, Python)
│   ├── utils/                  # Shared helpers
│   ├── seed.js                 # Database seeder script
│   ├── .env.example            # Environment variable template
│   └── index.js                # App entry point (port 5000)
└── python_service/             # Flask face recognition microservice
    ├── app.py                  # /register-face, /verify-face, /health endpoints
    ├── requirements.txt        # Python dependencies
    ├── run.bat                 # Windows CMD runner
    └── run.ps1                 # Windows PowerShell runner
```

---

## 🔧 Required Credentials & Setup

### MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Add a database user with **Read and Write** permissions
3. Whitelist your IP (`0.0.0.0/0` for development)
4. Copy the connection string → set as `MONGODB_URI` in both `/server/.env` and `/python_service/.env`

### Cloudinary

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Go to **Dashboard** → copy `Cloud Name`, `API Key`, and `API Secret`
3. Set them in `/server/.env` as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### JWT Secret

- Set `JWT_SECRET` to any long random string in `/server/.env`
- Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 📄 Additional Documentation

- [UI/UX Design Decisions](./UI_UX_Design_Decisions.md) — Full design system, color tokens, typography, and UX rationale for all three portals

---

## 👩‍💻 Team

Built as part of the **SheSolves 3.0 Hackathon** — Team Sahayog.

---

## 📜 License

This project is built for academic and demonstration purposes.
