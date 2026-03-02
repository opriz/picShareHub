#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function testLogin() {
  try {
    console.log('=== Testing Login Process ===\n');

    const email = 'admin@picshare.com.cn';
    const password = 'Admin123456!';

    console.log('1. Querying database...');
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }

    console.log('✅ User found');
    const user = userResult.rows[0];
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Email Verified:', user.email_verified);

    console.log('\n2. Checking password...');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log(isMatch ? '✅ Password matches' : '❌ Password does not match');

    if (!isMatch) {
      await pool.end();
      return;
    }

    console.log('\n3. Generating JWT token...');
    console.log('   JWT_SECRET:', JWT_SECRET ? 'Set' : 'Not set');

    try {
      const token = signToken(user);
      console.log('✅ Token generated successfully');
      console.log('   Token length:', token.length);
      console.log('   Token preview:', token.substring(0, 50) + '...');
    } catch (jwtError) {
      console.log('❌ JWT Error:', jwtError.message);
      await pool.end();
      return;
    }

    console.log('\n4. Preparing response...');
    const emailVerified = !!user.email_verified;
    const response = {
      message: emailVerified ? '登录成功' : '登录成功！请尽快验证您的邮箱以使用全部功能。',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        emailVerified: emailVerified,
      },
      requiresVerification: !emailVerified,
    };

    console.log('✅ Response prepared');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n✅ Login test completed successfully!');

    await pool.end();
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testLogin();
