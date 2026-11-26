import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { cloudinary, isCloudinaryConfigured } from '../utils/cloudinary';

const router = Router();
router.use(authenticate);

// ── Storage strategy ──────────────────────────────────────────────────────────
// Always buffer in memory first so magic bytes can be verified before persisting.
const localDir = path.resolve(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

const detectImageExtension = (buffer: Buffer): '.jpg' | '.png' | '.webp' | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return '.png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
};

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPG, PNG and WebP images are allowed'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter,
});

// ── POST /api/upload/avatar ───────────────────────────────────────────────────
router.post('/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const detectedExt = detectImageExtension(req.file.buffer);
    if (!detectedExt) {
      res.status(400).json({ success: false, message: 'Invalid image file signature. Only JPG, PNG and WebP images are allowed' });
      return;
    }

    let avatarUrl: string;

    if (isCloudinaryConfigured()) {
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'attendx/avatars',
            public_id: `avatar-${req.user!.userId}`,
            overwrite: true,
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
      const user = await User.findById(req.user!.userId);
      if (user?.avatar && user.avatar.startsWith('/uploads/avatars/')) {
        const oldPath = path.resolve(process.cwd(), user.avatar.replace(/^\/+/, ''));
        if (oldPath.startsWith(localDir + path.sep) && fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      const filename = `avatar-${req.user!.userId}-${Date.now()}${detectedExt}`;
      fs.writeFileSync(path.join(localDir, filename), req.file.buffer);
      avatarUrl = `/uploads/avatars/${filename}`;
    }

    await User.findByIdAndUpdate(req.user!.userId, { avatar: avatarUrl });

    res.json({ success: true, data: { avatarUrl } });
  } catch (error: any) {
    const message = process.env.NODE_ENV === 'production' ? 'Avatar upload failed' : error.message;
    res.status(500).json({ success: false, message });
  }
});

export default router;
