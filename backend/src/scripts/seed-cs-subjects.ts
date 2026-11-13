import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

interface FacultyItem {
  name: string;
  email: string;
  department: string;
}

const facultyMembers: FacultyItem[] = [
  { name: 'Ms. Raksha Salian', email: 'raksha.salian@attendx.com', department: 'Computer Science' },
  { name: 'Dr. Nagesh H R', email: 'nagesh.hr@attendx.com', department: 'Computer Science' },
  { name: 'Ms. Saritha M', email: 'saritha.m@attendx.com', department: 'Computer Science' },
  { name: 'Dr. Babitha Ganesh Kulal', email: 'babitha.kulal@attendx.com', department: 'Computer Science' },
  { name: 'Ms. Saritha Suvarna', email: 'saritha.suvarna@attendx.com', department: 'Computer Science' },
  { name: 'Ms. Bhavana D', email: 'bhavana.d@attendx.com', department: 'Computer Science' },
  { name: 'Ms. Aruna Kumari G K', email: 'aruna.kumari@attendx.com', department: 'Computer Science' },
  { name: 'Mr. Ajay S Shet', email: 'ajay.shet@attendx.com', department: 'Computer Science' },
  { name: 'Mr. Ravikumar D Kodasal', email: 'ravikumar.kodasal@attendx.com', department: 'Computer Science' },
  { name: 'Mr. Adithya M', email: 'adithya.m@attendx.com', department: 'Computer Science' },
];

const subjectsData = [
  {
    subjectName: 'Probability, Distributions and Statistics',
    subjectCode: '1BMCAS301',
    credits: 4,
    teacherName: 'Ms. Raksha Salian',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'ASC | L-T-P: 3-2-0',
  },
  {
    subjectName: 'Object Oriented Programming with Java (OOPS)',
    subjectCode: '1BCSIP302',
    credits: 4,
    teacherName: 'Dr. Nagesh H R',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'IPCC | L-T-P: 3-0-2',
  },
  {
    subjectName: 'Digital Design and Computer Organization (DDCO)',
    subjectCode: '1BCSPC303',
    credits: 4,
    teacherName: 'Ms. Saritha M',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'PCC | L-T-P: 4-0-0',
  },
  {
    subjectName: 'Operating Systems (OS)',
    subjectCode: '1BCSPC304',
    credits: 3,
    teacherName: 'Dr. Babitha Ganesh Kulal',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'PCC | L-T-P: 3-0-0',
  },
  {
    subjectName: 'Data Structures and Applications (DS)',
    subjectCode: '1BCSPC305',
    credits: 3,
    teacherName: 'Ms. Saritha Suvarna',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'PCC | L-T-P: 3-0-0',
  },
  {
    subjectName: 'Data Structures and Applications Laboratory (DS LAB)',
    subjectCode: '1BCSPL306',
    credits: 1,
    teacherName: 'Ms. Saritha Suvarna',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'PCCL | L-T-P: 0-0-2 | Additional Faculty: Ms. Sowmya K (B1), Ms. Kavya A M (B2)',
  },
  {
    subjectName: 'Project Management (with Git)',
    subjectCode: '1BCSAL307',
    credits: 1,
    teacherName: 'Ms. Bhavana D',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'AEC | L-T-P: 0-0-2 | Additional Faculty: Mr. Adithya M (B1), Mr. Kishor Shivathaya (B2)',
  },
  {
    subjectName: 'Community Project (Project-Based Learning) / Societal Project',
    subjectCode: '1BCSPJ308',
    credits: 1,
    teacherName: 'Ms. Aruna Kumari G K',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'SDC | L-T-P: 0-0-0',
  },
  {
    subjectName: 'National Service Scheme (NSS)',
    subjectCode: '1BSHMC391',
    credits: 0,
    teacherName: 'Mr. Ajay S Shet',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'NCMC | L-T-P: 0-0-0',
  },
  {
    subjectName: 'Physical Education (PE) (Sports and Athletics)',
    subjectCode: '1BSHMC392',
    credits: 0,
    teacherName: 'Mr. Ravikumar D Kodasal',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'NCMC | L-T-P: 0-0-0',
  },
  {
    subjectName: 'Yoga',
    subjectCode: '1BSHMC393',
    credits: 0,
    teacherName: 'Ms. Aruna Kumari G K',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'NCMC | L-T-P: 0-0-0',
  },
  {
    subjectName: 'Music',
    subjectCode: '1BSHMC394',
    credits: 0,
    teacherName: 'Mr. Adithya M',
    department: 'Computer Science',
    year: 2,
    section: 'A',
    description: 'NCMC | L-T-P: 0-0-0',
  },
];

async function seed() {
  try {
    console.log(`[seed] Connecting to MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Connected.');

    const defaultPasswordHash = await bcrypt.hash('Teacher@123', 10);
    const teacherMap = new Map<string, mongoose.Types.ObjectId>();

    // 1. Provision faculty accounts
    console.log('\n[seed] Provisioning faculty accounts...');
    for (const faculty of facultyMembers) {
      let user = await User.findOne({ email: faculty.email });
      if (!user) {
        user = await User.create({
          name: faculty.name,
          email: faculty.email,
          passwordHash: defaultPasswordHash,
          role: 'teacher',
          department: faculty.department,
          isActive: true,
        });
        console.log(`  + Created faculty: ${faculty.name} (${faculty.email})`);
      } else {
        user.name = faculty.name;
        user.role = 'teacher';
        user.department = faculty.department;
        user.isActive = true;
        await user.save();
        console.log(`  * Updated faculty: ${faculty.name} (${faculty.email})`);
      }
      teacherMap.set(faculty.name, user._id);
    }

    // 2. Ingest 12 Subjects
    console.log('\n[seed] Ingesting 12 2nd Year CS subjects...');
    for (const sub of subjectsData) {
      const teacherId = teacherMap.get(sub.teacherName);
      if (!teacherId) {
        throw new Error(`Teacher ID not found for ${sub.teacherName}`);
      }

      const subject = await Subject.findOneAndUpdate(
        { subjectCode: sub.subjectCode },
        {
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode,
          assignedTeacher: teacherId,
          department: sub.department,
          year: sub.year,
          section: sub.section,
          credits: sub.credits,
          description: sub.description,
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`  ✓ ${sub.subjectCode} - ${sub.subjectName} (${sub.credits} credits) -> ${sub.teacherName}`);
    }

    console.log('\n[seed] All 12 subjects successfully seeded!');
    process.exit(0);
  } catch (error) {
    console.error('[seed] Error seeding subjects:', error);
    process.exit(1);
  }
}

seed();
