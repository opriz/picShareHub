package service

import (
	"context"
	"fmt"
	"picshare/repository"

	"github.com/robfig/cron/v3"
)

type CleanupService struct {
	cron *cron.Cron
}

var cleanupService *CleanupService

// InitCleanup initializes the cleanup service with cron jobs
func InitCleanup() {
	cleanupService = &CleanupService{
		cron: cron.New(),
	}

	// Schedule cleanup job - run every hour at minute 0
	_, err := cleanupService.cron.AddFunc("0 * * * *", func() {
		runCleanup()
	})
	if err != nil {
		fmt.Printf("[Cron] Failed to schedule cleanup job: %v\n", err)
	}

	// Start cron
	cleanupService.cron.Start()
	fmt.Println("[Cron] Cleanup service started, running every hour")
}

// GetCleanupService returns the cleanup service instance
func GetCleanupService() *CleanupService {
	return cleanupService
}

// Stop stops the cleanup service
func (s *CleanupService) Stop() {
	if s.cron != nil {
		s.cron.Stop()
		fmt.Println("[Cron] Cleanup service stopped")
	}
}

// runCleanup runs the cleanup process
func runCleanup() {
	fmt.Println("[Cron] Running expired albums cleanup...")

	ctx := context.Background()

	// Mark newly expired albums
	count, err := repository.MarkAlbumsExpired(ctx)
	if err != nil {
		fmt.Printf("[Cron] Failed to mark expired albums: %v\n", err)
	} else {
		fmt.Printf("[Cron] Marked %d albums as expired\n", count)
	}

	// Get albums expired for more than 1 day
	albums, err := repository.GetExpiredAlbumsForDeletion(ctx)
	if err != nil {
		fmt.Printf("[Cron] Failed to get expired albums: %v\n", err)
		return
	}

	if len(albums) == 0 {
		fmt.Println("[Cron] No albums to delete")
		return
	}

	fmt.Printf("[Cron] Found %d albums to delete\n", len(albums))

	// Delete each album with its OSS files
	deletedCount := 0
	filesDeleted := 0

	for _, album := range albums {
		// Get all photo OSS keys
		keys, err := repository.GetPhotoOSSKeys(ctx, album.ID)
		if err != nil {
			fmt.Printf("[Cron] Failed to get OSS keys for album %d: %v\n", album.ID, err)
			continue
		}

		// Delete OSS files
		if len(keys) > 0 {
			ossService := GetOSSService()
			if ossService != nil {
				if err := ossService.DeletePhotos(ctx, keys); err != nil {
					fmt.Printf("[Cron] Failed to delete OSS files for album %d: %v\n", album.ID, err)
					continue
				}
				filesDeleted += len(keys)
			}
		}

		// Delete album from database (cascades to photos and logs)
		if err := repository.DeleteAlbumByID(ctx, album.ID); err != nil {
			fmt.Printf("[Cron] Failed to delete album %d from database: %v\n", album.ID, err)
			continue
		}

		deletedCount++
	}

	fmt.Printf("[Cron] Cleanup completed: %d albums deleted, %d files removed from OSS\n",
		deletedCount, filesDeleted)
}

// RunCleanupNow triggers an immediate cleanup (for testing)
func RunCleanupNow() {
	runCleanup()
}
