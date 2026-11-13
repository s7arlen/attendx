import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Subject } from '../models/Subject.model';
import { User } from '../models/User.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function fix() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected\n');

  // Fix 1BMCAS301 - wrong dept/year/section and wrong teacher
  const raksha = await User.findOne({ email: 'raksha.salian@attendx.com' });
  if (!raksha) {
    console.log('ERROR: Ms. Raksha Salian not found');
    process.exit(1);
  }

  const result = await Subject.findOneAndUpdate(
    { subjectCode: '1BMCAS301' },
    {
      department: 'Computer Science',
      year: 3,
      section: 'A',
      assignedTeacher: raksha._id,
      isActive: true,
    },
    { new: true }
  );

  if (result) {
    console.log('FIXED 1BMCAS301:');
    console.log('  dept=' + result.department);
    console.log('  year=' + result.year);
    console.log('  section=' + result.section);
    console.log('  teacher=' + raksha.name);
  } else {
    console.log('Subject 1BMCAS301 not found');
  }

  // Final check - all subjects
  const all = await Subject.find({ isActive: true }).sort({ subjectCode: 1 });
  console.log('\n=== ALL SUBJECTS FINAL STATE ===');
  for (const s of all) {
    console.log(`${s.subjectCode} | dept="${s.department}" | year=${s.year} | section="${s.section}"`);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

fix().catch(console.error);
