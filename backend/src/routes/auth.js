import { Router } from 'express';
import {
  register, login, verifyEmail, getProfile, updateProfile,
  sendChangePasswordCode, changePassword, forgotPassword, resetPassword,
  registerValidation, loginValidation,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Authenticated
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/send-code', authenticate, sendChangePasswordCode);
router.post('/change-password', authenticate, changePassword);

export default router;
