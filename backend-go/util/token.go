package util

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// GenerateRandomToken generates a 64-character hex string (32 bytes)
func GenerateRandomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Fallback: combine multiple random values
		h := sha256.New()
		h.Write([]byte(time.Now().String()))
		return hex.EncodeToString(h.Sum(nil))
	}
	return hex.EncodeToString(b)
}

// GenerateShareCode generates a 16-character hex string (8 bytes)
func GenerateShareCode() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%016x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// FormatDate formats a date in Chinese locale format
func FormatDate(t time.Time) string {
	return t.Format("2006-01-02 15:04")
}

// GetDefaultExpiry returns the default expiry time (24 hours from now)
func GetDefaultExpiry() time.Time {
	return time.Now().Add(24 * time.Hour)
}

// GenerateAlbumTitle generates a default album title based on current time
func GenerateAlbumTitle() string {
	return time.Now().Format("2006-01-02 15:04")
}

// FormatFileSize converts bytes to human-readable format
func FormatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	units := []string{"KB", "MB", "GB", "TB"}
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), units[exp])
}
