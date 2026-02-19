package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Settings holds application-level configuration persisted to disk.
type Settings struct {
	GitHubToken string `json:"github_token,omitempty"`
}

// SettingsStore is a JSON-file-backed store for application settings.
type SettingsStore struct {
	mu       sync.RWMutex
	path     string
	settings Settings
}

func NewSettingsStore(path string) (*SettingsStore, error) {
	s := &SettingsStore{path: path}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err == nil {
		if err := json.Unmarshal(data, &s.settings); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s *SettingsStore) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}

func (s *SettingsStore) GetGitHubToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings.GitHubToken
}

func (s *SettingsStore) SetGitHubToken(token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings.GitHubToken = token
	return s.flush()
}

// flush writes settings to disk atomically. Must be called with mu held.
func (s *SettingsStore) flush() error {
	data, err := json.MarshalIndent(s.settings, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
