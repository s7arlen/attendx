import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected\n');

  const teachers = await User.find({ role: 'teacher', isActive: true }).sort({ name: 1 });
  const subjects = await Subject.find({ isActive: true }).populate('assignedTeacher', 'name email');

  // Map teacherId -> subjects
  const map: Record<string, any[]> = {};
  for (const s of subjects) {
    const t = s.assignedTeacher as any;
    const tid = t?._id?.toString() || '';
    if (!map[tid]) map[tid] = [];
    map[tid].push(s.subjectCode + ' | ' + s.subjectName);
  }

  console.log('=== TEACHER → SUBJECTS ===\n');
  for (const t of teachers) {
    const tid = t._id.toString();
    const subs = map[tid] || [];
    console.log(t.name + ' <' + t.email + '>');
    if (subs.length) {
      subs.forEach(s => console.log('  ✓ ' + s));
    } else {
      console.log('  ✗ NO SUBJECTS ASSIGNED');
    }
    console.log('');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
