import multer from 'multer';
import { sendFeedbackEmail } from '../utils/email.js';

// 配置multer用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // 最多5个文件
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  },
});

// 中间件：处理多文件上传
export const uploadFeedbackImages = upload.array('images', 5);

// 提交反馈
export async function submitFeedback(req, res) {
  try {
    const { content, contact } = req.body;
    const images = req.files || [];

    // 验证内容
    if (!content || typeof content !== 'string' || content.trim().length < 5) {
      return res.status(400).json({ error: '反馈内容至少需要5个字符' });
    }

    if (content.trim().length > 500) {
      return res.status(400).json({ error: '反馈内容不能超过500个字符' });
    }

    // 验证联系方式（如果提供）
    if (contact && contact.trim().length > 100) {
      return res.status(400).json({ error: '联系方式不能超过100个字符' });
    }

    // 获取用户信息（如果已登录）
    const userInfo = req.user ? {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    } : null;

    // 发送邮件
    try {
      await sendFeedbackEmail(content.trim(), images, userInfo, contact?.trim() || null);
      res.json({ message: '反馈已提交，感谢您的建议！' });
    } catch (emailError) {
      console.error('发送反馈邮件失败:', emailError);
      // 即使邮件发送失败，也返回成功（避免用户重复提交）
      res.json({ message: '反馈已提交，感谢您的建议！' });
    }
  } catch (error) {
    console.error('提交反馈错误:', error);
    res.status(500).json({ error: '提交失败，请稍后重试' });
  }
}
