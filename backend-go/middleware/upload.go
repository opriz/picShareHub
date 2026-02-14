package middleware

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Allowed image MIME types
var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/heic": true,
	"image/heif": true,
}

// UploadPhotosConfig for photo upload middleware
type UploadPhotosConfig struct {
	MaxFileSize int64
	MaxFiles    int
}

// UploadPhotosMiddleware creates a multipart form handler for photos
func UploadPhotosMiddleware(config UploadPhotosConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse multipart form with limits
		if err := c.Request.ParseMultipartForm(config.MaxFileSize); err != nil {
			if err.Error() == "http: request body too large" {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("文件过大，单个文件最大%dMB", config.MaxFileSize/(1024*1024))})
				c.Abort()
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "文件解析失败"})
			c.Abort()
			return
		}

		form := c.Request.MultipartForm

		// Check file count
		if form.File == nil || len(form.File["photos"]) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请选择照片上传"})
			c.Abort()
			return
		}

		files := form.File["photos"]
		if len(files) > config.MaxFiles {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("单次最多上传%d张照片", config.MaxFiles)})
			c.Abort()
			return
		}

		// Validate each file
		for _, fileHeader := range files {
			// Check MIME type
			mimeType := fileHeader.Header.Get("Content-Type")
			if !allowedImageTypes[mimeType] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的文件格式，请上传 JPG、PNG、GIF 或 WebP 图片"})
				c.Abort()
				return
			}

			// Check file size
			if fileHeader.Size > config.MaxFileSize {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("文件过大，单个文件最大%dMB", config.MaxFileSize/(1024*1024))})
				c.Abort()
				return
			}
		}

		// Store files in context for handlers to use
		c.Set("uploadedFiles", files)
		c.Next()
	}
}

// GetUploadedFiles retrieves uploaded files from context
func GetUploadedFiles(c *gin.Context) []*multipart.FileHeader {
	files, _ := c.Get("uploadedFiles")
	if files == nil {
		return nil
	}
	return files.([]*multipart.FileHeader)
}

// UploadFeedbackImagesConfig for feedback image upload
type UploadFeedbackImagesConfig struct {
	MaxFileSize int64
	MaxFiles    int
}

// UploadFeedbackImagesMiddleware creates a multipart form handler for feedback images
func UploadFeedbackImagesMiddleware(config UploadFeedbackImagesConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := c.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB max
			c.JSON(http.StatusBadRequest, gin.H{"error": "文件解析失败"})
			c.Abort()
			return
		}

		form := c.Request.MultipartForm

		// Images are optional
		if form.File == nil || len(form.File["images"]) == 0 {
			c.Next()
			return
		}

		files := form.File["images"]
		if len(files) > config.MaxFiles {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("最多上传%d张图片", config.MaxFiles)})
			c.Abort()
			return
		}

		// Validate each file
		for _, fileHeader := range files {
			mimeType := fileHeader.Header.Get("Content-Type")
			if !strings.HasPrefix(mimeType, "image/") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "只允许上传图片文件"})
				c.Abort()
				return
			}

			if fileHeader.Size > config.MaxFileSize {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("图片过大，最大%dMB", config.MaxFileSize/(1024*1024))})
				c.Abort()
				return
			}
		}

		c.Set("uploadedImages", files)
		c.Next()
	}
}

// GetUploadedImages retrieves uploaded images from context
func GetUploadedImages(c *gin.Context) []*multipart.FileHeader {
	images, _ := c.Get("uploadedImages")
	if images == nil {
		return nil
	}
	return images.([]*multipart.FileHeader)
}
