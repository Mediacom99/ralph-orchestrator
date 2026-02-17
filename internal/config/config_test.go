package config

import (
	"testing"
	"time"
)

func TestValidateValid(t *testing.T) {
	c := &Config{
		Port:            "8080",
		DataDir:         "/tmp/data",
		CloneTimeout:    5 * time.Minute,
		ShutdownTimeout: 30 * time.Second,
	}
	if err := c.Validate(); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestValidateEmptyDataDir(t *testing.T) {
	c := &Config{
		Port:            "8080",
		DataDir:         "",
		CloneTimeout:    5 * time.Minute,
		ShutdownTimeout: 30 * time.Second,
	}
	if err := c.Validate(); err == nil {
		t.Fatal("expected error for empty DataDir")
	}
}

func TestValidateInvalidPort(t *testing.T) {
	tests := []struct {
		name string
		port string
	}{
		{"zero", "0"},
		{"negative", "-1"},
		{"too high", "70000"},
		{"non-numeric", "abc"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Config{
				Port:            tt.port,
				DataDir:         "/tmp",
				CloneTimeout:    time.Minute,
				ShutdownTimeout: time.Second,
			}
			if err := c.Validate(); err == nil {
				t.Errorf("expected error for port %q", tt.port)
			}
		})
	}
}

func TestValidateNegativeTimeouts(t *testing.T) {
	base := Config{Port: "8080", DataDir: "/tmp", CloneTimeout: time.Minute, ShutdownTimeout: time.Second}

	t.Run("clone timeout", func(t *testing.T) {
		c := base
		c.CloneTimeout = -1
		if err := c.Validate(); err == nil {
			t.Error("expected error for negative CloneTimeout")
		}
	})

	t.Run("shutdown timeout", func(t *testing.T) {
		c := base
		c.ShutdownTimeout = 0
		if err := c.Validate(); err == nil {
			t.Error("expected error for zero ShutdownTimeout")
		}
	})
}
