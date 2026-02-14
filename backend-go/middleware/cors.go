package middleware

import (
	"net/http"
	"picshare/config"

	"github.com/gin-gonic/gin"
)

// Configured CORS origins
var allowedOrigins = []string{
	"http://localhost:5173",
	"http://localhost:3000",
	"http://www.picshare.com.cn",
	"http://picshare.com.cn",
	"https://www.picshare.com.cn",
	"https://picshare.com.cn",
}

// CORS middleware
func CORS() gin.HandlerFunc {
	cfg := config.Get()

	// Add configured frontend URL to allowed origins
	if cfg.Frontend.URL != "" {
		allowedOrigins = append(allowedOrigins, cfg.Frontend.URL)
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}

// TrustProxy middleware - Gin's trusted CIDR
func TrustProxy() gin.HandlerFunc {
	// Set trusted proxies - trust all
	return func(c *gin.Context) {
		c.Set("Trusted-Proxies", []string{"0.0.0.0/0"})
		c.Next()
	}
}
