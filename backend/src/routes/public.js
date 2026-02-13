import { Router } from 'express';
import { viewAlbumByShareCode, downloadPhoto } from '../controllers/albumController.js';

const router = Router();

// Public album view (no auth required)
router.get('/s/:shareCode', viewAlbumByShareCode);
router.get('/s/:shareCode/photos/:photoId/download', downloadPhoto);

export default router;
