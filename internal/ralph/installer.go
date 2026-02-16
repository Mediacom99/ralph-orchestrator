package ralph

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func IsInstalled() bool {
	_, err := exec.LookPath("ralph")
	return err == nil
}

func Install(ctx context.Context) error {
	tmpDir := filepath.Join(os.TempDir(), "ralph-install")
	os.RemoveAll(tmpDir) // clean previous attempts

	cmd := exec.CommandContext(ctx, "git", "clone", "--depth", "1",
		"https://github.com/frankbria/ralph-claude-code.git", tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("clone ralph-claude-code: %w\n%s", err, string(out))
	}
	defer os.RemoveAll(tmpDir)

	install := exec.CommandContext(ctx, "bash", filepath.Join(tmpDir, "install.sh"))
	install.Dir = tmpDir
	if out, err := install.CombinedOutput(); err != nil {
		return fmt.Errorf("install.sh failed: %w\n%s", err, string(out))
	}

	if !IsInstalled() {
		return fmt.Errorf("ralph not on PATH after installation")
	}
	return nil
}

func EnsureInstalled(ctx context.Context) error {
	if IsInstalled() {
		return nil
	}
	return Install(ctx)
}

func IsRepoEnabled(repoDir string) bool {
	_, err := os.Stat(filepath.Join(repoDir, ".ralphrc"))
	if err == nil {
		return true
	}
	// Also check .ralph/ directory
	_, err = os.Stat(filepath.Join(repoDir, ".ralph"))
	return err == nil
}
