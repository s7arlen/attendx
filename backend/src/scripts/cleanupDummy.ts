import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function cleanup() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected\n');

  const dummies = ['teacher1@attendx.com', 'teacher2@attendx.com'];
  for (const email of dummies) {
    const result = await User.deleteOne({ email });
    if (result.deletedCount) {
      console.log('[deleted] ' + email);
    } else {
      console.log('[not found] ' + email);
    }
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

cleanup().catch(console.error);
