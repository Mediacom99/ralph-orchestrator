package handlers

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/edoardo/ralph-orchestrator/internal/config"
	"github.com/edoardo/ralph-orchestrator/internal/events"
	gitpkg "github.com/edoardo/ralph-orchestrator/internal/git"
	"github.com/edoardo/ralph-orchestrator/internal/ralph"
	"github.com/edoardo/ralph-orchestrator/internal/store"
)

type LoopHandler struct {
	store    *store.Store
	settings *store.SettingsStore
	mgr      *ralph.Manager
	bus      *events.EventBus
	config   *config.Config
	logger   *slog.Logger
	ctx      context.Context // B5: server-scoped context for cancellation on shutdown
}

func NewLoopHandler(ctx context.Context, st *store.Store, settings *store.SettingsStore, mgr *ralph.Manager, bus *events.EventBus, cfg *config.Config, logger *slog.Logger) *LoopHandler {
	return &LoopHandler{store: st, settings: settings, mgr: mgr, bus: bus, config: cfg, logger: logger, ctx: ctx}
}

type createRequest struct {
	GitURL    string `json:"git_url"`
	AutoStart bool   `json:"auto_start"`
}

func (h *LoopHandler) List(c *fiber.Ctx) error {
	loops := h.store.List()
	for _, l := range loops {
		ralph.EnrichLoop(l)
		if h.mgr.IsRunning(l.ID) {
			l.Status = store.StatusRunning
			if r := h.mgr.GetRunner(l.ID); r != nil {
				l.PID = r.PID()
			}
		}
	}
	return c.JSON(loops)
}

func (h *LoopHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	loop, ok := h.store.Get(id)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "loop not found"})
	}
	ralph.EnrichLoop(loop)
	if h.mgr.IsRunning(id) {
		loop.Status = store.StatusRunning
		if r := h.mgr.GetRunner(id); r != nil {
			loop.PID = r.PID()
		}
	}
	return c.JSON(loop)
}

func (h *LoopHandler) Create(c *fiber.Ctx) error {
	var req createRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := gitpkg.ValidateURL(req.GitURL); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	id := uuid.New().String()[:12] // I7: 12 chars (48 bits) instead of 8
	repoName := gitpkg.RepoName(req.GitURL)
	localPath := filepath.Join(h.config.DataDir, "repos", repoName+"-"+id)

	loop := &store.Loop{
		ID:        id,
		GitURL:    req.GitURL,
		RepoName:  repoName,
		LocalPath: localPath,
		Status:    store.StatusCloning,
		CreatedAt: time.Now(),
	}
	if err := h.store.Save(loop); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save loop"})
	}

	h.bus.Publish(events.Event{Type: "loop_created", LoopID: id})

	// Clone in background
	go h.cloneAndStart(loop, req.AutoStart)

	return c.Status(201).JSON(loop)
}

func (h *LoopHandler) cloneAndStart(loop *store.Loop, autoStart bool) {
	// B5: Use the server-scoped context so shutdown cancels in-progress clones.
	ctx, cancel := context.WithTimeout(h.ctx, h.config.CloneTimeout)
	defer cancel()

	loopID := loop.ID
	githubToken := h.settings.GetGitHubToken()
	h.logger.Info("cloning repo", "loop_id", loopID, "url", loop.GitURL, "has_token", githubToken != "")

	if err := gitpkg.Clone(ctx, loop.GitURL, loop.LocalPath, githubToken); err != nil {
		h.logger.Error("clone failed", "loop_id", loopID, "error", err)
		if err := h.store.Update(loopID, func(l *store.Loop) { l.Status = store.StatusError }); err != nil {
			h.logger.Warn("loop gone during clone error update", "loop_id", loopID)
			return
		}
		h.bus.Publish(events.Event{Type: "clone_failed", LoopID: loopID, Data: err.Error()})
		return
	}

	if !ralph.IsRepoEnabled(loop.LocalPath) {
		h.logger.Warn("repo not ralph-enabled", "loop_id", loopID)
		if err := h.store.Update(loopID, func(l *store.Loop) { l.Status = store.StatusError }); err != nil {
			h.logger.Warn("loop gone during clone error update", "loop_id", loopID)
			return
		}
		h.bus.Publish(events.Event{Type: "clone_failed", LoopID: loopID, Data: "repo has no .ralph/ or .ralphrc — not ralph-enabled"})
		return
	}

	if err := h.store.Update(loopID, func(l *store.Loop) { l.Status = store.StatusStopped }); err != nil {
		h.logger.Warn("loop gone after successful clone", "loop_id", loopID)
		return
	}
	h.bus.Publish(events.Event{Type: "clone_complete", LoopID: loopID})

	if autoStart {
		// Re-read the loop from store to get fresh state.
		fresh, ok := h.store.Get(loopID)
		if !ok {
			return
		}
		h.startLoop(fresh)
	}
}

func (h *LoopHandler) Start(c *fiber.Ctx) error {
	id := c.Params("id")
	loop, ok := h.store.Get(id)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "loop not found"})
	}
	if h.mgr.IsRunning(id) {
		return c.Status(409).JSON(fiber.Map{"error": "already running"})
	}
	if loop.Status == store.StatusCloning {
		return c.Status(409).JSON(fiber.Map{"error": "still cloning"})
	}

	h.startLoop(loop)
	return c.JSON(fiber.Map{"status": "started"})
}

