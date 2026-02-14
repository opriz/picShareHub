package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"picshare/model"
)

// CreateAlbum creates a new album
func CreateAlbum(ctx context.Context, album *model.Album) error {
	query := `
		INSERT INTO albums (user_id, title, share_code, description, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	err := db.QueryRow(ctx, query,
		album.UserID,
		album.Title,
		album.ShareCode,
		album.Description,
		album.ExpiresAt,
	).Scan(&album.ID, &album.CreatedAt, &album.UpdatedAt)

	return err
}

// FindAlbumByID finds an album by ID
func FindAlbumByID(ctx context.Context, id int) (*model.Album, error) {
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums WHERE id = $1
	`

	var album model.Album
	err := db.QueryRow(ctx, query, id).Scan(
		&album.ID,
		&album.UserID,
		&album.Title,
		&album.ShareCode,
		&album.Description,
		&album.CoverURL,
		&album.PhotoCount,
		&album.ViewCount,
		&album.DownloadCount,
		&album.ExpiresAt,
		&album.IsExpired,
		&album.CreatedAt,
		&album.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &album, nil
}

// FindAlbumByShareCode finds an album by share code
func FindAlbumByShareCode(ctx context.Context, shareCode string) (*model.Album, error) {
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums WHERE share_code = $1
	`

	var album model.Album
	err := db.QueryRow(ctx, query, shareCode).Scan(
		&album.ID,
		&album.UserID,
		&album.Title,
		&album.ShareCode,
		&album.Description,
		&album.CoverURL,
		&album.PhotoCount,
		&album.ViewCount,
		&album.DownloadCount,
		&album.ExpiresAt,
		&album.IsExpired,
		&album.CreatedAt,
		&album.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &album, nil
}

// FindAlbumByIDWithUser finds an album and checks ownership
func FindAlbumByIDWithUser(ctx context.Context, id, userID int) (*model.Album, error) {
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums WHERE id = $1 AND user_id = $2
	`

	var album model.Album
	err := db.QueryRow(ctx, query, id, userID).Scan(
		&album.ID,
		&album.UserID,
		&album.Title,
		&album.ShareCode,
		&album.Description,
		&album.CoverURL,
		&album.PhotoCount,
		&album.ViewCount,
		&album.DownloadCount,
		&album.ExpiresAt,
		&album.IsExpired,
		&album.CreatedAt,
		&album.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &album, nil
}

// GetAlbumsByUser returns paginated albums for a user
func GetAlbumsByUser(ctx context.Context, userID int, page, limit int) ([]model.Album, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM albums WHERE user_id = $1", userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get albums
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		err := rows.Scan(
			&a.ID,
			&a.UserID,
			&a.Title,
			&a.ShareCode,
			&a.Description,
			&a.CoverURL,
			&a.PhotoCount,
			&a.ViewCount,
			&a.DownloadCount,
			&a.ExpiresAt,
			&a.IsExpired,
			&a.CreatedAt,
			&a.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		albums = append(albums, a)
	}

	return albums, total, rows.Err()
}

// UpdateAlbum updates album fields
func UpdateAlbum(ctx context.Context, id, userID int, title, description *string, expiresAt *time.Time) error {
	query := `
		UPDATE albums
		SET title = COALESCE($1, title),
			description = COALESCE($2, description),
			expires_at = COALESCE($3, expires_at),
			updated_at = NOW()
		WHERE id = $4 AND user_id = $5
	`
	_, err := db.Exec(ctx, query, title, description, expiresAt, id, userID)
	return err
}

// UpdateAlbumCover updates album cover URL
func UpdateAlbumCover(ctx context.Context, albumID int, coverURL string) error {
	query := `UPDATE albums SET cover_url = $1, updated_at = NOW() WHERE id = $2`
	_, err := db.Exec(ctx, query, coverURL, albumID)
	return err
}

// IncrementAlbumPhotoCount increments photo count
func IncrementAlbumPhotoCount(ctx context.Context, albumID int, count int) error {
	query := `UPDATE albums SET photo_count = photo_count + $1, updated_at = NOW() WHERE id = $2`
	_, err := db.Exec(ctx, query, count, albumID)
	return err
}

// IncrementAlbumViewCount increments view count
func IncrementAlbumViewCount(ctx context.Context, albumID int) error {
	query := `UPDATE albums SET view_count = view_count + 1 WHERE id = $1`
	_, err := db.Exec(ctx, query, albumID)
	return err
}

// IncrementAlbumDownloadCount increments download count
func IncrementAlbumDownloadCount(ctx context.Context, albumID int) error {
	query := `UPDATE albums SET download_count = download_count + 1 WHERE id = $1`
	_, err := db.Exec(ctx, query, albumID)
	return err
}

// DeleteAlbum deletes an album (cascades to photos and logs)
func DeleteAlbum(ctx context.Context, id, userID int) error {
	query := `DELETE FROM albums WHERE id = $1 AND user_id = $2`
	_, err := db.Exec(ctx, query, id, userID)
	return err
}

// CountActiveAlbumsByUser counts non-expired albums for a user
func CountActiveAlbumsByUser(ctx context.Context, userID int) (int, error) {
	query := `
		SELECT COUNT(*) FROM albums
		WHERE user_id = $1 AND (is_expired = false OR expires_at > NOW())
	`
	var count int
	err := db.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

// CountPhotosInAlbum counts photos in an album
func CountPhotosInAlbum(ctx context.Context, albumID int) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM photos WHERE album_id = $1", albumID).Scan(&count)
	return count, err
}

// GetAllAlbumsPaginated returns all albums (admin)
func GetAllAlbumsPaginated(ctx context.Context, page, limit int, status string) ([]model.Album, int, error) {
	offset := (page - 1) * limit

	// Build WHERE clause based on status
	whereClause := ""
	args := []interface{}{}
	argNum := 1

	if status == "active" {
		whereClause = "WHERE (is_expired = false OR expires_at > NOW())"
	} else if status == "expired" {
		whereClause = "WHERE is_expired = true AND expires_at <= NOW()"
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM albums " + whereClause
	err := db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get albums
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums ` + whereClause + `
		ORDER BY created_at DESC LIMIT $` + string(rune('0'+argNum)) + ` OFFSET $` + string(rune('0'+argNum+1))
	args = append(args, limit, offset)

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		err := rows.Scan(
			&a.ID,
			&a.UserID,
			&a.Title,
			&a.ShareCode,
			&a.Description,
			&a.CoverURL,
			&a.PhotoCount,
			&a.ViewCount,
			&a.DownloadCount,
			&a.ExpiresAt,
			&a.IsExpired,
			&a.CreatedAt,
			&a.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		albums = append(albums, a)
	}

	return albums, total, rows.Err()
}

// GetRecentAlbums returns recently created albums
func GetRecentAlbums(ctx context.Context, limit int) ([]model.Album, error) {
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums ORDER BY created_at DESC LIMIT $1
	`

	rows, err := db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		err := rows.Scan(
			&a.ID,
			&a.UserID,
			&a.Title,
			&a.ShareCode,
			&a.Description,
			&a.CoverURL,
			&a.PhotoCount,
			&a.ViewCount,
			&a.DownloadCount,
			&a.ExpiresAt,
			&a.IsExpired,
			&a.CreatedAt,
			&a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		albums = append(albums, a)
	}

	return albums, rows.Err()
}

// MarkAlbumsExpired marks newly expired albums
func MarkAlbumsExpired(ctx context.Context) (int64, error) {
	query := `
		UPDATE albums
		SET is_expired = true, updated_at = NOW()
		WHERE is_expired = false AND expires_at <= NOW()
	`
	result, err := db.Exec(ctx, query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// GetExpiredAlbumsForDeletion returns albums expired for more than 1 day
func GetExpiredAlbumsForDeletion(ctx context.Context) ([]model.Album, error) {
	query := `
		SELECT id, user_id, title, share_code, description, cover_url,
			photo_count, view_count, download_count, expires_at, is_expired,
			created_at, updated_at
		FROM albums
		WHERE is_expired = true AND expires_at <= NOW() - INTERVAL '1 day'
		ORDER BY expires_at ASC
	`

	rows, err := db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var albums []model.Album
	for rows.Next() {
		var a model.Album
		err := rows.Scan(
			&a.ID,
			&a.UserID,
			&a.Title,
			&a.ShareCode,
			&a.Description,
			&a.CoverURL,
			&a.PhotoCount,
			&a.ViewCount,
			&a.DownloadCount,
			&a.ExpiresAt,
			&a.IsExpired,
			&a.CreatedAt,
			&a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		albums = append(albums, a)
	}

	return albums, rows.Err()
}

// DeleteAlbumByID deletes an album by ID (admin/cleanup)
func DeleteAlbumByID(ctx context.Context, albumID int) error {
	query := `DELETE FROM albums WHERE id = $1`
	_, err := db.Exec(ctx, query, albumID)
	return err
}

// CountAlbums returns total album count
func CountAlbums(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM albums").Scan(&count)
	return count, err
}

// CountActiveAlbums returns active album count
func CountActiveAlbums(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, `
		SELECT COUNT(*) FROM albums
		WHERE is_expired = FALSE AND expires_at > NOW()
	`).Scan(&count)
	return count, err
}

// GetAllAlbumsWithUserPaginated returns all albums with user info (admin)
func GetAllAlbumsWithUserPaginated(ctx context.Context, page, limit int, status string) ([]gin.H, int, error) {
	offset := (page - 1) * limit

	// Build WHERE clause
	whereClause := ""
	if status == "active" {
		whereClause = "WHERE a.is_expired = FALSE AND a.expires_at > NOW()"
	} else if status == "expired" {
		whereClause = "WHERE a.is_expired = TRUE OR a.expires_at <= NOW()"
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM albums a " + whereClause
	err := db.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get albums with user info
	query := fmt.Sprintf(`
		SELECT a.id, a.title, a.share_code, a.photo_count, a.view_count, a.download_count,
			a.expires_at, a.is_expired, a.created_at, u.name as photographer_name, u.email as photographer_email
		FROM albums a
		JOIN users u ON a.user_id = u.id
		%s
		ORDER BY a.created_at DESC
		LIMIT $1 OFFSET $2
	`, whereClause)

	rows, err := db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	now := time.Now()
	var albums []gin.H
	for rows.Next() {
		var (
			id, photoCount, viewCount, downloadCount int
			title, shareCode, photographerName, photographerEmail string
			expiresAt, createdAt time.Time
			isExpired bool
		)
		err := rows.Scan(
			&id, &title, &shareCode, &photoCount, &viewCount, &downloadCount,
			&expiresAt, &isExpired, &createdAt, &photographerName, &photographerEmail,
		)
		if err != nil {
			return nil, 0, err
		}

		albums = append(albums, gin.H{
			"id":                id,
			"title":             title,
			"share_code":        shareCode,
			"photo_count":       photoCount,
			"view_count":        viewCount,
			"download_count":    downloadCount,
			"expires_at":        expiresAt,
			"is_expired":        isExpired,
			"created_at":        createdAt,
			"photographer_name": photographerName,
			"photographer_email": photographerEmail,
			"isExpired":         isExpired || expiresAt.Before(now),
		})
	}

	return albums, total, rows.Err()
}
