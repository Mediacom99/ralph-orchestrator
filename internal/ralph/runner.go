package ralph

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Runner struct {
	loopID   string
	dir      string
	cmd      *exec.Cmd
	cancelFn context.CancelFunc
	done     chan struct{}
	exitErr  error
	stopping bool // I1: prevents concurrent Stop() from duplicating work
	mu       sync.Mutex
	logger   *slog.Logger
}

func NewRunner(loopID, dir string, logger *slog.Logger) *Runner {
	return &Runner{
		loopID: loopID,
		dir:    dir,
		done:   make(chan struct{}),
		logger: logger,
	}
}

func (r *Runner) Start(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cmd != nil {
		return fmt.Errorf("already running")
	}

	runCtx, cancel := context.WithCancel(ctx)
	r.cancelFn = cancel

	r.cmd = exec.CommandContext(runCtx, "ralph")
	r.cmd.Dir = r.dir
	// I9: Only pass necessary env vars to the subprocess.
	r.cmd.Env = filteredEnv()
	// Ensure ralph output goes to its own log files
	r.cmd.Stdout = nil
	r.cmd.Stderr = nil
	// Create new process group so we can kill the whole tree
	r.cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	if err := r.cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("start ralph: %w", err)
	}

	r.logger.Info("ralph started", "loop_id", r.loopID, "pid", r.cmd.Process.Pid)

	go func() {
		err := r.cmd.Wait()
		r.mu.Lock()
		r.exitErr = err
		r.mu.Unlock()
		r.logger.Info("ralph exited", "loop_id", r.loopID, "error", err)
		close(r.done)
	}()

	return nil
}

func (r *Runner) Stop() error {
	r.mu.Lock()
	if r.cmd == nil || r.cmd.Process == nil {
		r.mu.Unlock()
		return nil
	}
	// I1: If another goroutine is already stopping, just wait for completion.
	if r.stopping {
		r.mu.Unlock()
		select {
		case <-r.done:
		case <-time.After(15 * time.Second):
			return fmt.Errorf("timed out waiting for concurrent stop")
		}
		return nil
	}
	r.stopping = true
	r.logger.Info("stopping ralph", "loop_id", r.loopID)
	// Send SIGTERM under lock
	pgid, err := syscall.Getpgid(r.cmd.Process.Pid)
	if err == nil {
		_ = syscall.Kill(-pgid, syscall.SIGTERM)
	} else {
		_ = r.cmd.Process.Signal(syscall.SIGTERM)
	}
	r.mu.Unlock() // release before waiting

	// Wait without lock
	select {
	case <-r.done:
		return nil
	case <-time.After(10 * time.Second):
	}

	// Force kill — re-acquire lock to read cmd
	r.mu.Lock()
	if r.cmd != nil && r.cmd.Process != nil {
		if pgid, err := syscall.Getpgid(r.cmd.Process.Pid); err == nil {
			_ = syscall.Kill(-pgid, syscall.SIGKILL)
		} else {
			_ = r.cmd.Process.Kill()
		}
	}
	r.mu.Unlock()
	select {
	case <-r.done:
	case <-time.After(5 * time.Second):
		// Process didn't die after SIGKILL — give up to avoid leaking goroutines.
		return fmt.Errorf("process did not exit after SIGKILL")
	}
	return nil
}

func (r *Runner) IsRunning() bool {
	select {
	case <-r.done:
		return false
	default:
		r.mu.Lock()
		running := r.cmd != nil
		r.mu.Unlock()
		return running
	}
}

func (r *Runner) PID() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cmd != nil && r.cmd.Process != nil {
		return r.cmd.Process.Pid
	}
	return 0
}

func (r *Runner) Done() <-chan struct{} {
	return r.done
}

func (r *Runner) ExitErr() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.exitErr
}

// I9: filteredEnv returns only the environment variables the ralph
// subprocess needs, avoiding leaking server secrets.
func filteredEnv() []string {
	allowed := map[string]bool{
		"PATH": true, "HOME": true, "USER": true, "SHELL": true,
		"ANTHROPIC_API_KEY": true, "LANG": true, "TERM": true,
		"TMPDIR": true, "XDG_CONFIG_HOME": true, "XDG_DATA_HOME": true,
	}
	var env []string
	for _, e := range os.Environ() {
		key, _, _ := strings.Cut(e, "=")
		if allowed[key] {
			env = append(env, e)
		}
	}
	return env
}
