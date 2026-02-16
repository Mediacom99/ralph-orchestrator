package api

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"

	orchestrator "github.com/edoardo/ralph-orchestrator"
)

func (s *Server) setupSPA() {
	if s.config.DevMode {
		s.logger.Info("dev mode enabled, skipping embedded SPA")
		return
	}

	distFS, err := fs.Sub(orchestrator.EmbeddedWebDist, "web/dist")
	if err != nil {
		s.logger.Warn("embedded web/dist not found, SPA disabled", "error", err)
		return
	}

	if _, err := fs.Stat(distFS, "index.html"); err != nil {
		s.logger.Warn("index.html not found in embedded FS, SPA disabled")
		return
	}

	s.app.Use("/assets", filesystem.New(filesystem.Config{
		Root:       http.FS(distFS),
		PathPrefix: "assets",
		MaxAge:     60 * 60 * 24 * 30,
	}))

	// B1: Create the filesystem middleware once instead of per-request.
	staticHandler := filesystem.New(filesystem.Config{
		Root: http.FS(distFS),
	})

	indexHTML, err2 := fs.ReadFile(distFS, "index.html")
	if err2 != nil {
		s.logger.Warn("failed to read embedded index.html", "error", err2)
	}

	s.app.Use(func(c *fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") {
			return c.Next()
		}

		f, err := distFS.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			f.Close()
			return staticHandler(c)
		}

		if indexHTML == nil {
			return c.Next()
		}
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(indexHTML)
	})
}
