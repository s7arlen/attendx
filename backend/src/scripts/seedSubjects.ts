import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import { Subject } from '../models/Subject.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

const teachersData = [
  { name: 'Ms. Raksha Salian',        email: 'raksha.salian@attendx.com'    },
  { name: 'Dr. Nagesh H R',           email: 'nagesh.hr@attendx.com'         },
  { name: 'Ms. Saritha M',            email: 'saritha.m@attendx.com'         },
  { name: 'Dr. Babitha Ganesh Kulal', email: 'babitha.kulal@attendx.com'     },
  { name: 'Ms. Saritha Suvarna',      email: 'saritha.suvarna@attendx.com'   },
  { name: 'Ms. Bhavana D',            email: 'bhavana.d@attendx.com'         },
  { name: 'Ms. Aruna Kumari G K',     email: 'aruna.kumari@attendx.com'      },
  { name: 'Mr. Ajay S Shet',          email: 'ajay.shet@attendx.com'         },
  { name: 'Mr. Ravikumar D Kodasal',  email: 'ravikumar.kodasal@attendx.com' },
  { name: 'Mr. Adithya M',            email: 'adithya.m@attendx.com'         },
];

const subjectsData = [
  { subjectCode: '1BMCAS301', subjectName: 'Probability, Distributions and Statistics',          credits: 4, teacherEmail: 'raksha.salian@attendx.com'    },
  { subjectCode: '1BCSIP302', subjectName: 'Object Oriented Programming with Java (OOPS)',       credits: 4, teacherEmail: 'nagesh.hr@attendx.com'         },
  { subjectCode: '1BCSPC303', subjectName: 'Digital Design and Computer Organization (DDCO)',    credits: 4, teacherEmail: 'saritha.m@attendx.com'         },
  { subjectCode: '1BCSPC304', subjectName: 'Operating Systems (OS)',                             credits: 3, teacherEmail: 'babitha.kulal@attendx.com'     },
  { subjectCode: '1BCSPC305', subjectName: 'Data Structures and Applications (DS)',              credits: 3, teacherEmail: 'saritha.suvarna@attendx.com'   },
  { subjectCode: '1BCSPL306', subjectName: 'Data Structures and Applications Laboratory (DS LAB)', credits: 1, teacherEmail: 'saritha.suvarna@attendx.com'},
  { subjectCode: '1BCSAL307', subjectName: 'Project Management (with Git)',                      credits: 1, teacherEmail: 'bhavana.d@attendx.com'         },
  { subjectCode: '1BCSPJ308', subjectName: 'Community Project (Project-Based Learning)',         credits: 1, teacherEmail: 'aruna.kumari@attendx.com'      },
  { subjectCode: '1BSHMC391', subjectName: 'National Service Scheme (NSS)',                      credits: 0, teacherEmail: 'ajay.shet@attendx.com'         },
  { subjectCode: '1BSHMC392', subjectName: 'Physical Education (PE) (Sports and Athletics)',     credits: 0, teacherEmail: 'ravikumar.kodasal@attendx.com' },
  { subjectCode: '1BSHMC393', subjectName: 'Yoga',                                              credits: 0, teacherEmail: 'aruna.kumari@attendx.com'      },
  { subjectCode: '1BSHMC394', subjectName: 'Music',                                             credits: 0, teacherEmail: 'adithya.m@attendx.com'         },
];

async function seedSubjects() {
  try {
    console.log('[seed] Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Connected\n');

    // Step 1: Create teachers if they don't exist
    console.log('--- Creating Teachers ---');
    for (const t of teachersData) {
      const existing = await User.findOne({ email: t.email });
      if (existing) {
        console.log(`[skip] Teacher already exists: ${t.name}`);
        continue;
      }
      const passwordHash = await bcrypt.hash('Teacher@123', 12);
      try {
        await User.create({
          name: t.name,
          email: t.email,
          passwordHash,
          role: 'teacher',
          department: 'Computer Science',
          section: 'A',
          isActive: true,
        });
        console.log(`[created] Teacher: ${t.name}`);
      } catch (e: any) {
        if (e.code === 11000) {
          console.log(`[skip] Duplicate teacher (race): ${t.name}`);
        } else {
          throw e;
        }
      }
    }

    // Step 2: Create subjects
    console.log('\n--- Creating Subjects ---');
    for (const s of subjectsData) {
      const existing = await Subject.findOne({ subjectCode: s.subjectCode });
      if (existing) {
        console.log(`[skip] Subject already exists: ${s.subjectCode}`);
        continue;
      }
      const teacher = await User.findOne({ email: s.teacherEmail });
      if (!teacher) {
        console.log(`[error] Teacher not found for subject ${s.subjectCode}: ${s.teacherEmail}`);
        continue;
      }
      await Subject.create({
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        credits: s.credits,
        assignedTeacher: teacher._id,
        department: 'Computer Science',
        year: 3,
        section: 'A',
        isActive: true,
      });
      console.log(`[created] Subject: ${s.subjectCode} - ${s.subjectName}`);
    }

    console.log('\n[seed] All done!');
    console.log('\nTeacher login password: Teacher@123');
  } catch (err) {
    console.error('[seed] Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedSubjects();
