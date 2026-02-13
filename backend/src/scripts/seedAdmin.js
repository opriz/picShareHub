import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@picshare.com.cn';
  const password = process.env.ADMIN_PASSWORD || 'Admin2026Secure';
  const name = 'System Admin';

  console.log('🔧 Creating admin account...');

  try {
    // Check if admin already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log(`⚠️  Admin account already exists: ${email}`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      'INSERT INTO users (email, password_hash, name, role, email_verified) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [email, passwordHash, name, 'admin', true]
    );

    console.log(`✅ Admin account created successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   ⚠️  Please change the password after first login!`);
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

seedAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
