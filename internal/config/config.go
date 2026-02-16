package config

import (
	"log/slog"
	"os"
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
