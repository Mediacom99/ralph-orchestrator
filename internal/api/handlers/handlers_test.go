package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/edoardo/ralph-orchestrator/internal/config"
	"github.com/edoardo/ralph-orchestrator/internal/events"
	"github.com/edoardo/ralph-orchestrator/internal/ralph"
	"github.com/edoardo/ralph-orchestrator/internal/store"
)

func setupTestApp(t *testing.T) (*fiber.App, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	st, err := store.New(filepath.Join(dir, "loops.json"))
	if err != nil {
		t.Fatal(err)
	}
	settings, err := store.NewSettingsStore(filepath.Join(dir, "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	bus := events.NewEventBus(logger)
	mgr := ralph.NewManager(logger)
	cfg := &config.Config{DataDir: dir}
	ctx := t.Context()

	app := fiber.New()
	h := NewLoopHandler(ctx, st, settings, mgr, bus, cfg, logger)
	api := app.Group("/api")
	api.Get("/health", Health)
	api.Get("/loops", h.List)
	api.Post("/loops", h.Create)
	api.Get("/loops/:id", h.Get)
	api.Post("/loops/:id/start", h.Start)
	api.Post("/loops/:id/stop", h.Stop)
	api.Delete("/loops/:id", h.Delete)
	api.Get("/loops/:id/logs", h.Logs)
	return app, st
}

func TestHealth(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("GET", "/api/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestListEmpty(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("GET", "/api/loops", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	var loops []json.RawMessage
	json.NewDecoder(resp.Body).Decode(&loops)
	if len(loops) != 0 {
		t.Errorf("expected empty list, got %d items", len(loops))
	}
}

func TestListWithData(t *testing.T) {
	app, st := setupTestApp(t)
	st.Save(&store.Loop{ID: "test1", Status: store.StatusStopped})
	st.Save(&store.Loop{ID: "test2", Status: store.StatusStopped})

	req, _ := http.NewRequest("GET", "/api/loops", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	var loops []json.RawMessage
	json.NewDecoder(resp.Body).Decode(&loops)
	if len(loops) != 2 {
		t.Errorf("expected 2 loops, got %d", len(loops))
	}
}

func TestCreateBadJSON(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("POST", "/api/loops", bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestCreateBadURL(t *testing.T) {
	app, _ := setupTestApp(t)
	body, _ := json.Marshal(map[string]string{"git_url": "ftp://bad.com/repo"})
	req, _ := http.NewRequest("POST", "/api/loops", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestGet404(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("GET", "/api/loops/nonexistent", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestDelete404(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("DELETE", "/api/loops/nonexistent", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestLogs404(t *testing.T) {
	app, _ := setupTestApp(t)
	req, _ := http.NewRequest("GET", "/api/loops/nonexistent/logs", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}
