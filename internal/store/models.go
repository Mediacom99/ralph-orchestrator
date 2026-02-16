package store

import "time"

type LoopStatus string

const (
	StatusCloning  LoopStatus = "cloning"
	StatusRunning  LoopStatus = "running"
	StatusStopped  LoopStatus = "stopped"
	StatusComplete LoopStatus = "complete"
	StatusFailed   LoopStatus = "failed"
	StatusError    LoopStatus = "error"
)

type Loop struct {
	ID        string     `json:"id"`
	GitURL    string     `json:"git_url"`
	RepoName  string     `json:"repo_name"`
	LocalPath string     `json:"local_path"`
	Status    LoopStatus `json:"status"`
	PID       int        `json:"pid,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	StartedAt *time.Time `json:"started_at,omitempty"`
	StoppedAt *time.Time `json:"stopped_at,omitempty"`

	// Live data — populated from .ralph/ files, not persisted.
	RalphStatus *RalphStatusData `json:"ralph_status,omitempty"`
	Progress    *ProgressData    `json:"progress,omitempty"`
}

type RalphStatusData struct {
	LoopCount       int    `json:"loop_count"`
	CallsMade       int    `json:"calls_made"`
	MaxCallsPerHour int    `json:"max_calls_per_hour"`
	Status          string `json:"status"`
	ExitReason      string `json:"exit_reason,omitempty"`
}

type ProgressData struct {
	TasksTotal     int     `json:"tasks_total"`
	TasksDone      int     `json:"tasks_done"`
	Percentage     float64 `json:"percentage"`
	ElapsedSeconds int     `json:"elapsed_seconds"`
	LastOutput     string  `json:"last_output,omitempty"`
}
