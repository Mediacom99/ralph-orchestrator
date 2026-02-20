package ralph

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

type Manager struct {
	mu      sync.RWMutex
	runners map[string]*Runner
	logger  *slog.Logger
}

func NewManager(logger *slog.Logger) *Manager {
	return &Manager{
		runners: make(map[string]*Runner),
		logger:  logger,
	}
}

func (m *Manager) Start(ctx context.Context, loopID, dir string, envOverrides map[string]string) (*Runner, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if r, ok := m.runners[loopID]; ok && r.IsRunning() {
		return nil, fmt.Errorf("loop %s already running", loopID)
	}

	r := NewRunner(loopID, dir, envOverrides, m.logger)
	if err := r.Start(ctx); err != nil {
		return nil, err
	}
	m.runners[loopID] = r
	return r, nil
}

func (m *Manager) Stop(loopID string) error {
	m.mu.RLock()
	r, ok := m.runners[loopID]
	m.mu.RUnlock()
	if !ok {
		return nil // idempotent: missing runner is not an error
	}
	return r.Stop()
}

func (m *Manager) IsRunning(loopID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.runners[loopID]
	return ok && r.IsRunning()
}

func (m *Manager) GetRunner(loopID string) *Runner {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.runners[loopID]
}

// Remove deletes a runner entry from the map. Call this when a loop is deleted.
func (m *Manager) Remove(loopID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.runners, loopID)
}

func (m *Manager) StopAll(ctx context.Context) {
	m.mu.RLock()
	runners := make([]*Runner, 0, len(m.runners))
	for _, r := range m.runners {
		runners = append(runners, r)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	for _, r := range runners {
		wg.Add(1)
		go func(r *Runner) {
			defer wg.Done()
			if err := r.Stop(); err != nil {
				m.logger.Error("failed to stop runner during shutdown", "loop_id", r.loopID, "error", err)
			}
		}(r)
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		m.logger.Warn("timeout stopping all runners")
	}
}
