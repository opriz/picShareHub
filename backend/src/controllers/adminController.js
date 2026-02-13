import pool from '../config/database.js';

// Get dashboard stats
export async function getDashboardStats(req, res) {
  try {
    const [userCount] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'photographer'"
    );
    const [albumCount] = await pool.query(
      'SELECT COUNT(*) as count FROM albums'
    );
    const [activeAlbumCount] = await pool.query(
      'SELECT COUNT(*) as count FROM albums WHERE is_expired = FALSE AND expires_at > NOW()'
    );
    const [photoCount] = await pool.query(
      'SELECT COUNT(*) as count FROM photos'
    );
    const [totalViews] = await pool.query(
      'SELECT COALESCE(SUM(view_count), 0) as total FROM albums'
    );
    const [totalDownloads] = await pool.query(
      'SELECT COALESCE(SUM(download_count), 0) as total FROM albums'
    );

    // Recent activity (last 7 days)
    const [recentAlbums] = await pool.query(
      "SELECT COUNT(*) as count FROM albums WHERE created_at > NOW() - INTERVAL '7 days'"
    );
    const [recentUsers] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
    );

    res.json({
      stats: {
        totalUsers: userCount[0].count,
        totalAlbums: albumCount[0].count,
        activeAlbums: activeAlbumCount[0].count,
        totalPhotos: photoCount[0].count,
        totalViews: totalViews[0].total,
        totalDownloads: totalDownloads[0].total,
        recentAlbums: recentAlbums[0].count,
        recentUsers: recentUsers[0].count,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
}

// Get all users
export async function getAllUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [users] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.email_verified, u.created_at,
              COUNT(DISTINCT a.id) as album_count,
              COALESCE(SUM(a.photo_count), 0) as total_photos,
              COALESCE(SUM(a.view_count), 0) as total_views,
              COALESCE(SUM(a.download_count), 0) as total_downloads
       FROM users u
       LEFT JOIN albums a ON u.id = a.user_id
       WHERE u.role = 'photographer'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'photographer'"
    );

    res.json({
      users,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
}

// Get user's albums (admin view)
export async function getUserAlbums(req, res) {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [albums] = await pool.query(
      `SELECT id, title, share_code, photo_count, view_count, download_count,
              expires_at, is_expired, created_at
       FROM albums
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM albums WHERE user_id = ?',
      [userId]
    );

    const now = new Date();
    const albumsWithStatus = albums.map((a) => ({
      ...a,
      isExpired: a.is_expired || new Date(a.expires_at) < now,
    }));

    res.json({
      albums: albumsWithStatus,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get user albums error:', error);
    res.status(500).json({ error: '获取影集列表失败' });
  }
}

// Get all albums (admin)
export async function getAllAlbums(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status; // 'active', 'expired', or 'all'

    let whereClause = '';
    if (status === 'active') {
      whereClause = 'WHERE a.is_expired = FALSE AND a.expires_at > NOW()';
    } else if (status === 'expired') {
      whereClause = 'WHERE a.is_expired = TRUE OR a.expires_at <= NOW()';
    }

    const [albums] = await pool.query(
      `SELECT a.id, a.title, a.share_code, a.photo_count, a.view_count, a.download_count,
              a.expires_at, a.is_expired, a.created_at, u.name as photographer_name, u.email as photographer_email
       FROM albums a
       JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM albums a ${whereClause}`
    );

    const now = new Date();
    const albumsWithStatus = albums.map((a) => ({
      ...a,
      isExpired: a.is_expired || new Date(a.expires_at) < now,
    }));

    res.json({
      albums: albumsWithStatus,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get all albums error:', error);
    res.status(500).json({ error: '获取影集列表失败' });
  }
}

// Get access logs for an album
export async function getAlbumLogs(req, res) {
  try {
    const { albumId } = req.params;

    const [logs] = await pool.query(
      `SELECT action, ip_address, created_at
       FROM album_access_logs
       WHERE album_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [albumId]
    );

    res.json({ logs });
  } catch (error) {
    console.error('Get album logs error:', error);
    res.status(500).json({ error: '获取访问日志失败' });
  }
}

// Admin: View any album detail (no stats increment)
export async function adminViewAlbum(req, res) {
  try {
    const { albumId } = req.params;

    const [albums] = await pool.query(
      `SELECT a.*, u.name as photographer_name, u.email as photographer_email
       FROM albums a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [albumId]
    );

    if (albums.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    const album = albums[0];

    const [photos] = await pool.query(
      `SELECT id, original_name, original_url, thumbnail_url, file_size, width, height, download_count, created_at
       FROM photos
       WHERE album_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
      [albumId]
    );

    res.json({
      album: {
        ...album,
        isExpired: album.is_expired || new Date(album.expires_at) < new Date(),
        shareUrl: `${process.env.FRONTEND_URL || ''}/s/${album.share_code}`,
      },
      photos,
    });
  } catch (error) {
    console.error('Admin view album error:', error);
    res.status(500).json({ error: '获取影集详情失败' });
  }
}

// Admin: Download photo without incrementing stats
export async function adminDownloadPhoto(req, res) {
  try {
    const { albumId, photoId } = req.params;

    const [photos] = await pool.query(
      'SELECT original_url, original_name FROM photos WHERE id = ? AND album_id = ?',
      [photoId, albumId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    res.json({
      downloadUrl: photos[0].original_url,
      fileName: photos[0].original_name,
    });
  } catch (error) {
    console.error('Admin download photo error:', error);
    res.status(500).json({ error: '获取下载链接失败' });
  }
}
