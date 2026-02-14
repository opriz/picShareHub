package handler

import (
	"net/http"
	"picshare/config"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthCheck - GET /api/health
func HealthCheck(c *gin.Context) {
	cfg := config.Get()
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"env":       cfg.Server.Env,
	})
}
