import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { getOSSClient, getOSSBaseUrl } from '../config/oss.js';

const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_QUALITY = 75;

// Upload photos to an album
export async function uploadPhotos(req, res) {
  try {
    const { albumId } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择照片上传' });
    }

    // Verify album ownership
    const albumsResult = await pool.query(
      'SELECT id, is_expired, expires_at FROM albums WHERE id = $1 AND user_id = $2',
      [albumId, userId]
    );

    if (albumsResult.rows.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    if (albumsResult.rows[0].is_expired || new Date(albumsResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: '影集已过期，无法上传' });
    }

    // 检查当前影集照片数量
    const photoCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM photos WHERE album_id = $1',
      [albumId]
    );
    const currentPhotoCount = parseInt(photoCountResult.rows[0].count);
    const maxPhotos = 50;
    
    if (currentPhotoCount >= maxPhotos) {
      return res.status(400).json({ error: `影集最多只能包含 ${maxPhotos} 张照片` });
    }

    // 检查本次上传是否会超过限制
    if (currentPhotoCount + req.files.length > maxPhotos) {
      const remaining = maxPhotos - currentPhotoCount;
      return res.status(400).json({ error: `影集最多只能包含 ${maxPhotos} 张照片，当前已有 ${currentPhotoCount} 张，最多还能上传 ${remaining} 张` });
    }

    const oss = getOSSClient();
    const baseUrl = getOSSBaseUrl();
    const uploadedPhotos = [];

    for (const file of req.files) {
      try {
        const fileId = uuidv4();
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
        const ossDir = `photos/${userId}/${albumId}`;

        // Get image metadata
        const metadata = await sharp(file.buffer).metadata();

        // Generate thumbnail
        const thumbnailBuffer = await sharp(file.buffer)
          .resize(THUMBNAIL_WIDTH, null, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: THUMBNAIL_QUALITY })
          .toBuffer();

        // Upload original to OSS
        const originalKey = `${ossDir}/${fileId}.${ext}`;
        await oss.put(originalKey, file.buffer, {
          mime: file.mimetype,
          headers: {
            'Cache-Control': 'max-age=31536000',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalname)}"`,
          },
        });

        // Upload thumbnail to OSS
        const thumbnailKey = `${ossDir}/thumb_${fileId}.jpg`;
        await oss.put(thumbnailKey, thumbnailBuffer, {
          mime: 'image/jpeg',
          headers: {
            'Cache-Control': 'max-age=31536000',
          },
        });

        const originalUrl = `${baseUrl}/${originalKey}`;
        const thumbnailUrl = `${baseUrl}/${thumbnailKey}`;

        // Save to DB with RETURNING clause
        const result = await pool.query(
          `INSERT INTO photos (album_id, user_id, original_name, original_url, thumbnail_url,
            oss_key, thumbnail_oss_key, file_size, width, height, mime_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            albumId,
            userId,
            file.originalname,
            originalUrl,
            thumbnailUrl,
            originalKey,
            thumbnailKey,
            file.size,
            metadata.width || 0,
            metadata.height || 0,
            file.mimetype,
          ]
        );

        uploadedPhotos.push({
          id: result.rows[0].id,
          originalName: file.originalname,
          thumbnailUrl,
          originalUrl,
          fileSize: file.size,
          width: metadata.width || 0,
          height: metadata.height || 0,
        });
      } catch (fileError) {
        console.error(`Failed to upload ${file.originalname}:`, fileError);
        // Continue with other files
      }
    }

    // Update album photo count and cover
    if (uploadedPhotos.length > 0) {
      await pool.query(
        `UPDATE albums SET
          photo_count = (SELECT COUNT(*) FROM photos WHERE album_id = $1),
          cover_url = COALESCE(cover_url, $2)
        WHERE id = $3`,
        [albumId, uploadedPhotos[0].thumbnailUrl, albumId]
      );
    }

    res.status(201).json({
      message: `成功上传 ${uploadedPhotos.length} 张照片`,
      photos: uploadedPhotos,
      failed: req.files.length - uploadedPhotos.length,
    });
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ error: '上传失败，请稍后重试' });
  }
}

// Delete a photo
export async function deletePhoto(req, res) {
  try {
    const { albumId, photoId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const photosResult = await pool.query(
      `SELECT p.oss_key, p.thumbnail_oss_key
       FROM photos p
       JOIN albums a ON p.album_id = a.id
       WHERE p.id = $1 AND p.album_id = $2 AND a.user_id = $3`,
      [photoId, albumId, userId]
    );

    if (photosResult.rows.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // Delete from OSS
    try {
      const oss = getOSSClient();
      await oss.deleteMulti([photosResult.rows[0].oss_key, photosResult.rows[0].thumbnail_oss_key]);
    } catch (ossErr) {
      console.error('OSS delete error:', ossErr);
    }

    // Delete from DB
    await pool.query('DELETE FROM photos WHERE id = $1', [photoId]);

    // Update album count
    await pool.query(
      `UPDATE albums SET photo_count = (SELECT COUNT(*) FROM photos WHERE album_id = $1) WHERE id = $2`,
      [albumId, albumId]
    );

    res.json({ message: '照片已删除' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: '删除照片失败' });
  }
}

// Get photo original URL (authenticated, for photographer's own download)
export async function getPhotoOriginal(req, res) {
  try {
    const { albumId, photoId } = req.params;
    const userId = req.user.id;

    const photosResult = await pool.query(
      `SELECT p.original_url, p.original_name
       FROM photos p
       JOIN albums a ON p.album_id = a.id
       WHERE p.id = $1 AND p.album_id = $2 AND a.user_id = $3`,
      [photoId, albumId, userId]
    );

    if (photosResult.rows.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    res.json({
      downloadUrl: photosResult.rows[0].original_url,
      fileName: photosResult.rows[0].original_name,
    });
  } catch (error) {
    console.error('Get photo original error:', error);
    res.status(500).json({ error: '获取原图失败' });
  }
}
