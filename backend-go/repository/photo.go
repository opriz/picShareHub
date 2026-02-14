package repository

import (
	"context"

	"picshare/model"
)

// CreatePhoto creates a new photo
func CreatePhoto(ctx context.Context, photo *model.Photo) error {
	query := `
		INSERT INTO photos (album_id, user_id, original_name, original_url, thumbnail_url,
			oss_key, thumbnail_oss_key, file_size, width, height, mime_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at
	`

	err := db.QueryRow(ctx, query,
		photo.AlbumID,
		photo.UserID,
		photo.OriginalName,
		photo.OriginalURL,
		photo.ThumbnailURL,
		photo.OSSKey,
		photo.ThumbnailOSSKey,
		photo.FileSize,
		photo.Width,
		photo.Height,
		photo.MimeType,
	).Scan(&photo.ID, &photo.CreatedAt)

	return err
}

// FindPhotoByID finds a photo by ID
func FindPhotoByID(ctx context.Context, id int) (*model.Photo, error) {
	query := `
		SELECT id, album_id, user_id, original_name, original_url, thumbnail_url,
			oss_key, thumbnail_oss_key, file_size, width, height, mime_type,
			download_count, sort_order, created_at
		FROM photos WHERE id = $1
	`

	var photo model.Photo
	err := db.QueryRow(ctx, query, id).Scan(
		&photo.ID,
		&photo.AlbumID,
		&photo.UserID,
		&photo.OriginalName,
		&photo.OriginalURL,
		&photo.ThumbnailURL,
		&photo.OSSKey,
		&photo.ThumbnailOSSKey,
		&photo.FileSize,
		&photo.Width,
		&photo.Height,
		&photo.MimeType,
		&photo.DownloadCount,
		&photo.SortOrder,
		&photo.CreatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &photo, nil
}

// FindPhotoByIDAndAlbum finds a photo by ID and album
func FindPhotoByIDAndAlbum(ctx context.Context, photoID, albumID int) (*model.Photo, error) {
	query := `
		SELECT id, album_id, user_id, original_name, original_url, thumbnail_url,
			oss_key, thumbnail_oss_key, file_size, width, height, mime_type,
			download_count, sort_order, created_at
		FROM photos WHERE id = $1 AND album_id = $2
	`

	var photo model.Photo
	err := db.QueryRow(ctx, query, photoID, albumID).Scan(
		&photo.ID,
		&photo.AlbumID,
		&photo.UserID,
		&photo.OriginalName,
		&photo.OriginalURL,
		&photo.ThumbnailURL,
		&photo.OSSKey,
		&photo.ThumbnailOSSKey,
		&photo.FileSize,
		&photo.Width,
		&photo.Height,
		&photo.MimeType,
		&photo.DownloadCount,
		&photo.SortOrder,
		&photo.CreatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &photo, nil
}

// GetPhotosByAlbum returns photos for an album
func GetPhotosByAlbum(ctx context.Context, albumID int) ([]model.Photo, error) {
	query := `
		SELECT id, album_id, user_id, original_name, original_url, thumbnail_url,
			oss_key, thumbnail_oss_key, file_size, width, height, mime_type,
			download_count, sort_order, created_at
		FROM photos WHERE album_id = $1 ORDER BY sort_order ASC, created_at ASC
	`

	rows, err := db.Query(ctx, query, albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var photos []model.Photo
	for rows.Next() {
		var p model.Photo
		err := rows.Scan(
			&p.ID,
			&p.AlbumID,
			&p.UserID,
			&p.OriginalName,
			&p.OriginalURL,
			&p.ThumbnailURL,
			&p.OSSKey,
			&p.ThumbnailOSSKey,
			&p.FileSize,
			&p.Width,
			&p.Height,
			&p.MimeType,
			&p.DownloadCount,
			&p.SortOrder,
			&p.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}

	return photos, rows.Err()
}

// DeletePhoto deletes a photo
func DeletePhoto(ctx context.Context, photoID, albumID int) error {
	query := `DELETE FROM photos WHERE id = $1 AND album_id = $2`
	_, err := db.Exec(ctx, query, photoID, albumID)
	return err
}

// IncrementPhotoDownloadCount increments download count
func IncrementPhotoDownloadCount(ctx context.Context, photoID int) error {
	query := `UPDATE photos SET download_count = download_count + 1 WHERE id = $1`
	_, err := db.Exec(ctx, query, photoID)
	return err
}

// GetPhotosByAlbumForPublic returns photos for public view (without sensitive data)
func GetPhotosByAlbumForPublic(ctx context.Context, albumID int) ([]model.Photo, error) {
	query := `
		SELECT id, album_id, user_id, original_name, original_url, thumbnail_url,
			oss_key, thumbnail_oss_key, file_size, width, height, mime_type,
			download_count, sort_order, created_at
		FROM photos WHERE album_id = $1 ORDER BY sort_order ASC, created_at ASC
	`

	rows, err := db.Query(ctx, query, albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var photos []model.Photo
	for rows.Next() {
		var p model.Photo
		err := rows.Scan(
			&p.ID,
			&p.AlbumID,
			&p.UserID,
			&p.OriginalName,
			&p.OriginalURL,
			&p.ThumbnailURL,
			&p.OSSKey,
			&p.ThumbnailOSSKey,
			&p.FileSize,
			&p.Width,
			&p.Height,
			&p.MimeType,
			&p.DownloadCount,
			&p.SortOrder,
			&p.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}

	return photos, rows.Err()
}

// CountPhotos returns total photo count
func CountPhotos(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM photos").Scan(&count)
	return count, err
}

// GetTotalViews returns total view count across all albums
func GetTotalViews(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COALESCE(SUM(view_count), 0) FROM albums").Scan(&count)
	return count, err
}

// GetTotalDownloads returns total download count across all albums
func GetTotalDownloads(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COALESCE(SUM(download_count), 0) FROM albums").Scan(&count)
	return count, err
}

// GetPhotoOSSKeys returns all OSS keys for an album (original + thumbnail)
func GetPhotoOSSKeys(ctx context.Context, albumID int) ([]string, error) {
	query := `
		SELECT oss_key, thumbnail_oss_key FROM photos WHERE album_id = $1
	`

	rows, err := db.Query(ctx, query, albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var ossKey, thumbKey string
		err := rows.Scan(&ossKey, &thumbKey)
		if err != nil {
			return nil, err
		}
		keys = append(keys, ossKey, thumbKey)
	}

	return keys, rows.Err()
}

// GetAlbumCoverURL returns the first photo's thumbnail as cover
func GetAlbumCoverURL(ctx context.Context, albumID int) (*string, error) {
	query := `
		SELECT thumbnail_url FROM photos WHERE album_id = $1 ORDER BY sort_order ASC LIMIT 1
	`

	var url string
	err := db.QueryRow(ctx, query, albumID).Scan(&url)
	if err != nil {
		return nil, err
	}
	return &url, nil
}
