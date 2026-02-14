package util

import (
	"fmt"
	"log"
)

// Log logs a message with timestamp
func Log(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[PicShare] %s", msg)
}

// LogError logs an error
func LogError(err error) {
	if err != nil {
		log.Printf("[PicShare] ERROR: %v", err)
	}
}
