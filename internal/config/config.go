package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	DataDir         string
	LogLevel        string
	DevMode         bool
	AllowedOrigins  string
	CloneTimeout    time.Duration
	ShutdownTimeout time.Duration
}

func Load() *Config {
	return &Config{
		Port:            envOr("PORT", "8080"),
		DataDir:         envOr("DATA_DIR", "data"),
		LogLevel:        envOr("LOG_LEVEL", "info"),
		DevMode:         os.Getenv("DEV_MODE") == "true",
		AllowedOrigins:  envOr("ALLOWED_ORIGINS", "http://localhost:5173, http://localhost:8080"),
		CloneTimeout:    durationOr("CLONE_TIMEOUT", 5*time.Minute),
		ShutdownTimeout: durationOr("SHUTDOWN_TIMEOUT", 30*time.Second),
	}
}

func (c *Config) Validate() error {
	if c.DataDir == "" {
		return fmt.Errorf("DATA_DIR must not be empty")
	}
	port, err := strconv.Atoi(c.Port)
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("PORT must be between 1 and 65535, got %q", c.Port)
	}
	if c.CloneTimeout <= 0 {
		return fmt.Errorf("CLONE_TIMEOUT must be positive")
	}
	if c.ShutdownTimeout <= 0 {
		return fmt.Errorf("SHUTDOWN_TIMEOUT must be positive")
	}
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func durationOr(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			slog.Warn("invalid duration for env var, using default", "key", key, "value", v, "default", fallback, "error", err)
		} else {
			return d
		}
	}
	return fallback
}
