import pool from '../config/database.js';
import { getOSSClient } from '../config/oss.js';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupExpiredAlbums() {
  console.log(`[${new Date().toISOString()}] Starting expired albums cleanup...`);

  try {
    // Step 1: Mark albums as expired (but don't delete yet)
    const [marked] = await pool.query(
      'UPDATE albums SET is_expired = TRUE WHERE is_expired = FALSE AND expires_at <= NOW()'
    );
    if (marked.affectedRows > 0) {
      console.log(`Marked ${marked.affectedRows} album(s) as expired`);
    }

    // Step 2: Only delete albums expired for over 7 days (generous grace period)
    const [toDelete] = await pool.query(
      `SELECT a.id, p.oss_key, p.thumbnail_oss_key
       FROM albums a
       LEFT JOIN photos p ON p.album_id = a.id
       WHERE a.is_expired = TRUE AND a.expires_at <= NOW() - INTERVAL '7 days'`
    );

    if (toDelete.length === 0) {
      console.log('No albums to clean up.');
      return;
    }

    console.log(`Found ${toDelete.length} row(s) to clean (expired > 7 days)`);

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
        await pool.query('DELETE FROM albums WHERE id = ?', [albumId]);
      }
      console.log(`Deleted ${albumIds.length} expired album(s) from database`);
    }

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run if called directly (not imported)
const isMainModule = process.argv[1] && process.argv[1].endsWith('cleanupExpired.js');
if (isMainModule) {
  cleanupExpiredAlbums()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}

export default cleanupExpiredAlbums;
