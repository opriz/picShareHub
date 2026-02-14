package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	gin_middleware "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

// RateLimiter creates a rate limiter middleware
func RateLimiter(rate int, window time.Duration) gin.HandlerFunc {
	// Create a rate instance
	rateInstance := limiter.Rate{
		Period: window,
		Limit:  int64(rate),
	}

	// Create a memory store
	store := memory.NewStore()

	// Create limiter
	limiterInstance := limiter.New(store, rateInstance)

	// Create middleware
	return gin_middleware.NewMiddleware(limiterInstance,
		gin_middleware.WithKeyGetter(func(c *gin.Context) string {
			key := c.ClientIP()

			// For authenticated users, include user ID to avoid affecting other users on same IP
			if userID, exists := c.Get("userID"); exists {
				if id, ok := userID.(int); ok {
					key = key + "-user-" + strconv.Itoa(id)
				}
			}

			return key
		}),
		gin_middleware.WithErrorHandler(func(c *gin.Context, err error) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "限流器错误"})
			c.Abort()
		}),
		gin_middleware.WithLimitReachedHandler(func(c *gin.Context) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
			c.Abort()
		}),
	)
}

// AuthRateLimiter creates a stricter rate limiter for auth endpoints
// Uses email in request body as part of key to avoid affecting different users on same IP
func AuthRateLimiter(rate int, window time.Duration) gin.HandlerFunc {
	rateInstance := limiter.Rate{
		Period: window,
		Limit:  int64(rate),
	}

	store := memory.NewStore()

	limiterInstance := limiter.New(store, rateInstance)

	return gin_middleware.NewMiddleware(limiterInstance,
		gin_middleware.WithKeyGetter(func(c *gin.Context) string {
			key := c.ClientIP()

			// Try to extract email from request body
			if c.Request.Method == "POST" {
				type authRequest struct {
					Email string `json:"email"`
				}
				var req authRequest
				if err := c.ShouldBindJSON(&req); err == nil && req.Email != "" {
					key = key + "-" + req.Email
				}
			}

			return key
		}),
		gin_middleware.WithErrorHandler(func(c *gin.Context, err error) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "限流器错误"})
			c.Abort()
		}),
		gin_middleware.WithLimitReachedHandler(func(c *gin.Context) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "登录尝试次数过多，请稍后再试"})
			c.Abort()
		}),
	)
}
