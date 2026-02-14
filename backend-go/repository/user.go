package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"picshare/model"
)

// CreateUser inserts a new user
func CreateUser(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (email, password_hash, name, role, email_verified,
			verification_token, verification_expires)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`

	err := db.QueryRow(ctx, query,
		user.Email,
		user.PasswordHash,
		user.Name,
		user.Role,
		user.EmailVerified,
		user.VerificationToken,
		user.VerificationExpires,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	return err
}

// FindUserByEmail finds a user by email
func FindUserByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, email_verified,
			verification_token, verification_expires, reset_token, reset_expires,
			avatar_url, created_at, updated_at
		FROM users WHERE email = $1
	`

	var user model.User
	err := db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Role,
		&user.EmailVerified,
		&user.VerificationToken,
		&user.VerificationExpires,
		&user.ResetToken,
		&user.ResetExpires,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindUserByID finds a user by ID
func FindUserByID(ctx context.Context, id int) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, email_verified,
			verification_token, verification_expires, reset_token, reset_expires,
			avatar_url, created_at, updated_at
		FROM users WHERE id = $1
	`

	var user model.User
	err := db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Role,
		&user.EmailVerified,
		&user.VerificationToken,
		&user.VerificationExpires,
		&user.ResetToken,
		&user.ResetExpires,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates user fields
func UpdateUser(ctx context.Context, id int, name string, avatarURL *string) error {
	query := `UPDATE users SET name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3`
	_, err := db.Exec(ctx, query, name, avatarURL, id)
	return err
}

// UpdateUserPassword updates user password
func UpdateUserPassword(ctx context.Context, id int, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = $2`
	_, err := db.Exec(ctx, query, passwordHash, id)
	return err
}

// SetVerificationToken sets email verification token
func SetVerificationToken(ctx context.Context, id int, token string, expires time.Time) error {
	query := `UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3`
	_, err := db.Exec(ctx, query, &token, &expires, id)
	return err
}

// VerifyEmail marks user email as verified
func VerifyEmail(ctx context.Context, token string) error {
	query := `
		UPDATE users
		SET email_verified = true, verification_token = NULL, verification_expires = NULL
		WHERE verification_token = $1
		AND (verification_expires IS NULL OR verification_expires > NOW())
	`
	result, err := db.Exec(ctx, query, token)
	if err != nil {
		return err
	}
	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNoRowsUpdated
	}
	return nil
}

// SetResetToken sets password reset token
func SetResetToken(ctx context.Context, id int, token string, expires time.Time) error {
	query := `UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3`
	_, err := db.Exec(ctx, query, &token, &expires, id)
	return err
}

// FindUserByResetToken finds a user by reset token
func FindUserByResetToken(ctx context.Context, token string) (*model.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, email_verified,
			verification_token, verification_expires, reset_token, reset_expires,
			avatar_url, created_at, updated_at
		FROM users WHERE reset_token = $1
		AND (reset_expires IS NULL OR reset_expires > NOW())
	`

	var user model.User
	err := db.QueryRow(ctx, query, token).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.Role,
		&user.EmailVerified,
		&user.VerificationToken,
		&user.VerificationExpires,
		&user.ResetToken,
		&user.ResetExpires,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &user, nil
}

// CountUsers returns total user count
func CountUsers(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}

// GetRecentUsers returns recently registered users
func GetRecentUsers(ctx context.Context, limit int) ([]model.User, error) {
	query := `
		SELECT id, email, password_hash, name, role, email_verified,
			verification_token, verification_expires, reset_token, reset_expires,
			avatar_url, created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT $1
	`

	rows, err := db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		err := rows.Scan(
			&u.ID,
			&u.Email,
			&u.PasswordHash,
			&u.Name,
			&u.Role,
			&u.EmailVerified,
			&u.VerificationToken,
			&u.VerificationExpires,
			&u.ResetToken,
			&u.ResetExpires,
			&u.AvatarURL,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

// GetUsersPaginated returns paginated users list
func GetUsersPaginated(ctx context.Context, page, limit int) ([]model.User, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get users
	query := `
		SELECT id, email, password_hash, name, role, email_verified,
			verification_token, verification_expires, reset_token, reset_expires,
			avatar_url, created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`

	rows, err := db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		err := rows.Scan(
			&u.ID,
			&u.Email,
			&u.PasswordHash,
			&u.Name,
			&u.Role,
			&u.EmailVerified,
			&u.VerificationToken,
			&u.VerificationExpires,
			&u.ResetToken,
			&u.ResetExpires,
			&u.AvatarURL,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}

	return users, total, rows.Err()
}

// GetPhotographerUsersPaginated returns paginated photographer users with album stats (admin)
func GetPhotographerUsersPaginated(ctx context.Context, page, limit int) ([]gin.H, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE role = 'photographer'").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get users with album stats (matching Node.js query)
	query := `
		SELECT u.id, u.email, u.name, u.role, u.email_verified, u.created_at,
			COUNT(DISTINCT a.id) as album_count,
			COALESCE(SUM(a.photo_count), 0) as total_photos,
			COALESCE(SUM(a.view_count), 0) as total_views,
			COALESCE(SUM(a.download_count), 0) as total_downloads
		FROM users u
		LEFT JOIN albums a ON u.id = a.user_id
		WHERE u.role = 'photographer'
		GROUP BY u.id
		ORDER BY u.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []gin.H
	for rows.Next() {
		var (
			id, albumCount, totalPhotos, totalViews, totalDownloads int
			email, name, role                                       string
			emailVerified                                           bool
			createdAt                                               time.Time
		)
		err := rows.Scan(
			&id, &email, &name, &role, &emailVerified, &createdAt,
			&albumCount, &totalPhotos, &totalViews, &totalDownloads,
		)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, gin.H{
			"id":              id,
			"email":           email,
			"name":            name,
			"role":            role,
			"email_verified":  emailVerified,
			"created_at":      createdAt,
			"album_count":     albumCount,
			"total_photos":    totalPhotos,
			"total_views":     totalViews,
			"total_downloads": totalDownloads,
		})
	}

	return users, total, rows.Err()
}

// CountPhotographerUsers returns photographer user count
func CountPhotographerUsers(ctx context.Context) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE role = 'photographer'").Scan(&count)
	return count, err
}

// CountRecentUsers returns users created within days
func CountRecentUsers(ctx context.Context, days int) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '1 day' * $1", days).Scan(&count)
	return count, err
}

// CountRecentAlbums returns albums created within days
func CountRecentAlbums(ctx context.Context, days int) (int, error) {
	var count int
	err := db.QueryRow(ctx, "SELECT COUNT(*) FROM albums WHERE created_at > NOW() - INTERVAL '1 day' * $1", days).Scan(&count)
	return count, err
}

// Custom errors
var (
	ErrNoRowsUpdated = fmt.Errorf("no rows updated")
)
