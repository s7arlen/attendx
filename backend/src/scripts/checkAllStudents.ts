import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.model';

dotenv.config();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to: ' + MONGO_URI.split('@')[1]?.split('?')[0] + '\n');

  const all = await User.find({ role: 'student' }).select('name email rollNumber department year section isActive createdAt').sort({ createdAt: -1 });
  console.log('Total students: ' + all.length);
  console.log('');
  
  all.forEach(s => {
    const created = s.createdAt.toISOString().split('T')[0];
    console.log(`${created} | ${s.rollNumber || 'NO-ROLL'.padEnd(12)} | ${s.name.padEnd(30)} | ${s.email}`);
  });

  // Check for old dummy students by email pattern
  const dummies = await User.find({ 
    role: 'student',
    email: { $in: ['student1@attendx.com', 'student2@attendx.com', 'len@gmail.com'] }
  });

  if (dummies.length > 0) {
    console.log('\n=== OLD DUMMY STUDENTS FOUND ===');
    for (const d of dummies) {
      console.log(`  ${d.email} | ${d.name} | _id: ${d._id}`);
    }
    console.log('\nDelete them? (run script with --delete)');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
