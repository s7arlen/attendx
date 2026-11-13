import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.model';

dotenv.config();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected\n');

  const all = await User.find({ role: 'student' }).select('name email rollNumber department year section isActive').sort({ name: 1 });
  console.log('Total students in DB: ' + all.length);
  console.log('');
  for (const s of all) {
    console.log(`${s.rollNumber || 'NO-ROLL'} | ${s.name} | ${s.email} | dept="${s.department}" year=${s.year} sec="${s.section}" active=${s.isActive}`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
