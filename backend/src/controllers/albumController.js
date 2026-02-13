import pool from '../config/database.js';
import { getOSSClient } from '../config/oss.js';
import { generateShareCode, generateAlbumTitle, getDefaultExpiry } from '../utils/helpers.js';
import QRCode from 'qrcode';

// Create album
export async function createAlbum(req, res) {
  try {
    const { title, description, expiresInHours } = req.body;
    const userId = req.user.id;

    // 检查用户创建的影集数量限制（不包括已过期的影集）
    const now = new Date();
    const albumCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM albums 
       WHERE user_id = $1 
       AND (is_expired = false OR expires_at > $2)`,
      [userId, now]
    );
    const currentAlbumCount = parseInt(albumCountResult.rows[0].count);
    const maxAlbums = 10;
    
    if (currentAlbumCount >= maxAlbums) {
      return res.status(400).json({ error: `每个用户最多只能创建 ${maxAlbums} 个未过期影集` });
    }

    const albumTitle = title || generateAlbumTitle();
    const shareCode = generateShareCode();

    // Calculate expiry
    let expiresAt;
    if (expiresInHours && expiresInHours > 0) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    } else {
      expiresAt = getDefaultExpiry(); // 24 hours
    }

    const result = await pool.query(
      `INSERT INTO albums (user_id, title, share_code, description, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, albumTitle, shareCode, description || null, expiresAt]
    );

    res.status(201).json({
      message: '影集创建成功',
      album: {
        id: result.rows[0].id,
        title: albumTitle,
        shareCode,
        description,
        expiresAt,
        photoCount: 0,
        viewCount: 0,
        downloadCount: 0,
      },
    });
  } catch (error) {
    console.error('Create album error:', error);
    res.status(500).json({ error: '创建影集失败' });
  }
}

