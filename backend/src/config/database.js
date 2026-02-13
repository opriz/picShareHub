import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'picshare',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'picshare',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Convert MySQL-style ? placeholders to PostgreSQL $1, $2, $3 style
function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

// MySQL-compatible query wrapper:
// - Converts ? to $1, $2, etc.
// - Returns [rows, fields] like mysql2
// - Handles insertId for INSERT statements
const originalQuery = pool.query.bind(pool);
pool.query = async function (sql, params) {
  const pgSql = convertPlaceholders(sql);
  try {
    const result = await originalQuery(pgSql, params);
    // Simulate mysql2's insertId for INSERT RETURNING
    if (/^\s*INSERT/i.test(sql) && result.rows && result.rows.length > 0 && result.rows[0].id) {
      result.insertId = result.rows[0].id;
    }
    // For UPDATE/DELETE, simulate affectedRows
    if (/^\s*(UPDATE|DELETE)/i.test(sql)) {
      return [{ affectedRows: result.rowCount }, result.fields];
    }
    // For INSERT
    if (/^\s*INSERT/i.test(sql)) {
      return [{ insertId: result.rows?.[0]?.id || 0, affectedRows: result.rowCount }, result.fields];
    }
    return [result.rows || [], result.fields];
  } catch (error) {
    console.error('DB Query Error:', error.message);
    console.error('SQL:', pgSql);
    console.error('Params:', params);
    throw error;
  }
};

export default pool;
