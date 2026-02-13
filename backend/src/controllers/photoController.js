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
    const [albums] = await pool.query(
      'SELECT id, is_expired, expires_at FROM albums WHERE id = ? AND user_id = ?',
      [albumId, userId]
    );

    if (albums.length === 0) {
      return res.status(404).json({ error: '影集不存在' });
    }

    if (albums[0].is_expired || new Date(albums[0].expires_at) < new Date()) {
      return res.status(400).json({ error: '影集已过期，无法上传' });
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

        // Save to DB
        const [result] = await pool.query(
          `INSERT INTO photos (album_id, user_id, original_name, original_url, thumbnail_url,
            oss_key, thumbnail_oss_key, file_size, width, height, mime_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          id: result.insertId,
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
          photo_count = (SELECT COUNT(*) FROM photos WHERE album_id = ?),
          cover_url = COALESCE(cover_url, ?)
        WHERE id = ?`,
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
    const [photos] = await pool.query(
      `SELECT p.oss_key, p.thumbnail_oss_key
       FROM photos p
       JOIN albums a ON p.album_id = a.id
       WHERE p.id = ? AND p.album_id = ? AND a.user_id = ?`,
      [photoId, albumId, userId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // Delete from OSS
    try {
      const oss = getOSSClient();
      await oss.deleteMulti([photos[0].oss_key, photos[0].thumbnail_oss_key]);
    } catch (ossErr) {
      console.error('OSS delete error:', ossErr);
    }

    // Delete from DB
    await pool.query('DELETE FROM photos WHERE id = ?', [photoId]);

    // Update album count
    await pool.query(
      `UPDATE albums SET photo_count = (SELECT COUNT(*) FROM photos WHERE album_id = ?) WHERE id = ?`,
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

    const [photos] = await pool.query(
      `SELECT p.original_url, p.original_name
       FROM photos p
       JOIN albums a ON p.album_id = a.id
       WHERE p.id = ? AND p.album_id = ? AND a.user_id = ?`,
      [photoId, albumId, userId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }

    res.json({
      downloadUrl: photos[0].original_url,
      fileName: photos[0].original_name,
    });
  } catch (error) {
    console.error('Get photo original error:', error);
    res.status(500).json({ error: '获取原图失败' });
  }
}
