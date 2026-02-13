import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { generateToken } from '../utils/helpers.js';
import { sendVerificationEmail } from '../utils/email.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Validation rules
export const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少6位')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('密码必须包含字母和数字'),
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('请输入昵称'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码'),
];

// Register
export async function register(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password, name } = req.body;

    // Check if email already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create user
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, name, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [email, passwordHash, name, verificationToken, verificationExpires]
    );

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails - auto verify in dev
      if (process.env.NODE_ENV !== 'production') {
        await pool.query(
          'UPDATE users SET email_verified = TRUE WHERE id = ?',
          [result.insertId]
        );
      }
    }

    // In dev mode, auto-verify
    const isVerified = process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST;
    if (isVerified) {
      await pool.query(
        'UPDATE users SET email_verified = TRUE WHERE id = ?',
        [result.insertId]
      );
    }

    const token = signToken({
      id: result.insertId,
      email,
      role: 'photographer',
      name,
    });

    res.status(201).json({
      message: isVerified ? '注册成功' : '注册成功，请查收验证邮件',
      token,
      user: {
        id: result.insertId,
        email,
        name,
        role: 'photographer',
        emailVerified: isVerified,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
}

// Login
export async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // Check email verified
    if (!user.email_verified) {
      return res.status(403).json({ error: '请先验证邮箱' });
    }

    const token = signToken(user);

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        emailVerified: !!user.email_verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
}

// Verify email
export async function verifyEmail(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: '无效的验证链接' });
    }

    const [users] = await pool.query(
      'SELECT id FROM users WHERE verification_token = ? AND verification_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: '验证链接已过期或无效' });
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [users[0].id]
    );

    res.json({ message: '邮箱验证成功！' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: '验证失败' });
  }
}

// Get current user profile
export async function getProfile(req, res) {
  try {
    const [users] = await pool.query(
      'SELECT id, email, name, role, avatar_url, email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        emailVerified: !!user.email_verified,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
}

// Update profile
export async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '请输入昵称' });
    }

    await pool.query('UPDATE users SET name = ? WHERE id = ?', [
      name.trim(),
      req.user.id,
    ]);

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '更新失败' });
  }
}

// Change password
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写完整' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }

    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      newHash,
      req.user.id,
    ]);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
}