// Get user's albums
export async function getMyAlbums(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const albumsResult = await pool.query(
      `SELECT id, title, share_code, description, cover_url, photo_count,
              view_count, download_count, expires_at, is_expired, created_at
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

    // Mark expired albums
    const now = new Date();
    const albumsWithStatus = albumsResult.rows.map((a) => ({
      ...a,
      isExpired: a.is_expired || new Date(a.expires_at) < now,
      shareUrl: `${process.env.FRONTEND_URL || ''}/s/${a.share_code}`,
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
    console.error('Get albums error:', error);
    res.status(500).json({ error: '获取影集列表失败' });
  }
}

// Get single album detail (for owner)
export async function getAlbumDetail(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Validate id parameter
    if (!id || isNaN(parseInt(id))) {
      console.warn(`Invalid album ID: ${id}, userId: ${userId}`);
      return res.status(400).json({ error: '无效的影集ID' });
    }

    if (!userId) {
      console.warn(`Missing userId for album ID: ${id}`);
      return res.status(401).json({ error: '请先登录' });
    }

    // First check if album exists (without user check)
    const albumExistsResult = await pool.query(
      'SELECT id, user_id FROM albums WHERE id = $1',
      [id]
    );

    if (albumExistsResult.rows.length === 0) {
      console.warn(`Album not found: ${id}, userId: ${userId}`);
      return res.status(404).json({ error: '影集不存在' });
    }

    const albumOwnerId = albumExistsResult.rows[0].user_id;
    const isAdmin = req.user?.role === 'admin';

    // Check if user owns the album (or is admin)
    if (albumOwnerId !== userId && !isAdmin) {
      console.warn(`User ${userId} attempted to access album ${id} owned by ${albumOwnerId}`);
      return res.status(403).json({ error: '无权访问此影集' });
    }

    // Get album details with user info
    // If admin, don't filter by user_id
    const albumsResult = await pool.query(
      isAdmin
        ? `SELECT a.*, u.name as photographer_name
           FROM albums a
           JOIN users u ON a.user_id = u.id
           WHERE a.id = $1`
        : `SELECT a.*, u.name as photographer_name
           FROM albums a
           JOIN users u ON a.user_id = u.id
           WHERE a.id = $1 AND a.user_id = $2`,
      isAdmin ? [id] : [id, userId]
    );

    if (albumsResult.rows.length === 0) {
      console.warn(`Album query returned no results: ${id}, userId: ${userId}`);
      return res.status(404).json({ error: '影集不存在' });
    }

    const album = albumsResult.rows[0];

    // Get photos
    const photosResult = await pool.query(
      `SELECT id, original_name, original_url, thumbnail_url, file_size, width, height, download_count, created_at
       FROM photos
       WHERE album_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    res.json({
      album: {
        ...album,
        isExpired: album.is_expired || new Date(album.expires_at) < new Date(),
        shareUrl: `${process.env.FRONTEND_URL || ''}/s/${album.share_code}`,
      },
      photos: photosResult.rows,
    });
  } catch (error) {
    console.error('Get album detail error:', error);
    console.error('Error details:', {
      id: req.params?.id,
      userId: req.user?.id,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).json({ error: '获取影集详情失败' });
  }
}

// Update album (title, description, expiry)
export async function updateAlbum(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, expiresInHours } = req.body;

    // Verify ownership
    const albumsResult = await pool.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (expiresInHours) {
      const newExpiry = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(newExpiry);
      updates.push('is_expired = FALSE');
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的内容' });
    }

    values.push(id);
    await pool.query(
      `UPDATE albums SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({ message: '影集已更新' });
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({ error: '更新影集失败' });
  }
}

// Delete album
export async function deleteAlbum(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get album with photos
    const albumsResult = await pool.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    // Get all photos to delete from OSS
    const photosResult = await pool.query(
      'SELECT oss_key, thumbnail_oss_key FROM photos WHERE album_id = $1',
      [id]
    );

    // Delete from OSS
    try {
      const oss = getOSSClient();
      const keys = photosResult.rows.flatMap((p) => [p.oss_key, p.thumbnail_oss_key]);
      if (keys.length > 0) {
        await oss.deleteMulti(keys);
      }
    } catch (ossErr) {
      console.error('OSS delete error:', ossErr);
      // Continue with DB deletion even if OSS fails
    }

    // Delete from DB (cascade will handle photos and logs)
    await pool.query('DELETE FROM albums WHERE id = $1', [id]);

    res.json({ message: '影集已删除' });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: '删除影集失败' });
  }
}

// Generate QR code for album
export async function getAlbumQRCode(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const albumsResult = await pool.query(
      'SELECT share_code FROM albums WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    const shareUrl = `${process.env.FRONTEND_URL || 'https://www.picshare.com.cn'}/s/${albumsResult.rows[0].share_code}`;

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#333333',
        light: '#ffffff',
      },
    });

    res.json({
      qrCode: qrDataUrl,
      shareUrl,
      shareCode: albumsResult.rows[0].share_code,
    });
  } catch (error) {
    console.error('QR code error:', error);
    res.status(500).json({ error: '生成二维码失败' });
  }
}

// Public: View album by share code
export async function viewAlbumByShareCode(req, res) {
  try {
    const { shareCode } = req.params;

    const albumsResult = await pool.query(
      `SELECT a.*, u.name as photographer_name
       FROM albums a
       JOIN users u ON a.user_id = u.id
       WHERE a.share_code = $1`,
      [shareCode]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在或链接无效' });
    }

    const album = albumsResult.rows[0];

    // Check if expired
    if (album.is_expired || new Date(album.expires_at) < new Date()) {
      return res.status(410).json({ error: '该影集已过期' });
    }

    // Increment view count
    await pool.query(
      'UPDATE albums SET view_count = view_count + 1 WHERE id = $1',
      [album.id]
    );

    // Log access
    await pool.query(
      `INSERT INTO album_access_logs (album_id, ip_address, user_agent, action)
       VALUES ($1, $2, $3, 'view')`,
      [album.id, req.ip, req.headers['user-agent'] || '']
    );

    // Get photos (only thumbnails for initial load)
    const photosResult = await pool.query(
      `SELECT id, original_name, thumbnail_url, file_size, width, height
       FROM photos
       WHERE album_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [album.id]
    );

    res.json({
      album: {
        id: album.id,
        title: album.title,
        description: album.description,
        photographerName: album.photographer_name,
        photoCount: album.photo_count,
        createdAt: album.created_at,
        expiresAt: album.expires_at,
      },
      photos: photosResult.rows,
    });
  } catch (error) {
    console.error('View album error:', error);
    res.status(500).json({ error: '获取影集失败' });
  }
}

// Public: Get original photo URL for download
export async function downloadPhoto(req, res) {
  try {
    const { shareCode, photoId } = req.params;

    // Verify album exists and not expired
    const albumsResult = await pool.query(
      'SELECT id, is_expired, expires_at FROM albums WHERE share_code = $1',
      [shareCode]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    const album = albumsResult.rows[0];
    if (album.is_expired || new Date(album.expires_at) < new Date()) {
      return res.status(410).json({ error: '该影集已过期' });
    }

    // Get photo
    const photosResult = await pool.query(
      'SELECT id, original_url, original_name FROM photos WHERE id = $1 AND album_id = $2',
      [photoId, album.id]
    );

    if (photosResult.rows.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // Increment download count
    await pool.query(
      'UPDATE photos SET download_count = download_count + 1 WHERE id = $1',
      [photoId]
    );
    await pool.query(
      'UPDATE albums SET download_count = download_count + 1 WHERE id = $1',
      [album.id]
    );

    // Log download
    await pool.query(
      `INSERT INTO album_access_logs (album_id, ip_address, user_agent, action, photo_id)
       VALUES ($1, $2, $3, 'download', $4)`,
      [album.id, req.ip, req.headers['user-agent'] || '', photoId]
    );

    res.json({
      downloadUrl: photosResult.rows[0].original_url,
      fileName: photosResult.rows[0].original_name,
    });
  } catch (error) {
    console.error('Download photo error:', error);
    res.status(500).json({ error: '获取下载链接失败' });
  }
}
