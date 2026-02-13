import { Router } from 'express';
import { submitFeedback, uploadFeedbackImages } from '../controllers/feedbackController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 提交反馈（登录和未登录用户都可以提交）
// authenticate中间件是可选的，如果用户已登录则获取用户信息
router.post('/feedback', uploadFeedbackImages, submitFeedback);

export default router;
