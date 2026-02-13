import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { generateToken } from '../utils/helpers.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendVerificationCode } from '../utils/email.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generate6DigitCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// Validation rules
export const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('请输入昵称'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码'),
];

// ====== Register ======
export async function register(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { email, password, name } = req.body;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: '该邮箱已被注册' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 3600000);

    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, name, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [email, passwordHash, name, verificationToken, verificationExpires]
    );

    // Auto-verify if SMTP not configured
    const autoVerify = !process.env.SMTP_HOST;
    if (autoVerify) {
      await pool.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [result.insertId]);
    } else {
      try { await sendVerificationEmail(email, verificationToken); } catch (e) {
        console.error('Email send failed:', e);
        await pool.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [result.insertId]);
      }
    }

    const token = signToken({ id: result.insertId, email, role: 'photographer', name });

    res.status(201).json({
      message: autoVerify ? '注册成功' : '注册成功，请查收验证邮件',
      token,
      user: { id: result.insertId, email, name, role: 'photographer', emailVerified: autoVerify },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
}

// ====== Login ======
export async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ error: '邮箱或密码错误' });

    const user = users[0];
    if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: '邮箱或密码错误' });
    if (!user.email_verified) return res.status(403).json({ error: '请先验证邮箱' });

    res.json({
      message: '登录成功',
      token: signToken(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatar_url, emailVerified: true },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
}

// ====== Verify email ======
export async function verifyEmail(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: '无效的验证链接' });

    const [users] = await pool.query(
      'SELECT id FROM users WHERE verification_token = ? AND verification_expires > NOW()', [token]
    );
    if (users.length === 0) return res.status(400).json({ error: '验证链接已过期或无效' });

    await pool.query('UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?', [users[0].id]);
    res.json({ message: '邮箱验证成功！' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: '验证失败' });
  }
}

// ====== Get profile ======
export async function getProfile(req, res) {
  try {
    const [users] = await pool.query(
      'SELECT id, email, name, role, avatar_url, email_verified, created_at FROM users WHERE id = ?', [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: '用户不存在' });
    const u = users[0];
    res.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role, avatarUrl: u.avatar_url, emailVerified: !!u.email_verified, createdAt: u.created_at } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
}

// ====== Update profile ======
export async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '请输入昵称' });
    await pool.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.id]);
    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '更新失败' });
  }
}

// ====== Send verification code for password change ======
export async function sendChangePasswordCode(req, res) {
  try {
    const userId = req.user.id;
    const [users] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: '用户不存在' });

    const email = users[0].email;
    const code = generate6DigitCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [code, expires, userId]
    );

    const smtpConfigured = !!process.env.SMTP_HOST;
    if (smtpConfigured) {
      await sendVerificationCode(email, code);
    }

    const resp = { message: `验证码已发送到 ${email.replace(/(.{2}).*(@.*)/, '$1***$2')}` };
    if (!smtpConfigured) resp._devCode = code; // Dev fallback
    res.json(resp);
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
}

// ====== Change password with email code ======
export async function changePassword(req, res) {
  try {
    const { code, newPassword } = req.body;
    if (!code || !newPassword) return res.status(400).json({ error: '请填写验证码和新密码' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });

    const [users] = await pool.query(
      'SELECT id, verification_token, verification_expires FROM users WHERE id = ?', [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: '用户不存在' });

    const user = users[0];
    if (user.verification_token !== code) return res.status(400).json({ error: '验证码错误' });
    if (new Date(user.verification_expires) < new Date()) return res.status(400).json({ error: '验证码已过期' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [newHash, req.user.id]
    );

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
}

// ====== Forgot password - send reset link ======
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    // Always return success to avoid leaking user existence
    if (users.length === 0) return res.json({ message: '如果该邮箱已注册，重置链接将发送到您的邮箱' });

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, users[0].id]
    );

    const smtpConfigured = !!process.env.SMTP_HOST;
    if (smtpConfigured) {
      await sendPasswordResetEmail(users[0].email, token);
    }

    const resp = { message: '如果该邮箱已注册，重置链接将发送到您的邮箱' };
    if (!smtpConfigured) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      resp._devResetLink = `${frontendUrl}/reset-password?token=${token}`;
    }
    res.json(resp);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: '操作失败' });
  }
}

// ====== Reset password with token (from email link) ======
export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: '参数缺失' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });

    const [users] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]
    );
    if (users.length === 0) return res.status(400).json({ error: '重置链接已过期或无效' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
      [newHash, users[0].id]
    );

    res.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '重置失败' });
  }
}
