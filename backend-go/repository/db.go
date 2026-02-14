package repository

import (
	"context"
	"fmt"
	"picshare/config"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

// InitDB initializes the database connection pool
func InitDB() error {
	cfg := config.Get()

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Database,
	)

	var err error
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err = pgxpool.New(ctx, connStr)
	if err != nil {
		return fmt.Errorf("unable to connect to database: %w", err)
	}

	// Test connection
	if err := db.Ping(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}

// GetDB returns the database connection pool
func GetDB() *pgxpool.Pool {
	return db
}

// CloseDB closes the database connection pool
func CloseDB() {
	if db != nil {
		db.Close()
	}
}
