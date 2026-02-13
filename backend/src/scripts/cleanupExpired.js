import pool from '../config/database.js';
import { getOSSClient } from '../config/oss.js';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupExpiredAlbums() {
  console.log(`[${new Date().toISOString()}] Starting expired albums cleanup...`);

  try {
    // Find expired albums
    const [expiredAlbums] = await pool.execute(
      `SELECT id FROM albums
       WHERE (is_expired = 0 AND expires_at <= NOW())
       OR (is_expired = 1 AND expires_at <= DATE_SUB(NOW(), INTERVAL 1 DAY))` // Give 1 extra day before deleting data
    );

    if (expiredAlbums.length === 0) {
      console.log('No expired albums found.');
      return;
    }

    console.log(`Found ${expiredAlbums.length} expired album(s)`);

    // First, mark newly expired albums
    await pool.execute(
      'UPDATE albums SET is_expired = 1 WHERE is_expired = 0 AND expires_at <= NOW()'
    );

    // Delete albums that have been expired for over 1 day (including their OSS files)
    const [toDelete] = await pool.execute(
      `SELECT a.id, p.oss_key, p.thumbnail_oss_key
       FROM albums a
       LEFT JOIN photos p ON p.album_id = a.id
       WHERE a.is_expired = 1 AND a.expires_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)`
    );

    if (toDelete.length > 0) {
      // Collect OSS keys
      const ossKeys = toDelete
        .filter((r) => r.oss_key)
        .flatMap((r) => [r.oss_key, r.thumbnail_oss_key]);

      // Delete from OSS in batches
      if (ossKeys.length > 0) {
        try {
          const oss = getOSSClient();
          // OSS deleteMulti supports max 1000 keys per call
          for (let i = 0; i < ossKeys.length; i += 1000) {
            const batch = ossKeys.slice(i, i + 1000);
            await oss.deleteMulti(batch);
          }
          console.log(`Deleted ${ossKeys.length} files from OSS`);
        } catch (ossErr) {
          console.error('OSS cleanup error:', ossErr.message);
        }
      }

      // Get unique album IDs to delete
      const albumIds = [...new Set(toDelete.map((r) => r.id))];
      for (const albumId of albumIds) {
        await pool.execute('DELETE FROM albums WHERE id = ?', [albumId]);
      }
      console.log(`Deleted ${albumIds.length} expired album(s) from database`);
    }

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run if called directly
cleanupExpiredAlbums()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });

export default cleanupExpiredAlbums;
