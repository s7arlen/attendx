import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function test() {
  console.log('[test] Connecting to Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('[test] Connected\n');

  const { User } = await import('../models/User.model');
  const { Subject } = await import('../models/Subject.model');
  const { AttendanceSession } = await import('../models/AttendanceSession.model');
  const { AttendanceRecord } = await import('../models/AttendanceRecord.model');

  // Find Lenstar Monteiro as test student
  const student = await User.findOne({ email: 'lenstar.monteiro@attendx.com' });
  if (!student) { console.log('Student not found'); process.exit(1); }
  console.log('Test student: ' + student.name + ' (' + student.email + ')');

  // Find OOP subject
  const subject = await Subject.findOne({ subjectCode: '1BCSIP302' });
  if (!subject) { console.log('Subject not found'); process.exit(1); }
  console.log('Test subject: ' + subject.subjectName);

  // Find the teacher
  const teacher = await User.findById(subject.assignedTeacher);
  if (!teacher) { console.log('Teacher not found'); process.exit(1); }

  // Create 4 fake ended sessions (simulate 4 classes held)
  const sessionIds: mongoose.Types.ObjectId[] = [];
  for (let i = 0; i < 4; i++) {
    const sid = new mongoose.Types.ObjectId();
    await AttendanceSession.create({
      _id: sid,
      subjectId: subject._id,
      teacherId: teacher._id,
      sessionCode: 'TEST' + i,
      qrToken: 'token' + i,
      qrCodeData: 'data' + i,
      passwordCode: 'TEST0' + i,
      startTime: new Date(Date.now() - (i + 1) * 86400000),
      expiryTime: new Date(Date.now() - i * 86400000),
      status: 'ended',
      duration: 15,
    });
    sessionIds.push(sid);
    console.log('Created session ' + (i + 1));
  }

  // Mark student present in only 1 out of 4 = 25% (below 75%)
  await AttendanceRecord.create({
    studentId: student._id,
    subjectId: subject._id,
    sessionId: sessionIds[0],
    timestamp: new Date(),
    verificationMethod: 'password',
  });
  console.log('Marked student present in 1/4 sessions (25%) — should trigger alert\n');

  // Now run the alert job
  const { checkAndAlert } = await import('../jobs/attendanceAlert');
  await checkAndAlert();

  // Cleanup test data
  console.log('\n[cleanup] Removing test sessions and records...');
  await AttendanceSession.deleteMany({ _id: { $in: sessionIds } });
  await AttendanceRecord.deleteMany({ sessionId: { $in: sessionIds } });
  console.log('[cleanup] Done');

  await mongoose.disconnect();
}

test().catch(console.error);
