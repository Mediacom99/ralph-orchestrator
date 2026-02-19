package git

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"os/exec"
	"path"
	"regexp"
	"strings"
	"time"
)

// InjectToken inserts a GitHub PAT into an HTTPS git URL as userinfo.
// SSH URLs (git@...) are returned unchanged.
func InjectToken(rawURL, token string) string {
	if token == "" || strings.HasPrefix(rawURL, "git@") {
		return rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" {
		return rawURL
	}
	u.User = url.UserPassword("x-access-token", token)
	return u.String()
}

func Clone(ctx context.Context, gitURL, targetDir, githubToken string) error {
	cloneURL := InjectToken(gitURL, githubToken)
	cmd := exec.CommandContext(ctx, "git", "clone", cloneURL, targetDir)
	// Mitigate DNS rebinding: disable HTTP redirects so an attacker cannot
	// redirect git to an internal address after the SSRF check passes.
	cmd.Env = append(cmd.Environ(),
		"GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=http.followRedirects",
		"GIT_CONFIG_VALUE_0=false",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Sanitize token from error output.
		out := string(output)
		if githubToken != "" {
			out = strings.ReplaceAll(out, githubToken, "***")
		}
		return fmt.Errorf("git clone failed: %w\n%s", err, out)
	}
	return nil
}

// sshURLPattern validates SSH git URLs like git@github.com:user/repo.git
var sshURLPattern = regexp.MustCompile(`^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9_./-]+$`)

// privateNetworks contains CIDR ranges that should not be cloneable to
// prevent SSRF attacks against internal services and cloud metadata endpoints.
var privateNetworks = func() []net.IPNet {
	cidrs := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}
	nets := make([]net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, n, _ := net.ParseCIDR(cidr)
		nets = append(nets, *n)
	}
	return nets
}()

func isPrivateIP(ip net.IP) bool {
	for _, n := range privateNetworks {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func ValidateURL(rawURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if strings.HasPrefix(rawURL, "git@") {
		if !sshURLPattern.MatchString(rawURL) {
			return fmt.Errorf("invalid SSH URL format, expected git@host:path")
		}
		// Extract hostname from git@hostname:path and check for SSRF.
		host := rawURL[len("git@"):]
		if idx := strings.Index(host, ":"); idx > 0 {
			host = host[:idx]
		}
		return checkHostSSRF(ctx, host)
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("URL must use https:// or git@ format")
	}
	if u.Host == "" {
		return fmt.Errorf("URL missing host")
	}

	return checkHostSSRF(ctx, u.Hostname())
}

// checkHostSSRF resolves a hostname and blocks private/internal addresses.
func checkHostSSRF(ctx context.Context, host string) error {
	ips, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil {
		return fmt.Errorf("cannot resolve host %q: %w", host, err)
	}
	for _, ipStr := range ips {
		if ip := net.ParseIP(ipStr); ip != nil && isPrivateIP(ip) {
			return fmt.Errorf("URL resolves to a private network address")
		}
	}
	return nil
}

func RepoName(rawURL string) string {
	// Handle SSH: git@github.com:user/repo.git
	if strings.HasPrefix(rawURL, "git@") {
		parts := strings.SplitN(rawURL, ":", 2)
		if len(parts) == 2 {
			rawURL = parts[1]
		}
	}
	name := path.Base(rawURL)
	name = strings.TrimSuffix(name, ".git")
	return name
}
