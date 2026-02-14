package handler

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"picshare/config"
	"picshare/middleware"
	"picshare/model"
	"picshare/repository"
	"picshare/service"
	"picshare/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
)

type createAlbumRequest struct {
	Title          string  `json:"title"`
	Description    *string `json:"description"`
	ExpiresInHours *int    `json:"expiresInHours"`
}

type updateAlbumRequest struct {
	Title          *string `json:"title"`
	Description    *string `json:"description"`
	ExpiresInHours *int    `json:"expiresInHours"`
}

// CreateAlbum - POST /api/albums
func CreateAlbum(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req createAlbumRequest
	c.ShouldBindJSON(&req)

	ctx := context.Background()

	// Check album limit
	count, _ := repository.CountActiveAlbumsByUser(ctx, userID)
	cfg := config.Get()
	if count >= cfg.Upload.MaxAlbumsPerUser {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("每个用户最多只能创建 %d 个未过期影集", cfg.Upload.MaxAlbumsPerUser)})
		return
	}

	// Generate title and share code
	title := req.Title
	if title == "" {
		title = util.GenerateAlbumTitle()
	}
	shareCode := util.GenerateShareCode()

	// Calculate expiry
	var expiresAt time.Time
	if req.ExpiresInHours != nil && *req.ExpiresInHours > 0 {
		expiresAt = time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
	} else {
		expiresAt = util.GetDefaultExpiry()
	}

	album := &model.Album{
		UserID:      userID,
		Title:       title,
		ShareCode:   shareCode,
		Description: req.Description,
		ExpiresAt:   expiresAt,
		PhotoCount:  0,
		ViewCount:   0,
		DownloadCount: 0,
		IsExpired:   false,
	}

	err := repository.CreateAlbum(ctx, album)
	if err != nil {
		util.Log("Failed to create album: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建影集失败"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "影集创建成功",
		"album": gin.H{
			"id":            album.ID,
			"title":         album.Title,
			"shareCode":     album.ShareCode,
			"description":   album.Description,
			"expiresAt":     album.ExpiresAt,
			"photoCount":    0,
			"viewCount":     0,
			"downloadCount": 0,
		},
	})
}

// GetMyAlbums - GET /api/albums
func GetMyAlbums(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	page, limit := util.ParsePagination(c.Query("page"), c.Query("limit"))

	ctx := context.Background()
	albums, total, err := repository.GetAlbumsByUser(ctx, userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取影集列表失败"})
		return
	}

	// Mark expired and add shareUrl
	now := time.Now()
	cfg := config.Get()
	albumsWithStatus := make([]gin.H, len(albums))
	for i, a := range albums {
		isExpired := a.IsExpired || a.ExpiresAt.Before(now)
		albumsWithStatus[i] = gin.H{
			"id":            a.ID,
			"title":         a.Title,
			"shareCode":     a.ShareCode,
			"description":   a.Description,
			"coverUrl":      a.CoverURL,
			"photoCount":    a.PhotoCount,
			"viewCount":     a.ViewCount,
			"downloadCount": a.DownloadCount,
			"expiresAt":     a.ExpiresAt,
			"isExpired":     isExpired,
			"createdAt":     a.CreatedAt,
			"shareUrl":      fmt.Sprintf("%s/s/%s", cfg.Frontend.URL, a.ShareCode),
		}
	}

	totalPages := (total + limit - 1) / limit

	c.JSON(http.StatusOK, gin.H{
		"albums": albumsWithStatus,
		"pagination": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// GetAlbumDetail - GET /api/albums/:id
func GetAlbumDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	userID, _ := middleware.GetUserID(c)
	userRole, _ := middleware.GetUserRole(c)
	isAdmin := userRole == "admin"

	ctx := context.Background()

	// First check album ownership
	album, err := repository.FindAlbumByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	// Check ownership or admin
	if album.UserID != userID && !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问此影集"})
		return
	}

	// Get photos
	photos, _ := repository.GetPhotosByAlbum(ctx, id)

	now := time.Now()
	isExpired := album.IsExpired || album.ExpiresAt.Before(now)
	cfg := config.Get()

	c.JSON(http.StatusOK, gin.H{
		"album": gin.H{
			"id":            album.ID,
			"title":         album.Title,
			"shareCode":     album.ShareCode,
			"description":   album.Description,
			"coverUrl":      album.CoverURL,
			"photoCount":    album.PhotoCount,
			"viewCount":     album.ViewCount,
			"downloadCount": album.DownloadCount,
			"expiresAt":     album.ExpiresAt,
			"isExpired":     isExpired,
			"createdAt":     album.CreatedAt,
			"shareUrl":      fmt.Sprintf("%s/s/%s", cfg.Frontend.URL, album.ShareCode),
		},
		"photos": photos,
	})
}

// UpdateAlbum - PUT /api/albums/:id
func UpdateAlbum(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	userID, _ := middleware.GetUserID(c)

	var req updateAlbumRequest
	c.ShouldBindJSON(&req)

	ctx := context.Background()

	// Verify ownership
	_, err = repository.FindAlbumByIDWithUser(ctx, id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	// Build update
	var title, description *string
	var expiresAt *time.Time

	if req.Title != nil {
		title = req.Title
	}
	if req.Description != nil {
		description = req.Description
	}
	if req.ExpiresInHours != nil {
		t := time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
		expiresAt = &t
	}

	// Check if there's anything to update
	if title == nil && description == nil && expiresAt == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "没有需要更新的内容"})
		return
	}

	err = repository.UpdateAlbum(ctx, id, userID, title, description, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新影集失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "影集已更新"})
}

// DeleteAlbum - DELETE /api/albums/:id
func DeleteAlbum(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	userID, _ := middleware.GetUserID(c)

	ctx := context.Background()

	// Verify ownership
	_, err = repository.FindAlbumByIDWithUser(ctx, id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	// Get all photo OSS keys
	ossKeys, _ := repository.GetPhotoOSSKeys(ctx, id)

	// Delete from OSS
	if len(ossKeys) > 0 {
		ossService := service.GetOSSService()
		_ = ossService.DeletePhotos(ctx, ossKeys)
	}

	// Delete from DB
	err = repository.DeleteAlbum(ctx, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除影集失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "影集已删除"})
}

// GetAlbumQRCode - GET /api/albums/:id/qrcode
func GetAlbumQRCode(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	userID, _ := middleware.GetUserID(c)

	ctx := context.Background()

	// Verify ownership
	album, err := repository.FindAlbumByIDWithUser(ctx, id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	cfg := config.Get()
	shareURL := fmt.Sprintf("%s/s/%s", cfg.Frontend.URL, album.ShareCode)

	// Generate QR code
	qrCode, err := qrcode.Encode(shareURL, qrcode.Medium, 512)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成二维码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"qrCode":   "data:image/png;base64," + base64.StdEncoding.EncodeToString(qrCode),
		"shareUrl":  shareURL,
		"shareCode": album.ShareCode,
	})
}
