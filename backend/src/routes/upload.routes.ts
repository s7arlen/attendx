import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary';

const router = Router();
router.use(authenticate);

// ── Storage strategy ──────────────────────────────────────────────────────────
// If Cloudinary env vars are set → upload to Cloudinary (production)
// Otherwise → save to local disk under uploads/avatars/ (development)

const localDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

const localStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, localDir),
  filename: (req: any, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user!.userId}-${Date.now()}${ext}`);
  },
});

// Memory storage is used when uploading to Cloudinary (no disk write)
const memoryStorage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only JPG, PNG and WebP images are allowed'));
};

const upload = multer({
  storage: isCloudinaryConfigured() ? memoryStorage : localStorage,
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter,
});

// ── POST /api/upload/avatar ───────────────────────────────────────────────────
router.post('/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    let avatarUrl: string;

    if (isCloudinaryConfigured()) {
      // ── Cloudinary upload ──────────────────────────────────────────────────
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder:         'attendx/avatars',
            public_id:      `avatar-${req.user!.userId}`,
            overwrite:      true,                 // replace previous avatar
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (err, result) => {
            if (err || !result) reject(err ?? new Error('Cloudinary upload failed'));
            else resolve(result);
          }
        );
        stream.end(req.file!.buffer);
      });
      avatarUrl = result.secure_url;
    } else {
      // ── Local disk (dev) ───────────────────────────────────────────────────
      // Delete old local avatar if it was a previous upload
      const user = await User.findById(req.user!.userId);
      if (user?.avatar && user.avatar.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }

    await User.findByIdAndUpdate(req.user!.userId, { avatar: avatarUrl });

    res.json({ success: true, data: { avatarUrl } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
