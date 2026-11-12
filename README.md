# AttendX

> Secure QR-based Attendance Management Platform with WebAuthn biometrics and real-time tracking.

AttendX is a full-stack platform designed for modern academic institutions to streamline and secure attendance tracking using dynamic QR codes, biometric verification (WebAuthn), real-time notifications via WebSockets, and comprehensive role-based dashboards (Admin, Teacher, Student).

---

## 🚀 Features

- **Dynamic QR Code Attendance**: Time-sensitive, cryptographic QR codes to prevent proxy attendance.
- **Biometric Authentication**: WebAuthn support for secure authentication.
- **Role-Based Access Control**:
  - **Admin**: Manage teachers, students, subjects, timetables, disputes, audit logs, and view system-wide analytics.
  - **Teacher**: Create and manage attendance sessions, view subject analytics, handle attendance records.
  - **Student**: Scan session QR codes, track attendance percentages, view subject-wise breakdowns.
- **Real-Time Communication**: WebSocket / Socket.IO integration for live attendance updates and notifications.
- **Auditing & Reporting**: Detailed audit logs and exportable attendance reports.
- **Media Uploads**: Profile avatar management via Cloudinary or local fallback storage.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS, Lucide React icons
- **State Management**: Zustand
- **Networking**: Axios, Socket.IO Client

### Backend
- **Runtime**: Node.js & Express with TypeScript
- **Database**: MongoDB via Mongoose
- **Authentication**: JWT & SimpleWebAuthn
- **Real-Time**: Socket.IO
- **Validation**: Zod
- **Security**: Helmet, express-rate-limit, bcryptjs

---

## 📁 Project Structure

```text
attendx/
├── backend/               # Express + TypeScript API server
│   ├── src/
│   │   ├── config/        # Database and socket configuration
│   │   ├── controllers/   # Route handlers (admin, auth, student, teacher, etc.)
│   │   ├── middleware/    # Auth, error handling, rate limiting
│   │   ├── models/        # Mongoose data models
│   │   ├── routes/        # Express API endpoints
│   │   ├── scripts/       # Seed scripts
│   │   └── utils/         # Helper functions (JWT, QR, mailer, audit log)
│   └── package.json
├── frontend/              # React + Vite frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components & layouts
│   │   ├── hooks/         # Custom hooks (toast, socket, etc.)
│   │   ├── pages/         # Admin, Teacher, Student, and Auth views
│   │   ├── services/      # API communication layer
│   │   ├── store/         # Zustand global stores
│   │   └── types/         # TypeScript definitions
│   └── package.json
├── package.json           # Root workspace config
└── README.md
```

---

## ⚡ Getting Started

### Prerequisites
- Node.js (v18 or newer)
- npm or yarn
- MongoDB (local or MongoDB Atlas connection)

### 1. Installation
Clone the repository and install dependencies:
```bash
npm run install:all
```

### 2. Environment Configuration
Copy the environment example file in the backend directory:
```bash
cp backend/.env.example backend/.env
```
Update `backend/.env` with your MongoDB URI, JWT secrets, and optionally SMTP and Cloudinary credentials.

### 3. Database Seeding (Optional)
To seed initial demo data:
```bash
npm run seed --workspace=backend
```

### 4. Running Development Servers
To start both backend and frontend concurrently:
```bash
npm run dev
```

- Frontend runs at: `http://localhost:5173`
- Backend runs at: `http://localhost:5000`

---

## 📄 License
ISC
