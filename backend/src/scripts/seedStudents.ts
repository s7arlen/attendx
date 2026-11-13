import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendx';

const students = [
  { rollNumber: '4CB25CS069', name: 'Lakshmana Marati',            email: 'lakshmana.marati@attendx.com'  },
  { rollNumber: '4CB25CS070', name: 'Lalita Bhadrayya Devadig',    email: 'lalita.devadig@attendx.com'    },
  { rollNumber: '4CB25CS071', name: 'Lenstar Monteiro',            email: 'lenstar.monteiro@attendx.com'  },
  { rollNumber: '4CB25CS072', name: 'Lohit Gopal Naik',            email: 'lohit.naik@attendx.com'        },
  { rollNumber: '4CB25CS073', name: 'M K Nishitha',                email: 'mk.nishitha@attendx.com'       },
  { rollNumber: '4CB25CS074', name: 'M Manjunath',                 email: 'm.manjunath@attendx.com'       },
  { rollNumber: '4CB25CS075', name: 'Mahadesh',                    email: 'mahadesh@attendx.com'          },
  { rollNumber: '4CB25CS076', name: 'Mahammad Hasim M',            email: 'mahammad.hasim@attendx.com'    },
  { rollNumber: '4CB25CS077', name: 'Malini',                      email: 'malini@attendx.com'            },
  { rollNumber: '4CB25CS078', name: 'Manasi Rajesh Naik',          email: 'manasi.naik@attendx.com'       },
  { rollNumber: '4CB25CS079', name: 'Mandla Narasimha Charan Tej', email: 'mandla.tej@attendx.com'        },
];

async function seedStudents() {
  try {
    console.log('[seed] Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('[seed] Connected\n');

    const passwordHash = await bcrypt.hash('Student@123', 12);

    for (const s of students) {
      const existing = await User.findOne({ $or: [{ email: s.email }, { rollNumber: s.rollNumber }] });
      if (existing) {
        console.log(`[skip] Already exists: ${s.rollNumber} - ${s.name}`);
        continue;
      }
      await User.create({
        name: s.name,
        email: s.email,
        passwordHash,
        role: 'student',
        department: 'Computer Science',
        year: 3,
        section: 'A',
        rollNumber: s.rollNumber,
        isActive: true,
      });
      console.log(`[created] ${s.rollNumber} - ${s.name} (${s.email})`);
    }

    console.log('\n[seed] Done!');
    console.log('All students password: Student@123');
  } catch (err) {
    console.error('[seed] Failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedStudents();
