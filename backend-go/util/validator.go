package util

import (
	"errors"
	"mime/multipart"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

var (
	// Email validation regex
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

	// Allowed image MIME types
	allowedImageTypes = map[string]bool{
		"image/jpeg":      true,
		"image/jpg":       true,
		"image/png":       true,
		"image/gif":       true,
		"image/webp":      true,
		"image/heic":      true,
		"image/heif":      true,
	}

	// Allowed file extensions
	allowedExtensions = map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
		".heic": true,
		".heif": true,
	}
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

// ValidationErrors represents multiple validation errors
type ValidationErrors []ValidationError

func (ve ValidationErrors) Error() string {
	if len(ve) == 0 {
		return "validation failed"
	}
	msgs := make([]string, len(ve))
	for i, e := range ve {
		msgs[i] = e.Message
	}
	return strings.Join(msgs, ", ")
}

// Validator provides validation functions
type Validator struct {
	errors ValidationErrors
}

// NewValidator creates a new validator
func NewValidator() *Validator {
	return &Validator{errors: make(ValidationErrors, 0)}
}

// Required checks if a string field is not empty
func (v *Validator) Required(field, value string) *Validator {
	if strings.TrimSpace(value) == "" {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: field + "不能为空",
		})
	}
	return v
}

// MinLength checks minimum length
func (v *Validator) MinLength(field string, value string, min int) *Validator {
	if len(value) < min {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: field + "至少需要" + strconv.Itoa(min) + "个字符",
		})
	}
	return v
}

// MaxLength checks maximum length
func (v *Validator) MaxLength(field string, value string, max int) *Validator {
	if len(value) > max {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: field + "最多" + strconv.Itoa(max) + "个字符",
		})
	}
	return v
}

// Email validates email format
func (v *Validator) Email(field, value string) *Validator {
	if value != "" && !emailRegex.MatchString(value) {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: "邮箱格式不正确",
		})
	}
	return v
}

// Password validates password strength
func (v *Validator) Password(field, value string) *Validator {
	if !ValidatePassword(value) {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: "密码至少6位，且必须包含字母和数字",
		})
	}
	return v
}

// Range checks if a numeric value is within range
func (v *Validator) Range(field string, value int, min, max int) *Validator {
	if value < min || value > max {
		v.errors = append(v.errors, ValidationError{
			Field:   field,
			Message: field + "必须在" + strconv.Itoa(min) + "到" + strconv.Itoa(max) + "之间",
		})
	}
	return v
}

// HasErrors returns true if there are validation errors
func (v *Validator) HasErrors() bool {
	return len(v.errors) > 0
}

// Error returns the validation errors
func (v *Validator) Error() error {
	if len(v.errors) == 0 {
		return nil
	}
	return v.errors
}

// ValidateImageFile checks if a file is a valid image
func ValidateImageFile(header *multipart.FileHeader) error {
	if header == nil {
		return errors.New("文件为空")
	}

	// Check MIME type
	mimeType := header.Header.Get("Content-Type")
	if !allowedImageTypes[mimeType] {
		return errors.New("不支持的文件格式，请上传 JPG、PNG、GIF 或 WebP 图片")
	}

	// Check file extension (convert to lowercase)
	ext := strings.ToLower(getFileExtension(header.Filename))
	if !allowedExtensions[ext] {
		return errors.New("不支持的文件格式，请上传 JPG、PNG、GIF 或 WebP 图片")
	}

	return nil
}

// getFileExtension returns the lowercase file extension with dot
func getFileExtension(filename string) string {
	if i := strings.LastIndex(filename, "."); i > 0 {
		return "." + strings.ToLower(filename[i+1:])
	}
	return ""
}

// ExtractContentType extracts MIME type from file header
func ExtractContentType(header *multipart.FileHeader) string {
	return header.Header.Get("Content-Type")
}

// IsImageFile checks if a content type is an image
func IsImageFile(contentType string) bool {
	return strings.HasPrefix(contentType, "image/")
}

// GetFileExtension returns the file extension
func GetFileExtension(filename string) string {
	if i := strings.LastIndex(filename, "."); i > 0 {
		return filename[i+1:]
	}
	return ""
}

// ParseInt parses an integer from string with default value
func ParseInt(s string, defaultValue int) int {
	if s == "" {
		return defaultValue
	}
	if val, err := strconv.Atoi(s); err == nil {
		return val
	}
	return defaultValue
}

// ParsePagination parses pagination parameters
func ParsePagination(pageStr, limitStr string) (page, limit int) {
	page = ParseInt(pageStr, 1)
	limit = ParseInt(limitStr, 20)

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	return page, limit
}

// GetClientIP extracts the client IP from request
func GetClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for requests through proxy/load balancer)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP if multiple
		if i := strings.Index(xff, ","); i != -1 {
			return strings.TrimSpace(xff[:i])
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	if ip := r.RemoteAddr; ip != "" {
		if i := strings.LastIndex(ip, ":"); i != -1 {
			return ip[:i]
		}
		return ip
	}

	return ""
}

// GetUserAgent extracts the user agent from request
func GetUserAgent(r *http.Request) string {
	return r.Header.Get("User-Agent")
}
