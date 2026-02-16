package ralph

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/edoardo/ralph-orchestrator/internal/store"
)

var (
	reChecked   = regexp.MustCompile(`^\s*-\s*\[x\]`)
	reUnchecked = regexp.MustCompile(`^\s*-\s*\[\s\]`)
)

// ReadStatus reads .ralph/status.json from the repo directory.
func ReadStatus(repoDir string) (*store.RalphStatusData, error) {
	data, err := os.ReadFile(filepath.Join(repoDir, ".ralph", "status.json"))
	if err != nil {
		return nil, err
	}
	var s store.RalphStatusData
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// progressJSON matches the structure ralph writes to progress.json.
type progressJSON struct {
	Status         string `json:"status"`
	ElapsedSeconds int    `json:"elapsed_seconds"`
	LastOutput     string `json:"last_output"`
}

// ReadProgress reads .ralph/progress.json from the repo directory.
func ReadProgress(repoDir string) (*store.ProgressData, error) {
	data, err := os.ReadFile(filepath.Join(repoDir, ".ralph", "progress.json"))
	if err != nil {
		return nil, err
	}
	var p progressJSON
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &store.ProgressData{
		ElapsedSeconds: p.ElapsedSeconds,
		LastOutput:     p.LastOutput,
	}, nil
}

// ParseFixPlan counts completed and total tasks in .ralph/fix_plan.md.
func ParseFixPlan(repoDir string) (done, total int, err error) {
	f, err := os.Open(filepath.Join(repoDir, ".ralph", "fix_plan.md"))
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if reChecked.MatchString(line) {
			done++
			total++
		} else if reUnchecked.MatchString(line) {
			total++
		}
	}
	return done, total, scanner.Err()
}

// ReadLog reads the last n lines from .ralph/logs/ralph.log.
// B2: Reads from the end of the file instead of loading the entire file.
func ReadLog(repoDir string, n int) (string, error) {
	path := filepath.Join(repoDir, ".ralph", "logs", "ralph.log")
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return "", err
	}
	size := stat.Size()
	if size == 0 {
		return "", nil
	}

	// Scan backward from end of file counting newlines
	const chunkSize = 8192
	newlines := 0
	offset := size

	for offset > 0 {
		readSize := int64(chunkSize)
		if readSize > offset {
			readSize = offset
		}
		offset -= readSize

		chunk := make([]byte, readSize)
		if _, err := f.ReadAt(chunk, offset); err != nil {
			return "", err
		}

		for i := len(chunk) - 1; i >= 0; i-- {
			if chunk[i] == '\n' {
				newlines++
				if newlines > n {
					startPos := offset + int64(i) + 1
					result := make([]byte, size-startPos)
					if _, err := f.ReadAt(result, startPos); err != nil {
						return "", err
					}
					return string(result), nil
				}
			}
		}
	}

	// File has <= n lines, read it all
	result := make([]byte, size)
	if _, err := f.ReadAt(result, 0); err != nil {
		return "", err
	}
	return string(result), nil
}

// I3: Cache enrichment data to avoid reading 3 files per loop per API call.
var (
	enrichCache   sync.Map // map[string]*enrichEntry
	enrichCacheTTL = 2 * time.Second
)

type enrichEntry struct {
	ralphStatus *store.RalphStatusData
	progress    *store.ProgressData
	fetchedAt   time.Time
}

// EvictCache removes cached enrichment data for a given local path.
func EvictCache(localPath string) {
	enrichCache.Delete(localPath)
}

// EnrichLoop populates the live status fields on a Loop by reading .ralph/ files.
func EnrichLoop(loop *store.Loop) {
	if loop.LocalPath == "" {
		return
	}

	key := loop.LocalPath
	if cached, ok := enrichCache.Load(key); ok {
		entry := cached.(*enrichEntry)
		if time.Since(entry.fetchedAt) < enrichCacheTTL {
			loop.RalphStatus = entry.ralphStatus
			loop.Progress = entry.progress
			return
		}
	}

	if s, err := ReadStatus(loop.LocalPath); err == nil {
		loop.RalphStatus = s
	}
	if p, err := ReadProgress(loop.LocalPath); err == nil {
		loop.Progress = p
	}
	done, total, err := ParseFixPlan(loop.LocalPath)
	if err == nil && total > 0 {
		if loop.Progress == nil {
			loop.Progress = &store.ProgressData{}
		}
		loop.Progress.TasksDone = done
		loop.Progress.TasksTotal = total
		loop.Progress.Percentage = float64(done) / float64(total) * 100
	}

	enrichCache.Store(key, &enrichEntry{
		ralphStatus: loop.RalphStatus,
		progress:    loop.Progress,
		fetchedAt:   time.Now(),
	})
}
