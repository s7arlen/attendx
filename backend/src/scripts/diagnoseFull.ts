import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function diagnose() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected\n');

  // Check all subjects
  const subjects = await Subject.find({ isActive: true });
  console.log('=== SUBJECTS IN DB ===');
  for (const s of subjects) {
    console.log(`${s.subjectCode} | dept="${s.department}" | year=${s.year} | section="${s.section}" | active=${s.isActive}`);
  }

  // Check all students
  const students = await User.find({ role: 'student', isActive: true }).sort({ rollNumber: 1 });
  console.log('\n=== STUDENTS IN DB ===');
  for (const s of students) {
    console.log(`${s.rollNumber} | ${s.name} | dept="${s.department}" | year=${s.year} | section="${s.section}"`);
  }

  // Simulate getMySubjects for first real student
  const student = students.find(s => s.rollNumber?.startsWith('4CB'));
  if (student) {
    console.log(`\n=== SIMULATING getMySubjects FOR: ${student.name} ===`);
    console.log(`Query: department="${student.department}" year=${student.year} section="${student.section}"`);
    const matched = await Subject.find({
      department: student.department,
      year: student.year,
      section: student.section,
      isActive: true,
    });
    console.log(`Matched subjects: ${matched.length}`);
    matched.forEach(s => console.log(`  ✓ ${s.subjectCode} - ${s.subjectName}`));
    if (matched.length === 0) {
      console.log('\nMISMATCH DETAILS:');
      console.log('Student dept:', JSON.stringify(student.department));
      console.log('Subject depts:', [...new Set(subjects.map(s => JSON.stringify(s.department)))].join(', '));
      console.log('Student year:', JSON.stringify(student.year));
      console.log('Subject years:', [...new Set(subjects.map(s => JSON.stringify(s.year)))].join(', '));
      console.log('Student section:', JSON.stringify(student.section));
      console.log('Subject sections:', [...new Set(subjects.map(s => JSON.stringify(s.section)))].join(', '));
    }
  }

  await mongoose.disconnect();
}

diagnose().catch(console.error);
