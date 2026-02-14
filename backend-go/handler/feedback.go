package handler

import (
	"context"
	"net/http"
	"picshare/middleware"
	"picshare/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SubmitFeedback - POST /api/feedback
func SubmitFeedback(c *gin.Context) {
	// Get content from form data (multipart)
	content := c.PostForm("content")
	contact := c.PostForm("contact")

	// Validate content
	if content == "" || len(content) < 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "反馈内容至少需要5个字符"})
		return
	}

	if len(content) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "反馈内容不能超过500个字符"})
		return
	}

	if contact != "" && len(contact) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "联系方式不能超过100个字符"})
		return
	}

	// Get user info if authenticated
	userName := ""
	if user, ok := middleware.GetAuthUser(c); ok {
		userName = user.Name
	}

	// Handle uploaded images
	var imageUrls []string
	form, _ := c.MultipartForm()
	if form != nil && form.File != nil {
		files := form.File["images"]
		if len(files) > 5 {
			files = files[:5]
		}

		ossService := service.GetOSSService()
		ctx := context.Background()

		for _, fileHeader := range files {
			file, err := fileHeader.Open()
			if err != nil {
				continue
			}

			fileID := uuid.New().String()
			imageURL, _, err := ossService.UploadFeedbackImage(ctx, fileID, file, fileHeader)
			file.Close()

			if err != nil {
				continue
			}

			imageUrls = append(imageUrls, imageURL)
		}
	}

	// Send feedback email
	emailService := service.GetEmailService()
	_ = emailService.SendFeedbackEmail("", userName, content, contact, imageUrls)

	c.JSON(http.StatusOK, gin.H{"message": "反馈已提交，感谢您的建议！"})
}
