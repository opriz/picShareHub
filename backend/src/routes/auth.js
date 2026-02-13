import { Router } from 'express';
import {
  register,
  login,
  verifyEmail,
  getProfile,
  updateProfile,
  changePassword,
  registerValidation,
  loginValidation,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/verify-email', verifyEmail);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
