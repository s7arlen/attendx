# Facial Recognition Testing Guide

## Setup & Installation

### 1. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
npm install
```

### 2. Environment Setup

Ensure your `.env` files are configured:

**Backend** (`.env`):
```
DATABASE_URL=your_mongo_url
WEBAUTHN_RP_ID=localhost  # or your domain
WEBAUTHN_ORIGIN=http://localhost:5173
NODE_ENV=development
```

**Frontend** (`.env` - if needed):
```
VITE_API_URL=http://localhost:5000
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Should be running on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Should be running on http://localhost:5173
```

## Testing Workflow

### Test 1: Register & Mark Attendance with Facial Recognition

1. **Login as Student**
   - Email: `student@example.com`
   - Password: (from your test data)

2. **Teacher: Start Session**
   - Login as teacher
   - Go to your subject
   - Click "Start Session"
   - Note the session code shown on screen

3. **Student: Scan QR and Select Facial Recognition**
   - On ScanQRPage, click "Enter Code" (or scan if available)
   - Enter the session code from step 2
   - Choose verification method: "Facial Recognition"
   - Grant camera permission when prompted

4. **Face Registration**
   - Position your face in the circular guide
   - The system will capture 3 frames
   - Ensure good lighting and clear face visibility
   - Wait for "Face registered successfully!" message

5. **Verify Attendance**
   - Face comparison happens automatically
   - You should see "Attendance Marked" confirmation
   - Check "View Attendance Receipt" to confirm

### Test 2: Mark Attendance Again (Cached Face)

1. **Teacher: Start New Session**
   - Start another session

2. **Student: Use Facial Recognition**
   - Scan/Enter session code
   - Choose "Facial Recognition"
   - Single face capture this time (much faster)
   - Attendance should be marked immediately

### Test 3: Switch Between Verification Methods

1. **Same Session, Multiple Students**
   - Student A: Use Biometric
   - Student B: Use Facial Recognition
   - Verify both methods work in parallel

### Test 4: Error Scenarios

**Multiple Faces in Frame:**
- Position 2 people in frame
- Should get error: "Multiple faces detected"

**No Face Detected:**
- Position away from camera
- Should get error: "No face detected"

**Poor Lighting:**
- Dim the lights
- Try to register face
- Should handle gracefully

**Camera Not Available:**
- Deny camera permission
- Should show: "Camera Not Available" message
- Can still use Biometric method

### Test 5: Verification Failures

**Different Person:**
- Register as User A
- Try to verify as User B
- Should fail verification
- Error: "Face verification failed"

**Same Person, Different Lighting:**
- Register in bright light
- Try to verify in dim light
- Should still work (threshold is generous)
- Adjust threshold if too strict/lenient

## Database Verification

### Check Face Descriptor Stored

**MongoDB:**
```javascript
// Find user and check face descriptor
db.users.findOne({ email: "student@example.com" }, { faceDescriptor: 1 })

// Should return:
{
  _id: ObjectId(...),
  faceDescriptor: {
    descriptor: [0.123, -0.456, 0.789, ...], // 128 numbers
    capturedAt: ISODate("2024-01-15T10:30:00Z")
  }
}
```

### Check Attendance Record

```javascript
// Find attendance record with facial recognition
db.attendancerecords.findOne(
  { verificationMethod: "facial_recognition" },
  { verificationMethod: 1, timestamp: 1, studentId: 1 }
)

// Should return:
{
  _id: ObjectId(...),
  verificationMethod: "facial_recognition",
  timestamp: ISODate("2024-01-15T10:35:00Z"),
  studentId: ObjectId(...)
}
```

## Console Debugging

### Enable Debug Logs

**Frontend Console** (F12):
- Open DevTools
- Go to Network tab to see API calls
- Look for `/attendance/face/register` and `/attendance/face/verify`
- Check response payload includes similarity scores

**Backend Logs:**
- Check terminal output for audit logs
- Look for `REGISTER_FACE` and `VERIFY_ATTENDANCE_FACE` entries
- Should show similarity score and timestamp

## Performance Testing

### Measure Response Times

```javascript
// In browser console
const start = performance.now();
// Click verify button
// Wait for success
const end = performance.now();
console.log(`Face verification took ${(end - start) / 1000} seconds`);
// Expected: 2-4 seconds total
```

### Model Loading Time

```javascript
// In face-api init
console.time('Model Loading');
await initializeFaceAPI();
console.timeEnd('Model Loading');
// Expected: 2-3 seconds
```

## Troubleshooting During Testing

| Issue | Solution |
|-------|----------|
| Models won't load | Check browser console for 404 errors, verify CDN access |
| Camera permission denied | Check browser settings, try in incognito mode |
| Face not detected | Check lighting, remove obstructions, ensure face is clear |
| Verification always fails | Check threshold (should be ~0.65), try in similar lighting |
| API 404 errors | Verify routes in `attendance.routes.ts`, check backend running |
| CORS errors | Backend should allow frontend origin, check CORS middleware |

## Test Data

### Create Test Student

**MongoDB:**
```javascript
db.users.insertOne({
  name: "Test Student",
  email: "test.student@example.com",
  passwordHash: "$2a$10...", // bcrypt hashed password
  role: "student",
  department: "CSE",
  year: 2,
  section: "A",
  rollNumber: "CS001",
  isActive: true,
  webauthnCredentials: [],
  createdAt: new Date(),
  updatedAt: new Date()
})
```

## Post-Testing Checklist

- [ ] Face registration stores descriptor correctly
- [ ] Attendance record shows "facial_recognition" method
- [ ] Similarity scores are reasonable (0.65-1.0)
- [ ] Error handling for edge cases works
- [ ] Multiple students can register different faces
- [ ] Same student can verify multiple times
- [ ] Fallback to biometric works
- [ ] Rate limiting applies to face verification
- [ ] Audit logs record facial recognition attempts
- [ ] No sensitive data in logs/responses

## Performance Benchmarks

Expected metrics on modern hardware:

| Operation | Time |
|-----------|------|
| Model loading | 2-3s |
| Single face capture | 0.5-1s |
| 3 frames capture (registration) | 1.5-2s |
| Descriptor processing | 0.1s |
| API round trip | 0.5-1s |
| **Total registration** | **~5-7s** |
| **Total verification** | **~2-4s** |

## Notes

- Face-api models are cached after first load
- Subsequent verifications are much faster
- Works on mobile browsers (iOS Safari, Chrome Mobile)
- Requires HTTPS in production (camera access)
- No personal data transmitted, only embeddings
