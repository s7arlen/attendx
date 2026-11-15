import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

async function test() {
  console.log('[test] Connecting to Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('[test] Connected\n');

  const { checkAndAlert } = await import('../jobs/attendanceAlert');
  await checkAndAlert();

  await mongoose.disconnect();
  console.log('[test] Done');
}

test().catch(console.error);
