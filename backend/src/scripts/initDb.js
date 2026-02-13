import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const SQL_STATEMENTS = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'photographer' CHECK (role IN ('photographer', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) DEFAULT NULL,
    verification_expires TIMESTAMP DEFAULT NULL,
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_expires TIMESTAMP DEFAULT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Albums table
  `CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    share_code VARCHAR(32) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    cover_url VARCHAR(500) DEFAULT NULL,
    photo_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    is_expired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // Photos table
  `CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    album_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    oss_key VARCHAR(500) NOT NULL,
    thumbnail_oss_key VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    download_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // Album access logs
  `CREATE TABLE IF NOT EXISTS album_access_logs (
    id SERIAL PRIMARY KEY,
    album_id INTEGER NOT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    action VARCHAR(20) DEFAULT 'view' CHECK (action IN ('view', 'download')),
    photo_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
  )`,

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_share_code ON albums(share_code)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_expires_at ON albums(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_is_expired ON albums(is_expired)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_album_access_logs_album_id ON album_access_logs(album_id)`,
  `CREATE INDEX IF NOT EXISTS idx_album_access_logs_action ON album_access_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_album_access_logs_created_at ON album_access_logs(created_at)`,

  // Create function to update updated_at timestamp
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql'`,

  // Create triggers for updated_at
  `DROP TRIGGER IF EXISTS update_users_updated_at ON users;
   CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

  `DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
   CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
];

async function initDatabase() {
  console.log('🔧 Initializing PostgreSQL database...');

  const dbName = process.env.DB_NAME || 'picshare';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  // First connect to postgres database to create the target database if needed
  const adminPool = new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    // Check if database exists
    const dbCheck = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`✅ Database "${dbName}" already exists`);
    }
  } catch (error) {
    console.error('❌ Failed to create database:', error.message);
    throw error;
  } finally {
    await adminPool.end();
  }

  // Now connect to the target database
  const pool = new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    for (const sql of SQL_STATEMENTS) {
      await pool.query(sql);
    }

    console.log('✅ All tables and indexes created successfully');
    console.log('');
    console.log('Tables:');
    console.log('  - users (photographers & admins)');
    console.log('  - albums (photo collections)');
    console.log('  - photos (individual photos)');
    console.log('  - album_access_logs (view & download tracking)');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase()
  .then(() => {
    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
