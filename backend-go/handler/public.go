package handler

import (
	"context"
	"net/http"
	"picshare/model"
	"picshare/repository"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ViewAlbumByShareCode - GET /api/s/:shareCode
func ViewAlbumByShareCode(c *gin.Context) {
	shareCode := c.Param("shareCode")
	if shareCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分享链接"})
		return
	}

	ctx := context.Background()

	album, err := repository.FindAlbumByShareCode(ctx, shareCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在或已被删除"})
		return
	}

	now := time.Now()
	if album.IsExpired || album.ExpiresAt.Before(now) {
		c.JSON(http.StatusGone, gin.H{"error": "影集已过期"})
		return
	}

	// Get photographer name
	user, _ := repository.FindUserByID(ctx, album.UserID)
	photographerName := ""
	if user != nil {
		photographerName = user.Name
	}

	// Get photos (public view - use thumbnail URLs)
	photos, _ := repository.GetPhotosByAlbumForPublic(ctx, album.ID)

	// Build public photo list
	publicPhotos := make([]gin.H, 0, len(photos))
	for _, p := range photos {
		publicPhotos = append(publicPhotos, gin.H{
			"id":           p.ID,
			"thumbnailUrl": p.ThumbnailURL,
			"width":        p.Width,
			"height":       p.Height,
		})
	}

	// Increment view count
	_ = repository.IncrementAlbumViewCount(ctx, album.ID)

	// Log access
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	_ = repository.CreateAccessLog(ctx, &model.AlbumAccessLog{
		AlbumID:   album.ID,
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
		Action:    "view",
	})

	c.JSON(http.StatusOK, gin.H{
		"album": gin.H{
			"id":               album.ID,
			"title":            album.Title,
			"description":      album.Description,
			"photographerName": photographerName,
			"photoCount":       album.PhotoCount,
			"expiresAt":        album.ExpiresAt,
			"createdAt":        album.CreatedAt,
		},
		"photos": publicPhotos,
	})
}

// DownloadPhoto - GET /api/s/:shareCode/photos/:photoId/download
func DownloadPhoto(c *gin.Context) {
	shareCode := c.Param("shareCode")
	photoIdStr := c.Param("photoId")

	photoID, err := strconv.Atoi(photoIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的照片ID"})
		return
	}

	ctx := context.Background()

	// Find album by share code
	album, err := repository.FindAlbumByShareCode(ctx, shareCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	now := time.Now()
	if album.IsExpired || album.ExpiresAt.Before(now) {
		c.JSON(http.StatusGone, gin.H{"error": "影集已过期"})
		return
	}

	// Find photo
	photo, err := repository.FindPhotoByIDAndAlbum(ctx, photoID, album.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "照片不存在"})
		return
	}

	// Increment download counts
	_ = repository.IncrementPhotoDownloadCount(ctx, photoID)
	_ = repository.IncrementAlbumDownloadCount(ctx, album.ID)

	// Log access
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	_ = repository.CreateAccessLog(ctx, &model.AlbumAccessLog{
		AlbumID:   album.ID,
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
		Action:    "download",
		PhotoID:   &photoID,
	})

	c.JSON(http.StatusOK, gin.H{
		"downloadUrl": photo.OriginalURL,
		"fileName":    photo.OriginalName,
	})
}
