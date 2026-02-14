package handler

import (
	"context"
	"fmt"
	"net/http"
	"picshare/config"
	"picshare/middleware"
	"picshare/model"
	"picshare/repository"
	"picshare/service"
	"picshare/util"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadPhotos - POST /api/albums/:albumId/photos
func UploadPhotos(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	albumIdStr := c.Param("albumId")
	albumID, err := strconv.Atoi(albumIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	files := middleware.GetUploadedFiles(c)
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择照片上传"})
		return
	}

	ctx := context.Background()

	// Verify ownership and check if expired
	album, err := repository.FindAlbumByIDWithUser(ctx, albumID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "影集不存在"})
		return
	}

	now := time.Now()
	if album.IsExpired || album.ExpiresAt.Before(now) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "影集已过期，无法上传"})
		return
	}

	// Check photo limit
	count, _ := repository.CountPhotosInAlbum(ctx, albumID)
	cfg := config.Get()
	maxPhotos := cfg.Upload.MaxPhotosPerAlbum

	if count >= maxPhotos {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("影集最多只能包含 %d 张照片", maxPhotos)})
		return
	}

	if count+len(files) > maxPhotos {
		remaining := maxPhotos - count
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("影集最多只能包含 %d 张照片，当前已有 %d 张，最多还能上传 %d 张", maxPhotos, count, remaining)})
		return
	}

	ossService := service.GetOSSService()
	imageService := service.GetImageService()

	uploadedPhotos := make([]gin.H, 0)
	failedCount := 0

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			failedCount++
			continue
		}

		fileID := uuid.New().String()
		ext := filepath.Ext(fileHeader.Filename)
		if ext != "" {
			ext = ext[1:] // remove dot
		}
		if ext == "" || ext == "jpeg" || ext == "JPEG" {
			ext = "jpg"
		}

		// Generate thumbnail
		thumbnailBuffer, width, height, _, err := imageService.GenerateThumbnailJPEG(file)
		if err != nil {
			util.Log("Failed to generate thumbnail for %s: %v", fileHeader.Filename, err)
			failedCount++
			file.Close()
			continue
		}

		// Seek back to start
		file.Seek(0, 0)

		// Upload to OSS
		originalURL, thumbnailURL, ossKey, thumbOSSKey, err := ossService.UploadPhoto(
			ctx, userID, albumID, fileID, file, fileHeader, thumbnailBuffer,
			ext, width, height, fileHeader.Size,
		)
		file.Close()

		if err != nil {
			util.Log("Failed to upload %s: %v", fileHeader.Filename, err)
			failedCount++
			continue
		}

		// Save to DB
		mimeType := fileHeader.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "image/jpeg"
		}

		photo := &model.Photo{
			AlbumID:         albumID,
			UserID:           userID,
			OriginalName:     fileHeader.Filename,
			OriginalURL:      originalURL,
			ThumbnailURL:     thumbnailURL,
			OSSKey:           ossKey,
			ThumbnailOSSKey:  thumbOSSKey,
			FileSize:         fileHeader.Size,
			Width:            width,
			Height:           height,
			MimeType:         mimeType,
		}

		err = repository.CreatePhoto(ctx, photo)
		if err != nil {
			util.Log("Failed to save photo to DB: %v", err)
			failedCount++
			continue
		}

		uploadedPhotos = append(uploadedPhotos, gin.H{
			"id":           photo.ID,
			"originalName": photo.OriginalName,
			"thumbnailUrl": photo.ThumbnailURL,
			"originalUrl":  photo.OriginalURL,
			"fileSize":     photo.FileSize,
			"width":        photo.Width,
			"height":       photo.Height,
		})
	}

	// Update album photo count and cover
	if len(uploadedPhotos) > 0 {
		repository.IncrementAlbumPhotoCount(ctx, albumID, len(uploadedPhotos))

		// Set cover if not set
		if album.CoverURL == nil {
			coverURL := uploadedPhotos[0]["thumbnailUrl"].(string)
			repository.UpdateAlbumCover(ctx, albumID, coverURL)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": fmt.Sprintf("成功上传 %d 张照片", len(uploadedPhotos)),
		"photos":  uploadedPhotos,
		"failed":  failedCount,
	})
}

// DeletePhoto - DELETE /api/albums/:albumId/photos/:photoId
func DeletePhoto(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	albumIdStr := c.Param("albumId")
	albumID, err := strconv.Atoi(albumIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	photoIdStr := c.Param("photoId")
	photoID, err := strconv.Atoi(photoIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的照片ID"})
		return
	}

	ctx := context.Background()

	// Verify ownership
	photo, err := repository.FindPhotoByIDAndAlbum(ctx, photoID, albumID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "照片不存在"})
		return
	}

	if photo.UserID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "照片不存在"})
		return
	}

	// Delete from OSS
	ossService := service.GetOSSService()
	_ = ossService.DeletePhotos(ctx, []string{photo.OSSKey, photo.ThumbnailOSSKey})

	// Delete from DB
	err = repository.DeletePhoto(ctx, photoID, albumID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除照片失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "照片已删除"})
}

// GetPhotoOriginal - GET /api/albums/:albumId/photos/:photoId/original
func GetPhotoOriginal(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	albumIdStr := c.Param("albumId")
	albumID, err := strconv.Atoi(albumIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的影集ID"})
		return
	}

	photoIdStr := c.Param("photoId")
	photoID, err := strconv.Atoi(photoIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的照片ID"})
		return
	}

	ctx := context.Background()

	photo, err := repository.FindPhotoByIDAndAlbum(ctx, photoID, albumID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "照片不存在"})
		return
	}

	if photo.UserID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "照片不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"downloadUrl": photo.OriginalURL,
		"fileName":    photo.OriginalName,
	})
}
