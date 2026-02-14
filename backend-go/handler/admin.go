package handler

import (
	"context"
	"math"
	"net/http"
	"picshare/repository"
	"picshare/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetDashboardStats - GET /api/admin/stats
func GetDashboardStats(c *gin.Context) {
	ctx := context.Background()

	// Run all queries
	totalUsers, _ := repository.CountPhotographerUsers(ctx)
	totalAlbums, _ := repository.CountAlbums(ctx)
	activeAlbums, _ := repository.CountActiveAlbums(ctx)
	totalPhotos, _ := repository.CountPhotos(ctx)
	totalViews, _ := repository.GetTotalViews(ctx)
	totalDownloads, _ := repository.GetTotalDownloads(ctx)
	recentAlbums, _ := repository.CountRecentAlbums(ctx, 7)
	recentUsers, _ := repository.CountRecentUsers(ctx, 7)

	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"totalUsers":     totalUsers,
			"totalAlbums":    totalAlbums,
			"activeAlbums":   activeAlbums,
			"totalPhotos":    totalPhotos,
			"totalViews":     totalViews,
			"totalDownloads": totalDownloads,
			"recentAlbums":   recentAlbums,
			"recentUsers":    recentUsers,
		},
	})
}

// GetAllUsers - GET /api/admin/users
func GetAllUsers(c *gin.Context) {
	page, limit := util.ParsePagination(c.Query("page"), c.Query("limit"))

	ctx := context.Background()

	users, total, err := repository.GetPhotographerUsersPaginated(ctx, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败"})
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"pagination": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// GetUserAlbums - GET /api/admin/users/:userId/albums
func GetUserAlbums(c *gin.Context) {
	userIdStr := c.Param("userId")
	userID, err := strconv.Atoi(userIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	page, limit := util.ParsePagination(c.Query("page"), c.Query("limit"))

	ctx := context.Background()

	albums, total, err := repository.GetAlbumsByUser(ctx, userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取影集列表失败"})
		return
	}

	now := time.Now()
	albumsWithStatus := make([]gin.H, len(albums))
	for i, a := range albums {
		isExpired := a.IsExpired || a.ExpiresAt.Before(now)
		albumsWithStatus[i] = gin.H{
			"id":             a.ID,
			"title":          a.Title,
			"share_code":     a.ShareCode,
			"photo_count":    a.PhotoCount,
			"view_count":     a.ViewCount,
			"download_count": a.DownloadCount,
			"expires_at":     a.ExpiresAt,
			"is_expired":     a.IsExpired,
			"created_at":     a.CreatedAt,
			"isExpired":      isExpired,
		}
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

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

// GetAllAlbums - GET /api/admin/albums
func GetAllAlbums(c *gin.Context) {
	page, limit := util.ParsePagination(c.Query("page"), c.Query("limit"))
	status := c.Query("status")

	ctx := context.Background()

	albums, total, err := repository.GetAllAlbumsWithUserPaginated(ctx, page, limit, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取影集列表失败"})
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	c.JSON(http.StatusOK, gin.H{
		"albums": albums,
		"pagination": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// GetAlbumLogs - GET /api/admin/albums/:albumId/logs
func GetAlbumLogs(c *gin.Context) {
	albumIdStr := c.Param("albumId")
	albumID, err := strconv.Atoi(albumIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	ctx := context.Background()

	logs, err := repository.GetAccessLogsByAlbum(ctx, albumID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取访问日志失败"})
		return
	}

	// Format logs
	formattedLogs := make([]gin.H, len(logs))
	for i, l := range logs {
		formattedLogs[i] = gin.H{
			"action":     l.Action,
			"ip_address": l.IPAddress,
			"created_at": l.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"logs": formattedLogs,
	})
}
