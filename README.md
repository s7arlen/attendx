# AttendX - Smart Attendance System

> Modern attendance management system with biometric and facial recognition verification

## 🎯 Features

- **Dual Verification Methods**
  - Biometric (WebAuthn - Fingerprint/Face ID)
  - Facial Recognition (Camera-based, TensorFlow.js)
- **QR Code Sessions** - Teachers broadcast attendance sessions
- **Offline Support** - Students can mark attendance without internet, sync when online
- **Real-time Monitoring** - Live attendance tracking with socket.io
- **Admin Dashboard** - Comprehensive analytics and reporting
- **Role-Based Access** - Admin, Teacher, Student roles with specific permissions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB
- npm or yarn

### Installation

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`  
Backend runs on `http://localhost:5000`

## 📁 Project Structure

```
attendex/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── models/       # MongoDB schemas
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Helper functions
│   │   └── config/       # Configuration
│   └── package.json
├── frontend/             # React application
│   ├── src/
│   │   ├── pages/        # React pages
│   │   ├── components/   # React components
│   │   ├── services/     # API services
│   │   ├── hooks/        # Custom hooks
│   │   ├── store/        # State management (Zustand)
│   │   └── types/        # TypeScript types
│   └── package.json
└── README.md
```

## 🔑 Key Technologies

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- WebAuthn (SimpleWebAuthn)
- Socket.io
- JWT Authentication

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand
- face-api.js (Facial Recognition)

## ✨ Verification Methods

### Biometric (WebAuthn)
- Uses device fingerprint or Face ID
- Stored locally on device
- Private key never leaves device

### Facial Recognition
- Client-side face detection
- 128-dimensional face embeddings
- ~95% accuracy
- No video transmission (privacy-first)

## 🔐 Security

- HTTPS enforced
- Rate limiting on sensitive endpoints
- Full audit logging
- Password hashing with bcrypt
- JWT token-based authentication
- CORS configured

## 📚 Documentation

For detailed guides, see:
- **Implementation:** `docs/FACIAL_RECOGNITION_IMPLEMENTATION.md`
- **Testing:** `docs/FACIAL_RECOGNITION_TESTING.md`
- **Deployment:** `docs/DEPLOYMENT.md`

## 🧪 Testing

### Local Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Type checking
npm run lint
```

## 🚀 Deployment

See `docs/DEPLOYMENT.md` for detailed deployment instructions.

### Production Checklist
- [ ] Database backed up
- [ ] Environment variables configured
- [ ] HTTPS certificates ready
- [ ] API rate limiting tested
- [ ] Audit logging verified

## 👥 User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Manage users, view analytics, configure system |
| **Teacher** | Create sessions, view attendance, export reports |
| **Student** | Mark attendance, view history, raise disputes |

## 🤝 Contributing

1. Create feature branch (`git checkout -b feat/feature-name`)
2. Commit changes (`git commit -m "feat: description"`)
3. Push to branch (`git push origin feat/feature-name`)
4. Open Pull Request

## 📞 Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review existing issues on GitHub
3. Contact development team

## 📝 License

This project is proprietary and confidential.

## 🎉 Recent Updates

- ✨ Facial recognition feature added
- ✅ Password-based verification removed
- 🔄 Offline attendance support
- 📊 Enhanced analytics dashboard

---

**Last Updated:** November 2024
