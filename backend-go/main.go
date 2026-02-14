package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"picshare/config"
	"picshare/handler"
	"picshare/middleware"
	"picshare/repository"
	"picshare/service"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	// Load configuration
	_, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
}

func main() {
	cfg := config.Get()

	// Initialize database
	if err := repository.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer repository.CloseDB()

	// Initialize OSS
	if err := service.InitOSS(); err != nil {
		log.Printf("Warning: Failed to initialize OSS: %v", err)
	}

	// Initialize email
	service.InitEmail()

	// Initialize image service
	service.InitImage()

	// Initialize cleanup service
	service.InitCleanup()
	if cleanupService := service.GetCleanupService(); cleanupService != nil {
		defer cleanupService.Stop()
	}

	// Create Gin router
	router := gin.Default()

	// Trust proxy for correct IP detection
	router.SetTrustedProxies([]string{"0.0.0.0/0"})

	// Apply middleware
	router.Use(middleware.CORS())
	router.Use(rateLimitMiddleware())

	// API Routes
	api := router.Group("/api")
	{
		// Auth routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", handler.Register)
			auth.POST("/login", handler.Login)
			auth.GET("/verify-email", handler.VerifyEmail)
			auth.POST("/resend-verification", handler.ResendVerification)
			auth.POST("/forgot-password", handler.ForgotPassword)
			auth.POST("/reset-password", handler.ResetPassword)

			// Authenticated routes
			auth.GET("/profile", middleware.Authenticate(), handler.GetProfile)
			auth.PUT("/profile", middleware.Authenticate(), handler.UpdateProfile)
			auth.PUT("/change-password", middleware.Authenticate(), handler.ChangePassword)
		}

		// Album routes (all require authentication)
		albums := api.Group("/albums")
		albums.Use(middleware.Authenticate())
		{
			albums.POST("", handler.CreateAlbum)
			albums.GET("", handler.GetMyAlbums)
			albums.GET("/:id/qrcode", handler.GetAlbumQRCode)
			albums.GET("/:id", handler.GetAlbumDetail)
			albums.PUT("/:id", handler.UpdateAlbum)
			albums.DELETE("/:id", handler.DeleteAlbum)

			// Photo routes
			albums.POST("/:albumId/photos", middleware.UploadPhotosMiddleware(
				middleware.UploadPhotosConfig{
					MaxFileSize: 50 * 1024 * 1024, // 50MB
					MaxFiles:    20,
				},
			), handler.UploadPhotos)
			albums.DELETE("/:albumId/photos/:photoId", handler.DeletePhoto)
			albums.GET("/:albumId/photos/:photoId/original", handler.GetPhotoOriginal)
		}

		// Public routes (no authentication required)
		public := api.Group("/s")
		{
			public.GET("/:shareCode", handler.ViewAlbumByShareCode)
			public.GET("/:shareCode/photos/:photoId/download", handler.DownloadPhoto)
		}

		// Feedback routes
		api.POST("/feedback", middleware.OptionalAuth(), middleware.UploadFeedbackImagesMiddleware(
			middleware.UploadFeedbackImagesConfig{
				MaxFileSize: 10 * 1024 * 1024, // 10MB
				MaxFiles:    5,
			},
		), handler.SubmitFeedback)

		// Health check
		api.GET("/health", handler.HealthCheck)

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(middleware.Authenticate(), middleware.RequireAdmin())
		{
			admin.GET("/stats", handler.GetDashboardStats)
			admin.GET("/users", handler.GetAllUsers)
			admin.GET("/users/:userId/albums", handler.GetUserAlbums)
			admin.GET("/albums", handler.GetAllAlbums)
			admin.GET("/albums/:albumId/logs", handler.GetAlbumLogs)
		}
	}

	// Start server
	addr := fmt.Sprintf("0.0.0.0:%s", cfg.Server.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler:  router,
	}

	// Handle graceful shutdown
	go func() {
		log.Printf("Starting server on %s\n", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}

func rateLimitMiddleware() gin.HandlerFunc {
	// API rate limiter: 500 req/min
	apiLimiter := middleware.RateLimiter(500, 1*time.Minute)

	return func(c *gin.Context) {
		// Skip rate limiting for health check
		if c.Request.URL.Path == "/api/health" {
			c.Next()
			return
		}

		// Apply API rate limiter
		apiLimiter(c)
	}
}
