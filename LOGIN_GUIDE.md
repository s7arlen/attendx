# ✅ Login Guide - AttendEx

**Status**: ✅ All test users created and ready to use

---

## 🔐 Test Credentials

You can now login with these test accounts:

### Student Account
```
Email:    test@example.com
Password: Test@12345
Role:     Student
```

### Teacher Account
```
Email:    teacher@example.com
Password: Teacher@12345
Role:     Teacher
```

### Admin Account
```
Email:    admin@example.com
Password: Admin@12345
Role:     Admin/Super User
```

---

## 🚀 How to Login

1. **Go to login page**: http://localhost:5173/login

2. **Enter credentials**:
   - Email: `test@example.com`
   - Password: `Test@12345`

3. **Click "Login"**

4. **Expected result**: 
   - ✅ Logged in successfully
   - ✅ Redirected to student dashboard
   - ✅ Can see attendance page

---

## 🛠️ If Login Still Fails

### Step 1: Check Browser Console
1. Open: http://localhost:5173/login
2. Press: **F12**
3. Click: **Console** tab
4. Try to login
5. Look for: Red error messages
6. Share: Error text with details

### Step 2: Verify Backend is Running
```powershell
Invoke-WebRequest http://localhost:4000/health -UseBasicParsing
```

Should show: `StatusCode 200`

### Step 3: Test API Directly
```powershell
$body = @{
  email = "test@example.com"
  password = "Test@12345"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:4000/api/auth/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body `
  -UseBasicParsing
```

Should return: Access token and user data

### Step 4: Check Database
```bash
mongosh attendx --eval "db.users.find({email:'test@example.com'}).pretty()"
```

Should show: User document with passwordHash

---

## ✨ Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid email or password" | Use exact credentials above |
| "User not found" | User not created - run creation script |
| "Cannot fetch API" | Backend not running - restart with `npm run dev` |
| Blank login page | Frontend not loaded - refresh browser (Ctrl+Shift+R) |
| CORS error | Backend CORS settings issue - check vite.config.ts proxy |
| "Network error" | Check F12 → Network tab for failed requests |

---

## 🧪 After Successful Login

### Student Dashboard Features
- ✅ Scan QR Code
- ✅ View Attendance
- ✅ Check Dashboard
- ✅ Facial Recognition (if implemented)

### Teacher Dashboard Features
- ✅ Create Sessions
- ✅ Generate QR Codes
- ✅ View Attendance Records
- ✅ Analytics

### Admin Dashboard Features
- ✅ Manage Users
- ✅ Manage Subjects
- ✅ System Analytics
- ✅ Audit Logs

---

## 🔄 Reset / Create New Users

### Create a New Student User

```bash
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  passwordHash: String,
  role: String,
  department: String,
  isActive: Boolean,
});

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/attendx');
    const User = mongoose.model('User', userSchema);
    
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('YourPassword123', salt);
    
    await User.create({
      name: 'Your Name',
      email: 'youremail@example.com',
      passwordHash,
      role: 'student',
      department: 'Computer Science',
      isActive: true,
    });
    
    console.log('✅ User created!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
})()
"
```

---

## 📱 Testing Different Roles

### Test as Student
1. Login: `test@example.com` / `Test@12345`
2. Access: http://localhost:5173/student
3. Can: Scan QR, view attendance, use facial recognition

### Test as Teacher
1. Login: `teacher@example.com` / `Teacher@12345`
2. Access: http://localhost:5173/teacher
3. Can: Create sessions, generate QR, view attendance

### Test as Admin
1. Login: `admin@example.com` / Admin@12345`
2. Access: http://localhost:5173/len-admin
3. Can: Manage users, subjects, view analytics

---

## 🔐 Security Notes

- Passwords are hashed with bcrypt (12 rounds)
- Tokens are JWT-based with expiry
- All login attempts are logged
- Sessions expire after configured time
- Credentials are stored securely

---

## ✅ You're Ready!

**Next steps**:
1. ✅ Open: http://localhost:5173/login
2. ✅ Login with test credentials
3. ✅ Explore the dashboard
4. ✅ Test facial recognition feature
5. ✅ Test QR code scanning

If you encounter any issues, check the browser console (F12) for error messages and let me know!

