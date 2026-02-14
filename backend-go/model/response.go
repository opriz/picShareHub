package model

import "time"

// User represents a user in the system
type User struct {
	ID               int       `json:"id" db:"id"`
	Email            string    `json:"email" db:"email"`
	PasswordHash     string    `json:"-" db:"password_hash"`
	Name             string    `json:"name" db:"name"`
	Role             string    `json:"role" db:"role"` // photographer, admin
	EmailVerified    bool      `json:"emailVerified" db:"email_verified"`
	VerificationToken *string  `json:"-" db:"verification_token"`
	VerificationExpires *time.Time `json:"-" db:"verification_expires"`
	ResetToken       *string   `json:"-" db:"reset_token"`
	ResetExpires     *time.Time `json:"-" db:"reset_expires"`
	AvatarURL        *string   `json:"avatarUrl,omitempty" db:"avatar_url"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time `json:"updatedAt" db:"updated_at"`
}

// Album represents a photo album
type Album struct {
	ID          int        `json:"id" db:"id"`
	UserID      int        `json:"-" db:"user_id"`
	Title       string     `json:"title" db:"title"`
	ShareCode   string     `json:"shareCode" db:"share_code"`
	Description *string    `json:"description,omitempty" db:"description"`
	CoverURL    *string    `json:"coverUrl,omitempty" db:"cover_url"`
	PhotoCount  int        `json:"photoCount" db:"photo_count"`
	ViewCount   int        `json:"viewCount" db:"view_count"`
	DownloadCount int      `json:"downloadCount" db:"download_count"`
	ExpiresAt   time.Time  `json:"expiresAt" db:"expires_at"`
	IsExpired   bool       `json:"isExpired" db:"is_expired"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`

	// Computed fields (not in DB)
	ShareURL    string     `json:"shareUrl,omitempty"`
	IsOwner     bool       `json:"isOwner,omitempty"`
	PhotographerName string `json:"photographerName,omitempty"`
}

// Photo represents a photo in an album
type Photo struct {
	ID              int        `json:"id" db:"id"`
	AlbumID         int        `json:"-" db:"album_id"`
	UserID          int        `json:"-" db:"user_id"`
	OriginalName    string     `json:"-" db:"original_name"`
	OriginalURL     string     `json:"originalUrl" db:"original_url"`
	ThumbnailURL    string     `json:"thumbnailUrl" db:"thumbnail_url"`
	OSSKey          string     `json:"-" db:"oss_key"`
	ThumbnailOSSKey string     `json:"-" db:"thumbnail_oss_key"`
	FileSize        int64      `json:"fileSize" db:"file_size"`
	Width           int        `json:"width" db:"width"`
	Height          int        `json:"height" db:"height"`
	MimeType        string     `json:"mimeType" db:"mime_type"`
	DownloadCount   int        `json:"downloadCount" db:"download_count"`
	SortOrder       int        `json:"sortOrder" db:"sort_order"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`

	// For public view (original URL not exposed)
	URL             string     `json:"url,omitempty"`
}

// AlbumAccessLog represents a log entry for album access
type AlbumAccessLog struct {
	ID        int        `json:"id" db:"id"`
	AlbumID   int        `json:"-" db:"album_id"`
	IPAddress *string    `json:"-" db:"ip_address"`
	UserAgent *string    `json:"-" db:"user_agent"`
	Action    string     `json:"action" db:"action"` // view, download
	PhotoID   *int       `json:"-" db:"photo_id"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
}

// Stats represents dashboard statistics
type Stats struct {
	TotalUsers     int      `json:"totalUsers"`
	TotalAlbums    int      `json:"totalAlbums"`
	ActiveAlbums   int      `json:"activeAlbums"`
	TotalPhotos    int      `json:"totalPhotos"`
	TotalViews     int      `json:"totalViews"`
	TotalDownloads int      `json:"totalDownloads"`
	RecentAlbums   []Album  `json:"recentAlbums"`
	RecentUsers    []User   `json:"recentUsers"`
}

// Pagination represents pagination info
type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// Response represents a standard API response
type Response struct {
	Success bool        `json:"-"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"-"`
	Token   string      `json:"token,omitempty"`
	User    *User       `json:"user,omitempty"`
	Album   *Album      `json:"album,omitempty"`
	Albums  []Album     `json:"albums,omitempty"`
	Photos  []Photo     `json:"photos,omitempty"`
	QRCode  string     `json:"qrCode,omitempty"`
	ShareURL string     `json:"shareUrl,omitempty"`
	ShareCode string   `json:"shareCode,omitempty"`
	DownloadURL string `json:"downloadUrl,omitempty"`
	FileName string    `json:"fileName,omitempty"`
	Stats   *Stats     `json:"stats,omitempty"`
	Users   []User     `json:"users,omitempty"`
	Logs    []AlbumAccessLog `json:"logs,omitempty"`
	Pagination *Pagination `json:"pagination,omitempty"`
	Failed  int         `json:"failed,omitempty"`
}
