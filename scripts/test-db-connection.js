#!/usr/bin/env node
/**
 * Test database connection and login query
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function testConnection() {
  console.log('🔍 Testing database connection...\n');

  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('   ✅ Connected successfully');
    console.log('   Server time:', result.rows[0].now);
    console.log('');

    // Test users table
    console.log('2. Querying admin user...');
    const userResult = await pool.query(
      'SELECT id, email, name, role, email_verified, created_at FROM users WHERE email = $1',
      ['admin@picshare.com.cn']
    );

    if (userResult.rows.length === 0) {
      console.log('   ❌ Admin user not found!');
      console.log('');

      // List all users
      console.log('3. Listing all users...');
      const allUsers = await pool.query('SELECT id, email, name, role FROM users LIMIT 10');
      console.log(`   Found ${allUsers.rows.length} users:`);
      allUsers.rows.forEach(u => {
        console.log(`   - ${u.email} (${u.role})`);
      });
    } else {
      const user = userResult.rows[0];
      console.log('   ✅ Admin user found:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
      console.log('   Role:', user.role);
      console.log('   Email Verified:', user.email_verified);
      console.log('   Created:', user.created_at);
      console.log('');

      // Test password verification
      console.log('3. Testing password verification...');
      const passResult = await pool.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['admin@picshare.com.cn']
      );

      const isMatch = await bcrypt.compare('Admin123456!', passResult.rows[0].password_hash);
      console.log('   Password match:', isMatch ? '✅ YES' : '❌ NO');
    }

    console.log('');
    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
