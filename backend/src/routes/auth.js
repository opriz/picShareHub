import { Router } from 'express';
import {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  registerValidation,
  loginValidation,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
