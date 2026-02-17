package git

import (
	"net"
	"testing"
)

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"valid HTTPS", "https://github.com/user/repo.git", false},
		{"valid SSH", "git@github.com:user/repo.git", false},
		{"HTTP rejected", "http://github.com/user/repo.git", true},
		{"empty", "", true},
		{"ftp rejected", "ftp://example.com/repo", true},
		{"invalid SSH format", "git@github.com/user/repo.git", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateURL(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateURL(%q) error = %v, wantErr %v", tt.url, err, tt.wantErr)
			}
		})
	}
}

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		name    string
		ip      string
		private bool
	}{
		{"loopback4", "127.0.0.1", true},
		{"10.x", "10.0.0.1", true},
		{"192.168.x", "192.168.1.1", true},
		{"172.16.x", "172.16.0.1", true},
		{"link-local", "169.254.1.1", true},
		{"public", "8.8.8.8", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip := net.ParseIP(tt.ip)
			got := isPrivateIP(ip)
			if got != tt.private {
				t.Errorf("isPrivateIP(%q) = %v, want %v", tt.ip, got, tt.private)
			}
		})
	}
}

func TestRepoName(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"https://github.com/user/my-repo.git", "my-repo"},
		{"git@github.com:user/my-repo.git", "my-repo"},
		{"https://github.com/user/repo", "repo"},
	}
	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := RepoName(tt.url)
			if got != tt.want {
				t.Errorf("RepoName(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}
