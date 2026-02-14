package repository

import (
	"context"

	"picshare/model"
)

// CreateAccessLog creates an album access log entry
func CreateAccessLog(ctx context.Context, log *model.AlbumAccessLog) error {
	query := `
		INSERT INTO album_access_logs (album_id, ip_address, user_agent, action, photo_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`

	err := db.QueryRow(ctx, query,
		log.AlbumID,
		log.IPAddress,
		log.UserAgent,
		log.Action,
		log.PhotoID,
	).Scan(&log.ID, &log.CreatedAt)

	return err
}

// GetAccessLogsByAlbum returns access logs for an album (max 100)
func GetAccessLogsByAlbum(ctx context.Context, albumID int) ([]model.AlbumAccessLog, error) {
	query := `
		SELECT id, album_id, ip_address, user_agent, action, photo_id, created_at
		FROM album_access_logs
		WHERE album_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`

	rows, err := db.Query(ctx, query, albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.AlbumAccessLog
	for rows.Next() {
		var l model.AlbumAccessLog
		err := rows.Scan(
			&l.ID,
			&l.AlbumID,
			&l.IPAddress,
			&l.UserAgent,
			&l.Action,
			&l.PhotoID,
			&l.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}

	return logs, rows.Err()
}
