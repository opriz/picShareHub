package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration values
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	OSS      OSSConfig
	JWT      JWTConfig
	Email    EmailConfig
	Frontend FrontendConfig
	Admin    AdminConfig
	Upload   UploadConfig
}

type ServerConfig struct {
	Port string
	Env  string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
}

type OSSConfig struct {
	Region          string
	AccessKeyID     string
	AccessKeySecret string
	Bucket          string
	Endpoint        string
}

type JWTConfig struct {
	Secret string
}

type EmailConfig struct {
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPass     string
	FeedbackEmail string
}

type FrontendConfig struct {
	URL string
}

type AdminConfig struct {
	Email    string
	Password string
	Name     string
}

type UploadConfig struct {
	MaxFileSize      int64
	MaxFilesPerUpload int
	MaxPhotosPerAlbum int
	MaxAlbumsPerUser int
	ThumbnailWidth   int
	ThumbnailQuality int
}

var cfg *Config

// Load reads environment variables and returns configuration
func Load() (*Config, error) {
	// Try to load .env file (ignore error if file doesn't exist)
	_ = godotenv.Load()

	cfg = &Config{
		Server: ServerConfig{
			Port: getEnv("PORT", "3000"),
			Env:  getEnv("NODE_ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			Database: getEnv("DB_NAME", "picshare"),
		},
		OSS: OSSConfig{
			Region:          getEnv("OSS_REGION", "oss-cn-hangzhou"),
			AccessKeyID:     getEnv("OSS_ACCESS_KEY_ID", getEnv("ALIYUN_AK", "")),
			AccessKeySecret: getEnv("OSS_ACCESS_KEY_SECRET", getEnv("ALIYUN_SK", "")),
			Bucket:          getEnv("OSS_BUCKET", ""),
			Endpoint:        getEnv("OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "dev-secret"),
		},
		Email: EmailConfig{
			SMTPHost:     getEnv("SMTP_HOST", ""),
			SMTPPort:     getEnv("SMTP_PORT", "465"),
			SMTPUser:     getEnv("SMTP_USER", ""),
			SMTPPass:     getEnv("SMTP_PASS", ""),
			FeedbackEmail: getEnv("FEEDBACK_EMAIL", "zhujianxyz@163.com"),
		},
		Frontend: FrontendConfig{
			URL: getEnv("FRONTEND_URL", "http://localhost:5173"),
		},
		Admin: AdminConfig{
			Email:    getEnv("ADMIN_EMAIL", "admin@picshare.com.cn"),
			Password: getEnv("ADMIN_PASSWORD", "Admin123456!"),
			Name:     getEnv("ADMIN_NAME", "管理员"),
		},
		Upload: UploadConfig{
			MaxFileSize:       50 * 1024 * 1024, // 50MB
			MaxFilesPerUpload: 20,
			MaxPhotosPerAlbum: 50,
			MaxAlbumsPerUser:  10,
			ThumbnailWidth:    800,
			ThumbnailQuality:  75,
		},
	}

	// Validate required fields
	if cfg.Database.Password == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required")
	}

	return cfg, nil
}

// Get returns the loaded configuration
func Get() *Config {
	if cfg == nil {
		c, _ := Load()
		return c
	}
	return cfg
}

// IsProduction returns true if running in production mode
func IsProduction() bool {
	return Get().Server.Env == "production"
}

// getEnv retrieves an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt retrieves an environment variable as int or returns a default value
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
