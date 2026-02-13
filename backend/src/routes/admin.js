import { Router } from 'express';
import {
  getDashboardStats,
  getAllUsers,
  getUserAlbums,
  getAllAlbums,
  getAlbumLogs,
  adminViewAlbum,
  adminDownloadPhoto,
} from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/users/:userId/albums', getUserAlbums);
router.get('/albums', getAllAlbums);
router.get('/albums/:albumId/logs', getAlbumLogs);
router.get('/albums/:albumId/detail', adminViewAlbum);
router.get('/albums/:albumId/photos/:photoId/download', adminDownloadPhoto);

export default router;
