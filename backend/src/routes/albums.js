import { Router } from 'express';
import {
  createAlbum,
  getMyAlbums,
  getAlbumDetail,
  updateAlbum,
  deleteAlbum,
  getAlbumQRCode,
} from '../controllers/albumController.js';
import { uploadPhotos, deletePhoto, getPhotoOriginal } from '../controllers/photoController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadPhotos as uploadMiddleware } from '../middleware/upload.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Album CRUD
router.post('/', createAlbum);
router.get('/', getMyAlbums);
router.get('/:id', getAlbumDetail);
router.put('/:id', updateAlbum);
router.delete('/:id', deleteAlbum);

// QR code
router.get('/:id/qrcode', getAlbumQRCode);

// Photo management
router.post('/:albumId/photos', uploadMiddleware, uploadPhotos);
router.delete('/:albumId/photos/:photoId', deletePhoto);
router.get('/:albumId/photos/:photoId/original', getPhotoOriginal);

export default router;
