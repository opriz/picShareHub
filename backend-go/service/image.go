package service

import (
	"bytes"
	"image"
	"image/jpeg"
	"mime/multipart"
	"picshare/config"

	// Import image decoders
	_ "image/gif"
	_ "image/png"

	"github.com/disintegration/imaging"
)

type ImageService struct {
	thumbnailWidth   int
	thumbnailQuality int
}

var imageService *ImageService

// InitImage initializes the image service
func InitImage() {
	cfg := config.Get()

	imageService = &ImageService{
		thumbnailWidth:   cfg.Upload.ThumbnailWidth,
		thumbnailQuality: cfg.Upload.ThumbnailQuality,
	}
}

// GetImageService returns the image service instance
func GetImageService() *ImageService {
	return imageService
}

// GenerateThumbnail generates a thumbnail from the original image
func (s *ImageService) GenerateThumbnail(file multipart.File) (image.Image, int, int, error) {
	// Decode image
	img, _, err := image.Decode(file)
	if err != nil {
		return nil, 0, 0, err
	}

	// Get original dimensions
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Generate thumbnail
	thumbnail := imaging.Resize(img, s.thumbnailWidth, 0, imaging.Lanczos)

	return thumbnail, width, height, nil
}

// GenerateThumbnailJPEG generates a JPEG thumbnail buffer
func (s *ImageService) GenerateThumbnailJPEG(file multipart.File) ([]byte, int, int, string, error) {
	// Decode image
	img, format, err := image.Decode(file)
	if err != nil {
		return nil, 0, 0, "", err
	}

	// Get original dimensions
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Generate thumbnail
	thumbnail := imaging.Resize(img, s.thumbnailWidth, 0, imaging.Lanczos)

	// Encode to JPEG
	var buf bytes.Buffer
	err = jpeg.Encode(&buf, thumbnail, &jpeg.Options{Quality: s.thumbnailQuality})
	if err != nil {
		return nil, 0, 0, "", err
	}

	return buf.Bytes(), width, height, format, nil
}

// GenerateThumbnailFromBuffer generates a thumbnail from image buffer
func (s *ImageService) GenerateThumbnailFromBuffer(data []byte, mimeType string) ([]byte, int, int, error) {
	// Decode image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, 0, 0, err
	}

	// Get original dimensions
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Generate thumbnail
	thumbnail := imaging.Resize(img, s.thumbnailWidth, 0, imaging.Lanczos)

	// Encode to JPEG
	var buf bytes.Buffer
	err = jpeg.Encode(&buf, thumbnail, &jpeg.Options{Quality: s.thumbnailQuality})
	if err != nil {
		return nil, 0, 0, err
	}

	return buf.Bytes(), width, height, nil
}

// GetImageDimensions returns the dimensions of an image
func (s *ImageService) GetImageDimensions(file multipart.File) (int, int, error) {
	_, err := file.Seek(0, 0)
	if err != nil {
		return 0, 0, err
	}

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, err
	}

	return config.Width, config.Height, nil
}

// CreateThumbnailBuffer creates a thumbnail from an image.Image
func (s *ImageService) CreateThumbnailBuffer(img image.Image) ([]byte, error) {
	// Resize
	thumbnail := imaging.Resize(img, s.thumbnailWidth, 0, imaging.Lanczos)

	// Encode to JPEG
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, thumbnail, &jpeg.Options{Quality: s.thumbnailQuality})
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
