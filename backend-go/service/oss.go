package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"picshare/config"
	"picshare/util"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

type OSSService struct {
	client     *oss.Client
	bucket     *oss.Bucket
	region     string
	bucketName string
}

var ossService *OSSService

// InitOSS initializes the OSS service
func InitOSS() error {
	cfg := config.Get()

	// Create OSSClient instance
	client, err := oss.New(cfg.OSS.Endpoint,
		cfg.OSS.AccessKeyID,
		cfg.OSS.AccessKeySecret)
	if err != nil {
		return fmt.Errorf("failed to create OSS client: %w", err)
	}

	// Get Bucket
	bucket, err := client.Bucket(cfg.OSS.Bucket)
	if err != nil {
		return fmt.Errorf("failed to get OSS bucket: %w", err)
	}

	ossService = &OSSService{
		client:     client,
		bucket:     bucket,
		region:     cfg.OSS.Region,
		bucketName: cfg.OSS.Bucket,
	}

	return nil
}

// GetOSSService returns the OSS service instance
func GetOSSService() *OSSService {
	return ossService
}

// UploadPhoto uploads both original and thumbnail to OSS
func (s *OSSService) UploadPhoto(ctx context.Context, userID, albumID int, fileID string,
	file multipart.File, header *multipart.FileHeader, thumbnailBuffer []byte,
	ext string, width, height int, fileSize int64) (originalURL, thumbnailURL, ossKey, thumbOSSKey string, err error) {

	// Read file content
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return "", "", "", "", fmt.Errorf("failed to read file: %w", err)
	}

	// Generate OSS keys
	ossKey = fmt.Sprintf("photos/%d/%d/%s.%s", userID, albumID, fileID, ext)
	thumbOSSKey = fmt.Sprintf("photos/%d/%d/thumb_%s.jpg", userID, albumID, fileID)

	// Upload original with metadata
	options := []oss.Option{
		oss.ContentType(header.Header.Get("Content-Type")),
		oss.CacheControl("max-age=31536000"),
		oss.ContentDisposition(fmt.Sprintf("attachment; filename=\"%s\"", url.PathEscape(header.Filename))),
	}

	// Upload original
	err = s.bucket.PutObject(ossKey, bytes.NewReader(fileContent), options...)
	if err != nil {
		return "", "", "", "", fmt.Errorf("failed to upload original: %w", err)
	}

	// Upload thumbnail
	thumbOptions := []oss.Option{
		oss.ContentType("image/jpeg"),
		oss.CacheControl("max-age=31536000"),
	}

	err = s.bucket.PutObject(thumbOSSKey, bytes.NewReader(thumbnailBuffer), thumbOptions...)
	if err != nil {
		// Try to cleanup original if thumbnail fails
		_ = s.bucket.DeleteObject(ossKey)
		return "", "", "", "", fmt.Errorf("failed to upload thumbnail: %w", err)
	}

	// Generate URLs
	originalURL = s.GenerateURL(ossKey)
	thumbnailURL = s.GenerateURL(thumbOSSKey)

	return originalURL, thumbnailURL, ossKey, thumbOSSKey, nil
}

// UploadAvatar uploads an avatar image
func (s *OSSService) UploadAvatar(ctx context.Context, userID int, fileID string,
	file multipart.File, header *multipart.FileHeader, ext string) (string, string, error) {

	// Read file content
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return "", "", fmt.Errorf("failed to read file: %w", err)
	}

	// Generate OSS key
	ossKey := fmt.Sprintf("avatars/%d/%s.%s", userID, fileID, ext)

	// Upload
	options := []oss.Option{
		oss.ContentType(header.Header.Get("Content-Type")),
		oss.CacheControl("max-age=31536000"),
	}

	err = s.bucket.PutObject(ossKey, bytes.NewReader(fileContent), options...)
	if err != nil {
		return "", "", fmt.Errorf("failed to upload avatar: %w", err)
	}

	// Generate URL
	avatarURL := s.GenerateURL(ossKey)
	return avatarURL, ossKey, nil
}

// UploadFeedbackImage uploads a feedback image
func (s *OSSService) UploadFeedbackImage(ctx context.Context, fileID string,
	file multipart.File, header *multipart.FileHeader) (string, string, error) {

	// Read file content
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return "", "", fmt.Errorf("failed to read file: %w", err)
	}

	// Generate OSS key
	ext := util.GetFileExtension(header.Filename)
	ossKey := fmt.Sprintf("feedback/%s.%s", fileID, ext)

	// Upload
	options := []oss.Option{
		oss.ContentType(header.Header.Get("Content-Type")),
		oss.CacheControl("max-age=31536000"),
	}

	err = s.bucket.PutObject(ossKey, bytes.NewReader(fileContent), options...)
	if err != nil {
		return "", "", fmt.Errorf("failed to upload feedback image: %w", err)
	}

	// Generate URL
	imageURL := s.GenerateURL(ossKey)
	return imageURL, ossKey, nil
}

// DeletePhotos deletes multiple files from OSS
func (s *OSSService) DeletePhotos(ctx context.Context, ossKeys []string) error {
	if len(ossKeys) == 0 {
		return nil
	}

	// OSS allows max 1000 keys per delete request
	const batchSize = 1000
	for i := 0; i < len(ossKeys); i += batchSize {
		end := i + batchSize
		if end > len(ossKeys) {
			end = len(ossKeys)
		}

		batch := ossKeys[i:end]
		_, err := s.bucket.DeleteObjects(batch)
		if err != nil {
			return fmt.Errorf("failed to delete objects: %w", err)
		}
	}

	return nil
}

// DeleteSingle deletes a single file from OSS
func (s *OSSService) DeleteSingle(ctx context.Context, ossKey string) error {
	return s.bucket.DeleteObject(ossKey)
}

// GenerateURL generates the full URL for an OSS object
func (s *OSSService) GenerateURL(ossKey string) string {
	return fmt.Sprintf("https://%s.%s/%s", s.bucketName, s.region + ".aliyuncs.com", ossKey)
}

// GeneratePresignedURL generates a presigned URL for download
func (s *OSSService) GeneratePresignedURL(ctx context.Context, ossKey string, expiry time.Duration) (string, error) {
	return s.bucket.SignURL(ossKey, oss.HTTPGet, int64(expiry.Seconds()))
}

// FileExists checks if a file exists in OSS
func (s *OSSService) FileExists(ctx context.Context, ossKey string) (bool, error) {
	_, err := s.bucket.GetObjectMeta(ossKey)
	if err != nil {
		if ossErr, ok := err.(oss.ServiceError); ok && ossErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// UploadBytes uploads raw bytes to OSS
func (s *OSSService) UploadBytes(ctx context.Context, ossKey string, data []byte, contentType string) (string, error) {
	options := []oss.Option{
		oss.ContentType(contentType),
	}

	err := s.bucket.PutObject(ossKey, bytes.NewReader(data), options...)
	if err != nil {
		return "", fmt.Errorf("failed to upload: %w", err)
	}

	return s.GenerateURL(ossKey), nil
}

// DownloadFile downloads a file from OSS to local temp path
func (s *OSSService) DownloadFile(ctx context.Context, ossKey, localPath string) error {
	// Ensure directory exists
	dir := path.Dir(localPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Download file
	err := s.bucket.GetObjectToFile(ossKey, localPath)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}
