package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/edoardo/ralph-orchestrator/internal/api"
	"github.com/edoardo/ralph-orchestrator/internal/config"
	"github.com/edoardo/ralph-orchestrator/internal/events"
	"github.com/edoardo/ralph-orchestrator/internal/ralph"
	"github.com/edoardo/ralph-orchestrator/internal/store"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	var level slog.Level
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))

	// Ensure ralph-claude-code is installed
	if err := ralph.EnsureInstalled(context.Background()); err != nil {
		logger.Error("ralph-claude-code not available", "error", err)
		logger.Info("please install ralph-claude-code manually: https://github.com/frankbria/ralph-claude-code")
		os.Exit(1)
	}
	logger.Info("ralph-claude-code available")

	// Initialize store
	storePath := filepath.Join(cfg.DataDir, "loops.json")
	st, err := store.New(storePath)
	if err != nil {
		logger.Error("failed to initialize store", "error", err)
		os.Exit(1)
	}

	// Initialize settings store
	settingsPath := filepath.Join(cfg.DataDir, "settings.json")
	settings, err := store.NewSettingsStore(settingsPath)
	if err != nil {
		logger.Error("failed to initialize settings store", "error", err)
		os.Exit(1)
	}
	// Seed GitHub token from env if not already persisted.
	if settings.GetGitHubToken() == "" {
		if envToken := os.Getenv("GITHUB_TOKEN"); envToken != "" {
			if err := settings.SetGitHubToken(envToken); err != nil {
				logger.Error("failed to seed GitHub token from env", "error", err)
			} else {
				logger.Info("seeded GitHub token from GITHUB_TOKEN env var")
			}
		}
	}

	// I5: Reconcile stale "running" loops on startup — log save errors at error level.
	for _, loop := range st.List() {
		if loop.Status == store.StatusRunning || loop.Status == store.StatusCloning {
			loop.Status = store.StatusStopped
			loop.PID = 0
			if err := st.Save(loop); err != nil {
				logger.Error("failed to reconcile loop on startup", "loop_id", loop.ID, "error", err)
			}
		}
	}

	bus := events.NewEventBus(logger)
	mgr := ralph.NewManager(logger)

	// B5: Server-scoped context — cancelled on shutdown to stop background goroutines.
	srvCtx, srvCancel := context.WithCancel(context.Background())
	defer srvCancel()

	srv := api.NewServer(srvCtx, cfg, st, settings, mgr, bus, logger)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	listenErr := make(chan error, 1)
	go func() {
		if err := srv.Listen(); err != nil {
			listenErr <- err
		}
	}()

	logger.Info("ralph orchestrator running", "port", cfg.Port)

	select {
	case <-quit:
		logger.Info("shutting down...")
	case err := <-listenErr:
		logger.Error("server failed to start", "error", err)
	}

	// B5: Cancel server context to abort in-progress clones.
	srvCancel()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	mgr.StopAll(shutdownCtx)
	// M9: Log shutdown errors instead of silently ignoring them.
	if err := srv.Shutdown(); err != nil {
		logger.Error("server shutdown error", "error", err)
	}
	logger.Info("shutdown complete")
}
