package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Store is a simple JSON-file-backed persistence layer.
type Store struct {
	mu    sync.RWMutex
	path  string
	loops map[string]*Loop
}

func New(path string) (*Store, error) {
	s := &Store{
		path:  path,
		loops: make(map[string]*Loop),
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err == nil {
		if err := json.Unmarshal(data, &s.loops); err != nil {
			return nil, fmt.Errorf("corrupt store file %s: %w", path, err)
		}
	}
	return s, nil
}

func (s *Store) Save(loop *Loop) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.loops[loop.ID] = loop
	return s.flush()
}

func (s *Store) Get(id string) (*Loop, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	l, ok := s.loops[id]
	if !ok {
		return nil, false
	}
	cp := *l
	return &cp, true
}

func (s *Store) List() []*Loop {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Loop, 0, len(s.loops))
	for _, l := range s.loops {
		cp := *l
		out = append(out, &cp)
	}
	return out
}

// Update atomically reads, modifies, and writes back a loop under the lock.
// Returns an error if the loop doesn't exist (e.g., was deleted concurrently).
func (s *Store) Update(id string, fn func(*Loop)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.loops[id]
	if !ok {
		return fmt.Errorf("loop %s not found", id)
	}
	fn(l)
	return s.flush()
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.loops, id)
	return s.flush()
}

// flush writes the store to disk atomically. Must be called with mu held.
func (s *Store) flush() error {
	data, err := json.MarshalIndent(s.loops, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
