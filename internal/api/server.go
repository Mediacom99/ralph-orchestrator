package api

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/edoardo/ralph-orchestrator/internal/api/handlers"
	"github.com/edoardo/ralph-orchestrator/internal/config"
	"github.com/edoardo/ralph-orchestrator/internal/events"
	"github.com/edoardo/ralph-orchestrator/internal/ralph"
	"github.com/edoardo/ralph-orchestrator/internal/store"
)

type Server struct {
	app    *fiber.App
	config *config.Config
	logger *slog.Logger
}

func NewServer(ctx context.Context, cfg *config.Config, st *store.Store, mgr *ralph.Manager, bus *events.EventBus, logger *slog.Logger) *Server {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		AppName:               "ralph-orchestrator",
	})

	app.Use(recover.New())
	// Security headers
	app.Use(func(c *fiber.Ctx) error {
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:")
		return c.Next()
	})
	// I6: Restrict CORS to configured origins (default: localhost).
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: "GET,POST,DELETE,OPTIONS",
		AllowHeaders: "Content-Type",
	}))

	s := &Server{app: app, config: cfg, logger: logger}

	// B5: Pass server-scoped context so background goroutines can be cancelled on shutdown.
	h := handlers.NewLoopHandler(ctx, st, mgr, bus, cfg, logger)

	api := app.Group("/api")
	api.Get("/health", handlers.Health)
	api.Get("/loops", h.List)
	api.Post("/loops", h.Create)
	api.Get("/loops/:id", h.Get)
	api.Post("/loops/:id/start", h.Start)
	api.Post("/loops/:id/stop", h.Stop)
	api.Delete("/loops/:id", h.Delete)
	api.Get("/loops/:id/logs", h.Logs)

	handlers.SetupWebSocket(app, bus, logger)

	s.setupSPA()

	return s
}

func (s *Server) Listen() error {
	addr := fmt.Sprintf(":%s", s.config.Port)
	s.logger.Info("starting server", "addr", addr)
	return s.app.Listen(addr)
}

func (s *Server) Shutdown() error {
	return s.app.Shutdown()
}