func (h *LoopHandler) startLoop(loop *store.Loop) {
	// Build env overrides: settings-stored API key takes precedence over process env.
	var envOverrides map[string]string
	if key := h.settings.GetAnthropicAPIKey(); key != "" {
		envOverrides = map[string]string{"ANTHROPIC_API_KEY": key}
	}
	runner, err := h.mgr.Start(context.Background(), loop.ID, loop.LocalPath, envOverrides)
	if err != nil {
		// If the manager says "already running" and it IS running, treat as benign race.
		if h.mgr.IsRunning(loop.ID) {
			h.logger.Info("concurrent start race resolved, loop already running", "loop_id", loop.ID)
			return
		}
		h.logger.Error("failed to start ralph", "loop_id", loop.ID, "error", err)
		_ = h.store.Update(loop.ID, func(l *store.Loop) { l.Status = store.StatusFailed })
		return
	}

	pid := runner.PID()
	err = h.store.Update(loop.ID, func(l *store.Loop) {
		now := time.Now()
		l.Status = store.StatusRunning
		l.StartedAt = &now
		l.PID = pid
	})
	if err != nil {
		h.logger.Error("failed to update loop state", "loop_id", loop.ID, "error", err)
	}
	h.bus.Publish(events.Event{Type: "loop_started", LoopID: loop.ID})

	// Watch for exit — use Store.Update for atomic read-modify-write to avoid lost updates.
	loopID := loop.ID
	go func() {
		<-runner.Done()
		err := h.store.Update(loopID, func(l *store.Loop) {
			now := time.Now()
			l.StoppedAt = &now
			l.PID = 0
			if runner.ExitErr() != nil {
				l.Status = store.StatusFailed
			} else {
				l.Status = store.StatusComplete
			}
		})
		if err != nil {
			// Loop was deleted concurrently — that's expected, not an error.
			return
		}
		h.bus.Publish(events.Event{Type: "loop_stopped", LoopID: loopID})
	}()
}

func (h *LoopHandler) Stop(c *fiber.Ctx) error {
	id := c.Params("id")
	if _, ok := h.store.Get(id); !ok {
		return c.Status(404).JSON(fiber.Map{"error": "loop not found"})
	}
	if !h.mgr.IsRunning(id) {
		return c.Status(409).JSON(fiber.Map{"error": "not running"})
	}
	if err := h.mgr.Stop(id); err != nil {
		h.logger.Error("failed to stop loop", "loop_id", id, "error", err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to stop loop"})
	}
	// Update store synchronously so the response reflects the stopped state.
	// The exit-watcher goroutine may also update, but Store.Update is atomic
	// and both writes produce the same result.
	_ = h.store.Update(id, func(l *store.Loop) {
		now := time.Now()
		l.StoppedAt = &now
		l.PID = 0
		l.Status = store.StatusStopped
	})
	return c.JSON(fiber.Map{"status": "stopped"})
}

func (h *LoopHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	loop, ok := h.store.Get(id)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "loop not found"})
	}

	// Stop if running
	if h.mgr.IsRunning(id) {
		if err := h.mgr.Stop(id); err != nil {
			h.logger.Warn("failed to stop loop during delete", "loop_id", id, "error", err)
		}
	}

	// I2: Delete from store BEFORE removing files, so the exit-watcher
	// sees the loop is gone and skips its save.
	if err := h.store.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Clean up runner map entry and enrichment cache.
	h.mgr.Remove(id)
	ralph.EvictCache(loop.LocalPath)

	// Remove repo directory — verify it's under DataDir to prevent accidental
	// deletion of unrelated paths if the store data is corrupted.
	if h.validateLocalPath(loop.LocalPath) {
		absPath, _ := filepath.Abs(loop.LocalPath)
		if err := os.RemoveAll(absPath); err != nil {
			h.logger.Error("failed to remove repo directory", "loop_id", id, "path", absPath, "error", err)
		}
	} else if loop.LocalPath != "" {
		h.logger.Error("refusing to remove path outside data dir", "loop_id", id, "path", loop.LocalPath, "data_dir", h.config.DataDir)
	}

	h.bus.Publish(events.Event{Type: "loop_deleted", LoopID: id})
	return c.SendStatus(204)
}

// validateLocalPath ensures a loop's LocalPath is under the configured DataDir.
func (h *LoopHandler) validateLocalPath(localPath string) bool {
	if localPath == "" {
		return false
	}
	absPath, err := filepath.Abs(localPath)
	if err != nil {
		return false
	}
	return strings.HasPrefix(absPath, filepath.Clean(h.config.DataDir)+string(filepath.Separator))
}

func (h *LoopHandler) Logs(c *fiber.Ctx) error {
	id := c.Params("id")
	loop, ok := h.store.Get(id)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "loop not found"})
	}
	if !h.validateLocalPath(loop.LocalPath) {
		h.logger.Error("refusing to read logs from path outside data dir", "loop_id", id, "path", loop.LocalPath)
		return c.Status(403).JSON(fiber.Map{"error": "invalid path"})
	}
	n, _ := strconv.Atoi(c.Query("lines", "100"))
	if n <= 0 || n > 1000 {
		n = 100
	}
	content, err := ralph.ReadLog(loop.LocalPath, n)
	if err != nil {
		// B3: Distinguish "no log file yet" (404) from actual I/O errors (500).
		if os.IsNotExist(err) {
			return c.Status(404).JSON(fiber.Map{"error": "no logs available"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "failed to read logs"})
	}
	return c.JSON(fiber.Map{"content": content})
}
