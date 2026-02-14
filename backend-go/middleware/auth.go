package middleware

import (
	"net/http"
	"picshare/util"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthUser represents the authenticated user info
type AuthUser struct {
	ID    int
	Email string
	Role  string
	Name  string
}

// Authenticate validates JWT token and sets user context
func Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Verify token
		claims, err := util.VerifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "登录已过期，请重新登录"})
			c.Abort()
			return
		}

		// Set user context
		c.Set("userID", claims.ID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)
		c.Set("userName", claims.Name)
		c.Set("user", &AuthUser{
			ID:    claims.ID,
			Email: claims.Email,
			Role:  claims.Role,
			Name:  claims.Name,
		})

		c.Next()
	}
}

// RequireAdmin checks if user has admin role
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
			c.Abort()
			return
		}

		if userRole != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// OptionalAuth attempts to authenticate but doesn't fail if no token
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]

		claims, err := util.VerifyToken(tokenString)
		if err == nil {
			c.Set("userID", claims.ID)
			c.Set("userEmail", claims.Email)
			c.Set("userRole", claims.Role)
			c.Set("userName", claims.Name)
			c.Set("user", &AuthUser{
				ID:    claims.ID,
				Email: claims.Email,
				Role:  claims.Role,
				Name:  claims.Name,
			})
		}

		c.Next()
	}
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (int, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return 0, false
	}
	id, ok := userID.(int)
	return id, ok
}

// GetUserRole extracts user role from context
func GetUserRole(c *gin.Context) (string, bool) {
	userRole, exists := c.Get("userRole")
	if !exists {
		return "", false
	}
	role, ok := userRole.(string)
	return role, ok
}

// IsAdmin checks if current user is admin
func IsAdmin(c *gin.Context) bool {
	role, exists := c.Get("userRole")
	if !exists {
		return false
	}
	return role == "admin"
}

// GetAuthUser returns the full auth user struct
func GetAuthUser(c *gin.Context) (*AuthUser, bool) {
	user, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	authUser, ok := user.(*AuthUser)
	return authUser, ok
}
