# Security Analysis

## SSRF Protection on Git Clone URLs

`internal/git/clone.go`

The application accepts user-provided git URLs for cloning. Without protection, an attacker could supply URLs pointing to internal services (e.g., `http://169.254.169.254/` for cloud metadata, `http://localhost:6379/` for Redis).

### Mitigations

**1. URL validation** (`ValidateURL`)
- Only HTTPS and SSH URLs are accepted
- HTTPS must use `https://` scheme (HTTP is rejected)
- SSH must match `^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9_./-]+$`

**2. DNS resolution check** (`checkHostSSRF`)
- Before cloning, the hostname is resolved via DNS
- All returned IP addresses are checked against private ranges:
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918)
  - `127.0.0.0/8` (loopback)
  - `169.254.0.0/16` (link-local / cloud metadata)
  - `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 private)
- DNS resolution has a 5-second timeout

**3. HTTP redirect disabled**
- Git's HTTP redirect following is disabled via environment variables:
  - `GIT_CONFIG_KEY_0=http.followRedirects`
  - `GIT_CONFIG_VALUE_0=false`
- This prevents an attacker from hosting a public URL that redirects to an internal address

### Remaining Risks

- **DNS rebinding (TOCTOU):** There's a time gap between DNS validation and the actual git clone. An attacker could configure DNS to return a public IP during validation, then switch to a private IP before git resolves. Mitigation would require pinning the resolved IP, which is non-trivial with git's built-in DNS resolution.
- **SSH URLs bypass DNS check:** SSH URLs go through regex validation but the `checkHostSSRF` function is called for DNS resolution. If the SSH host resolves to a private IP, it's caught — but SSH connections have a different attack surface than HTTP.

## Bearer Token Authentication

`internal/api/middleware/auth.go`

### Design

- Single bearer token configured via `API_KEY` environment variable
- Token checked on every request except `GET /api/health`
- Two extraction methods:
  1. `Authorization: Bearer <token>` header (primary)
  2. `?token=<value>` query parameter (fallback for WebSocket)

### Security Properties

- **Empty API_KEY disables auth entirely** — intended for development. Production deployments must set `API_KEY`.
- **No token rotation** — changing the key requires restarting the server.
- **No rate limiting on auth failures** — an attacker can brute-force the token without delay.
- **Query parameter token exposure** — the WebSocket query param fallback means tokens appear in server access logs and potentially browser history. This is a necessary trade-off because browsers cannot send custom headers during WebSocket upgrade.

### Recommendations

- Add rate limiting on 401 responses
- Consider JWT or session-based auth for multi-user scenarios
- Add `API_KEY` minimum length validation

## Security Headers

`internal/api/server.go` — applied via Fiber middleware to all responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking by disallowing iframe embedding |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing attacks |
| `Content-Security-Policy` | `default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:` | Restricts resource loading sources |

### CSP Breakdown

- `default-src 'self'` — only load resources from same origin
- `style-src 'self' 'unsafe-inline'` — allow inline styles (needed for Tailwind's runtime styles and the progress bar's `style={{ width }}`)
- `connect-src 'self' ws: wss:` — allow fetch/XHR to same origin, WebSocket to any host

### Missing Headers

- **`Strict-Transport-Security`** — not set. Should be added for production HTTPS deployments.
- **`Referrer-Policy`** — not set. Consider `strict-origin-when-cross-origin`.
- **`Permissions-Policy`** — not set. Could restrict camera/microphone/geolocation access.

## CORS Configuration

`internal/api/server.go` + `internal/config/config.go`

- Configured via `ALLOWED_ORIGINS` environment variable
- Default: `http://localhost:5173, http://localhost:8080` (development)
- Production should set this to the actual domain

The CORS middleware allows:
- Specified origins
- Standard methods and headers
- Credentials

## GitHub Token Security

`internal/store/settings.go` + `internal/git/clone.go` + `internal/api/handlers/settings.go`

The GitHub PAT (Personal Access Token) is used to clone private repositories. Several measures protect it:

### Storage

- Token is persisted to `$DATA_DIR/settings.json` with `0o600` file permissions (owner read/write only)
- Atomic writes via temp file + rename prevent partial writes

### API Response Masking

- `GET /api/settings` returns a masked token: only the last 4 characters are shown, prefixed with `****` (e.g., `****abc1`)
- Tokens ≤4 characters return an empty string
- A `has_github_token` boolean indicates whether a token is configured without exposing its value

### Clone Error Sanitization

- If `git clone` fails, the error output is sanitized: the token string is replaced with `***` before being included in the error message or event data
- This prevents the token from leaking through error logs or WebSocket events

### Injection Scope

