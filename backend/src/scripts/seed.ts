import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

const seedUsers = [
  {
    name: 'Admin User',
    email: 'admin@attendx.com',
    password: 'Admin@123',
    role: 'admin' as const,
    department: 'Administration',
  },
  {
    name: 'Teacher One',
    email: 'teacher1@attendx.com',
    password: 'Teacher@123',
    role: 'teacher' as const,
    department: 'Computer Science',
    phone: '+1 234 567 8901',
  },
  {
    name: 'Teacher Two',
    email: 'teacher2@attendx.com',
    password: 'Teacher@123',
    role: 'teacher' as const,
    department: 'Mathematics',
    phone: '+1 234 567 8902',
  },
  {
    name: 'Student One',
    email: 'student1@attendx.com',
    password: 'Student@123',
    role: 'student' as const,
    department: 'Computer Science',
    year: 2,
    section: 'A',
    rollNumber: 'CS2024001',
  },
  {
    name: 'Student Two',
    email: 'student2@attendx.com',
    password: 'Student@123',
    role: 'student' as const,
    department: 'Computer Science',
    year: 2,
    section: 'A',
    rollNumber: 'CS2024002',
  },
];

async function seed() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected');

    for (const userData of seedUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`⏭️  Skipping ${userData.email} (already exists)`);
        continue;
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role,
        department: userData.department,
        year: (userData as any).year,
        section: (userData as any).section,
        rollNumber: (userData as any).rollNumber,
        phone: (userData as any).phone,
        isActive: true,
      });

      console.log(`✅ Created ${userData.role}: ${userData.email}`);
    }

    console.log('\n🎉 Seed complete!\n');
    console.log('Demo credentials:');
    console.log('  Admin:   admin@attendx.com    / Admin@123');
    console.log('  Teacher: teacher1@attendx.com / Teacher@123');
    console.log('  Student: student1@attendx.com / Student@123');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
