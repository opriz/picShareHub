import multer from 'multer';
import path from 'path';

// Configure multer for memory storage (we'll upload to OSS)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式，请上传 JPG、PNG、GIF 或 WebP 图片'), false);
  }
};

export const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20, // 一次最多上传20张
  },
}).array('photos', 20);

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
}).single('avatar');
