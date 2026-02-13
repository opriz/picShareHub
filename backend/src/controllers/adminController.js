import pool from '../config/database.js';

// Get dashboard stats
export async function getDashboardStats(req, res) {
  try {
    const userCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'photographer'"
    );
    const albumCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM albums'
    );
    const activeAlbumCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM albums WHERE is_expired = FALSE AND expires_at > NOW()"
    );
    const photoCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM photos'
    );
    const totalViewsResult = await pool.query(
      'SELECT COALESCE(SUM(view_count), 0) as total FROM albums'
    );
    const totalDownloadsResult = await pool.query(
      'SELECT COALESCE(SUM(download_count), 0) as total FROM albums'
    );

    // Recent activity (last 7 days)
    const recentAlbumsResult = await pool.query(
      "SELECT COUNT(*) as count FROM albums WHERE created_at > NOW() - INTERVAL '7 days'"
    );
    const recentUsersResult = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
    );

    res.json({
      stats: {
        totalUsers: parseInt(userCountResult.rows[0].count),
        totalAlbums: parseInt(albumCountResult.rows[0].count),
        activeAlbums: parseInt(activeAlbumCountResult.rows[0].count),
        totalPhotos: parseInt(photoCountResult.rows[0].count),
        totalViews: parseInt(totalViewsResult.rows[0].total),
        totalDownloads: parseInt(totalDownloadsResult.rows[0].total),
        recentAlbums: parseInt(recentAlbumsResult.rows[0].count),
        recentUsers: parseInt(recentUsersResult.rows[0].count),
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

    const usersResult = await pool.query(
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
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'photographer'"
    );

    res.json({
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
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

    const albumsResult = await pool.query(
      `SELECT id, title, share_code, photo_count, view_count, download_count,
              expires_at, is_expired, created_at
       FROM albums
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM albums WHERE user_id = $1',
      [userId]
    );

    const now = new Date();
    const albumsWithStatus = albumsResult.rows.map((a) => ({
      ...a,
      isExpired: a.is_expired || new Date(a.expires_at) < now,
    }));

    res.json({
      albums: albumsWithStatus,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
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
      whereClause = "WHERE a.is_expired = FALSE AND a.expires_at > NOW()";
    } else if (status === 'expired') {
      whereClause = "WHERE a.is_expired = TRUE OR a.expires_at <= NOW()";
    }

    const albumsResult = await pool.query(
      `SELECT a.id, a.title, a.share_code, a.photo_count, a.view_count, a.download_count,
              a.expires_at, a.is_expired, a.created_at, u.name as photographer_name, u.email as photographer_email
       FROM albums a
       JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM albums a ${whereClause}`
    );

    const now = new Date();
    const albumsWithStatus = albumsResult.rows.map((a) => ({
      ...a,
      isExpired: a.is_expired || new Date(a.expires_at) < now,
    }));

    res.json({
      albums: albumsWithStatus,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
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

    const logsResult = await pool.query(
      `SELECT action, ip_address, created_at
       FROM album_access_logs
       WHERE album_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [albumId]
    );

    res.json({ logs: logsResult.rows });
  } catch (error) {
    console.error('Get album logs error:', error);
    res.status(500).json({ error: '获取访问日志失败' });
  }
}