- Token is only injected into HTTPS git URLs via the `x-access-token` userinfo mechanism
- SSH URLs (`git@...`) are left unchanged — SSH auth uses keys, not PATs
- Non-HTTPS or unparseable URLs are returned unchanged (no token injection)

### Not Logged or Emitted

- The token value is never included in structured log fields — only a `has_token` boolean is logged during clone operations
- The token is not broadcast via WebSocket events
- The token is not passed to ralph subprocesses (not in the `filteredEnv` allow list)

## Environment Variable Filtering

`internal/ralph/runner.go` — `filteredEnv()` function

When spawning ralph subprocesses, the runner filters environment variables to prevent leaking server secrets:

**Allowed variables:**
- `PATH`, `HOME`, `USER`, `SHELL`, `LANG`, `TERM` — standard system vars
- `ANTHROPIC_API_KEY` — required by ralph for Claude API access
- `TMPDIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` — standard directories

**Blocked variables (not passed to subprocess):**
- `API_KEY` — the orchestrator's auth token
- `DATABASE_URL`, `AWS_*`, `GCP_*` — any cloud credentials
- Any other server-specific configuration

This prevents a malicious ralph process or compromised repository from extracting server credentials.

## Path Traversal Protection

`internal/api/handlers/loops.go` — `validateLocalPath()` function

Before deleting a loop's repo directory or reading its logs, the handler validates that `LocalPath` is actually under `DataDir`:

```go
func (h *LoopHandler) validateLocalPath(localPath string) error {
    absLocal, _ := filepath.Abs(localPath)
    absData, _ := filepath.Abs(h.config.DataDir)
    if !strings.HasPrefix(absLocal+string(filepath.Separator), absData+string(filepath.Separator)) {
        return fmt.Errorf("path outside data directory")
    }
    return nil
}
```

This prevents:
- A corrupted store entry from causing deletion of arbitrary files
- Path traversal attacks if `LocalPath` were manipulated to contain `../`

The check uses absolute paths with trailing separator to prevent prefix attacks (e.g., `/data2` matching `/data`).

## Docker Security

`Dockerfile`

### Non-Root User

The final image creates an unprivileged user:
```dockerfile
RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
USER app
```

The orchestrator binary runs as `app:app` (UID 1000, GID 1000), not root. Only `/data` and `/app` directories are owned by this user.

### Minimal Attack Surface

The final image is based on `alpine:3.21` with only:
- `git` (required for clone operations)
- `bash` (required by ralph-claude-code)
- No build tools, compilers, or package managers beyond what's needed

### Multi-Stage Build

Build tools (Go compiler, Node.js, npm) are only present in build stages and don't appear in the final image.

## Identified Gaps and Recommendations

### High Priority

1. **No rate limiting.** The API has no rate limiting on any endpoint. An attacker could:
   - Brute-force the API key
   - Trigger many concurrent git clones (resource exhaustion)
   - Flood the EventBus with WebSocket connections

   **Recommendation:** Add rate limiting middleware (Fiber has built-in support).

2. **No HTTPS termination.** The server listens on plain HTTP. In production, HTTPS should be terminated by a reverse proxy (nginx, Caddy, cloud load balancer) or added directly.

3. **DNS rebinding TOCTOU.** The gap between DNS validation and git clone allows DNS rebinding attacks. Consider using a custom HTTP transport that pins resolved IPs, or re-validating after clone.

### Medium Priority

4. **Token in query parameter.** WebSocket auth tokens appear in URLs, which are logged by web servers and proxies. Consider:
   - A short-lived token exchange (POST to get a one-time WS ticket)
   - Cookie-based auth for WebSocket

5. **No input sanitization on git URL.** While URL validation catches many issues, the raw URL is passed to `git clone` via `exec.Command`. Shell injection is not possible (Go's exec doesn't use a shell), but unusual URL characters could cause unexpected behavior.

6. **No request size limits.** The `POST /api/loops` endpoint doesn't limit request body size. Fiber has a default limit but it should be explicitly configured.

### Low Priority

7. **No audit logging.** There's no record of who performed what action. For multi-user deployments, this would be important.

8. **localStorage token storage.** The API key is stored in `localStorage`, which is accessible to any JavaScript running on the same origin. If XSS were possible (currently mitigated by CSP), the token could be stolen. `httpOnly` cookies would be more secure.

9. **`unsafe-inline` in CSP.** The style-src directive allows inline styles, which weakens the CSP. This is currently needed for dynamic styles (progress bar width) but could be replaced with CSS custom properties.

10. **No Subresource Integrity (SRI).** The embedded SPA's JavaScript files don't use SRI hashes. Since they're served from the same binary, the risk is minimal, but SRI would add defense in depth.
