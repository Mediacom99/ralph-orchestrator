package store

import (
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "loops.json")
	s, err := New(path)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return s
}

func TestSaveAndGet(t *testing.T) {
	s := newTestStore(t)
	loop := &Loop{
		ID:        "abc",
		GitURL:    "https://github.com/user/repo.git",
		RepoName:  "repo",
		Status:    StatusStopped,
		CreatedAt: time.Now(),
	}
	if err := s.Save(loop); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, ok := s.Get("abc")
	if !ok {
		t.Fatal("Get returned not ok")
	}
	if got.GitURL != loop.GitURL {
		t.Errorf("GitURL = %q, want %q", got.GitURL, loop.GitURL)
	}
}

func TestGetReturnsCopy(t *testing.T) {
	s := newTestStore(t)
	s.Save(&Loop{ID: "a", Status: StatusStopped, CreatedAt: time.Now()})
	got, _ := s.Get("a")
	got.Status = StatusRunning

	original, _ := s.Get("a")
	if original.Status != StatusStopped {
		t.Errorf("Get returned pointer to internal data, mutation leaked: got %q", original.Status)
	}
}

func TestListReturnsCopies(t *testing.T) {
	s := newTestStore(t)
	s.Save(&Loop{ID: "a", Status: StatusStopped, CreatedAt: time.Now()})
	list := s.List()
	if len(list) != 1 {
		t.Fatalf("List len = %d, want 1", len(list))
	}
	list[0].Status = StatusRunning
	list2 := s.List()
	if list2[0].Status != StatusStopped {
		t.Error("List returned pointer to internal data")
	}
}

func TestUpdate(t *testing.T) {
	s := newTestStore(t)
	s.Save(&Loop{ID: "a", Status: StatusStopped, CreatedAt: time.Now()})
	err := s.Update("a", func(l *Loop) { l.Status = StatusRunning })
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, _ := s.Get("a")
	if got.Status != StatusRunning {
		t.Errorf("Status = %q, want %q", got.Status, StatusRunning)
	}
}

func TestUpdateMissing(t *testing.T) {
	s := newTestStore(t)
	err := s.Update("missing", func(l *Loop) {})
	if err == nil {
		t.Fatal("Update of missing loop should return error")
	}
}

func TestDelete(t *testing.T) {
	s := newTestStore(t)
	s.Save(&Loop{ID: "a", CreatedAt: time.Now()})
	if err := s.Delete("a"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, ok := s.Get("a"); ok {
		t.Error("loop still exists after delete")
	}
}

func TestConcurrentAccess(t *testing.T) {
	s := newTestStore(t)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id := "loop-" + string(rune('a'+i%26))
			s.Save(&Loop{ID: id, Status: StatusStopped, CreatedAt: time.Now()})
			s.Get(id)
			s.List()
			s.Update(id, func(l *Loop) { l.Status = StatusRunning })
		}(i)
	}
	wg.Wait()
}

func TestAtomicFlush(t *testing.T) {
	path := filepath.Join(t.TempDir(), "loops.json")
	s, _ := New(path)
	s.Save(&Loop{ID: "a", GitURL: "https://example.com/repo.git", CreatedAt: time.Now()})

	// Reload from disk and verify data survived.
	s2, err := New(path)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	got, ok := s2.Get("a")
	if !ok {
		t.Fatal("loop not found after reload")
	}
	if got.GitURL != "https://example.com/repo.git" {
		t.Errorf("GitURL = %q after reload", got.GitURL)
	}
}
