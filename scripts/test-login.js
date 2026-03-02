#!/usr/bin/env node
import bcrypt from 'bcryptjs';
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

async function testLogin() {
  try {
    console.log('Testing login for admin@picshare.com.cn...');

    // Get user from database
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['admin@picshare.com.cn']
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = result.rows[0];
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      email_verified: user.email_verified
    });

    // Test password
    const password = 'Admin123456!';
    const isMatch = await bcrypt.compare(password, user.password_hash);

    console.log('Password match:', isMatch ? '✅ YES' : '❌ NO');

    if (!isMatch) {
      console.log('Stored hash:', user.password_hash);
      console.log('Testing password:', password);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLogin();
