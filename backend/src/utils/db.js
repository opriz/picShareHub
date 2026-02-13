/**
 * Database query helper for PostgreSQL
 * Provides MySQL-like API for easier migration
 */
import pool from '../config/database.js';

/**
 * Convert MySQL-style query with ? placeholders to PostgreSQL $1, $2, etc.
 */
function convertQuery(sql, params) {
  if (!params || params.length === 0) {
    return { text: sql, values: [] };
  }

  let paramIndex = 1;
  const text = sql.replace(/\?/g, () => `$${paramIndex++}`);
  return { text, values: params };
}

/**
 * Query wrapper that returns MySQL-like result format
 */
export async function query(sql, params) {
  const { text, values } = convertQuery(sql, params);
  const result = await pool.query(text, values);
  
  // Return MySQL-like format: [rows, fields]
  // For compatibility, we return rows as the first element
  return [result.rows];
}

/**
 * Get the first row from query result
 */
export function getFirstRow(queryResult) {
  const [rows] = queryResult;
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Get all rows from query result
 */
export function getRows(queryResult) {
  const [rows] = queryResult;
  return rows || [];
}

/**
 * Check if query returned any rows
 */
export function hasRows(queryResult) {
  const [rows] = queryResult;
  return rows && rows.length > 0;
}

/**
 * Get insert ID from INSERT query result
 * For PostgreSQL, use RETURNING clause
 */
export function getInsertId(result, tableName = 'id') {
  if (result.rows && result.rows.length > 0) {
    return result.rows[0][tableName] || result.rows[0].id;
  }
  return null;
}

export default pool;
