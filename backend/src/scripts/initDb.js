import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

  // Albums table
  `CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    share_code VARCHAR(32) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    cover_url VARCHAR(500) DEFAULT NULL,
    photo_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    is_expired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_share_code ON albums(share_code)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_expires_at ON albums(expires_at)`,

  // Photos table
  `CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    album_id INT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    oss_key VARCHAR(500) NOT NULL,
    thumbnail_oss_key VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    width INT DEFAULT 0,
    height INT DEFAULT 0,
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    download_count INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id)`,

  // Album access logs
  `CREATE TABLE IF NOT EXISTS album_access_logs (
    id SERIAL PRIMARY KEY,
    album_id INT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    action VARCHAR(20) DEFAULT 'view' CHECK (action IN ('view', 'download')),
    photo_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_logs_album_id ON album_access_logs(album_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_action ON album_access_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_created_at ON album_access_logs(created_at)`,
];

async function initDatabase() {
  console.log('🔧 Initializing PostgreSQL database...');

  const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'picshare',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'picshare',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    for (const sql of SQL_STATEMENTS) {
      await client.query(sql);
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
    await client.end();
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
