# Backend Deep Dive

## Entry Point and Startup Sequence

`cmd/orchestrator/main.go` (107 lines) runs the following startup sequence:

1. **Load configuration** from environment variables with defaults (`config.Load()`)
2. **Validate configuration** — exits on invalid port, empty data dir, or negative timeouts
3. **Configure structured logging** with `slog` — level set from `LOG_LEVEL` env var
4. **Ensure ralph-claude-code is installed** — auto-installs from GitHub if missing; exits on failure
5. **Initialize JSON store** at `$DATA_DIR/loops.json` — creates parent dirs if needed
6. **Initialize settings store** at `$DATA_DIR/settings.json` — if `GITHUB_TOKEN` env var is set and no token is persisted yet, seed it
7. **Reconcile stale loops** — any loops left in `running` or `cloning` status (from a crash) are reset to `stopped` with PID cleared
8. **Create EventBus** for real-time event broadcasting
9. **Create Manager** for ralph process lifecycle
10. **Create server-scoped context** that cancels on shutdown (used to abort in-progress clones)
11. **Initialize API server** with all dependencies wired
12. **Start listening** on configured port
13. **Signal handler** — SIGINT/SIGTERM triggers graceful shutdown:
    - Cancel server context (aborts in-progress clones)
    - Stop all running ralph processes concurrently (with timeout)
    - Shut down HTTP server
    - Log any shutdown errors

## Configuration System

`internal/config/config.go` (70 lines)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | string | `"8080"` | HTTP listen port |
| `DATA_DIR` | string | `"data"` | Root directory for store and repos |
| `LOG_LEVEL` | string | `"info"` | Log level: debug, info, warn, error |
| `DEV_MODE` | bool | `false` | Skip embedded SPA (use Vite proxy) |
| `ALLOWED_ORIGINS` | string | `"http://localhost:5173, http://localhost:8080"` | CORS allowed origins |
| `CLONE_TIMEOUT` | duration | `5m` | Git clone timeout |
| `SHUTDOWN_TIMEOUT` | duration | `30s` | Graceful shutdown timeout |
| `API_KEY` | string | `""` | Bearer token (empty = no auth) |
| `GITHUB_TOKEN` | string | `""` | GitHub PAT for private repos (seeds settings store on first run) |

Validation rules:
- `DataDir` must not be empty
- `Port` must be 1–65535
- `CloneTimeout` must be positive
- `ShutdownTimeout` must be positive

Invalid duration values log a warning and fall back to the default.

## API Routes and Handlers

### Health Check

`internal/api/handlers/health.go` (8 lines)

```
GET /api/health → { "status": "ok" }
```

Exempt from authentication. Used by Docker HEALTHCHECK.

### Loop Handlers

`internal/api/handlers/loops.go` (310 lines)

The `LoopHandler` struct holds all dependencies:

```go
type LoopHandler struct {
    store    *store.Store
    settings *store.SettingsStore
    mgr      *ralph.Manager
    bus      *events.EventBus
    config   *config.Config
    logger   *slog.Logger
    ctx      context.Context  // server-scoped, cancels on shutdown
}
```

#### `GET /api/loops` — List all loops

Returns all loops enriched with live data from `.ralph/` files. For each running loop, updates status and PID from the Manager.

#### `GET /api/loops/:id` — Get single loop

Returns one loop by ID (404 if not found). Same enrichment as list.

#### `POST /api/loops` — Create loop

Request body:
```json
{
  "git_url": "https://github.com/user/repo.git",
  "auto_start": true
}
```

Flow:
1. Generate 12-character UUID
2. Extract repo name from URL
3. Save loop with `status: "cloning"`
4. Publish `loop_created` event
5. Start background goroutine for clone
6. Return 201 immediately (non-blocking)

The background `cloneAndStart` goroutine:
1. Validate the git URL (SSRF checks)
2. Clone to `$DATA_DIR/repos/{reponame}-{id}`
3. Verify `.ralph/` directory exists in the cloned repo
4. On failure: set status to `error`, publish `clone_failed`
5. On success: set status to `stopped`, publish `clone_complete`
6. If `auto_start` was true: start the loop immediately

The clone uses the server-scoped context with `CLONE_TIMEOUT`, so it aborts on shutdown.

#### `POST /api/loops/:id/start` — Start loop

Returns 409 if already running or still cloning. Otherwise starts the ralph process via `Manager.Start()`, updates the store with `status: "running"`, PID, and `started_at`, then publishes `loop_started`.

A background **exit-watcher** goroutine is spawned that:
1. Waits on `runner.Done()` channel
2. Atomically updates the store to `complete` or `failed` based on exit error
3. Clears PID and sets `stopped_at`
4. Publishes `loop_stopped` event
5. Handles the race where the loop was deleted while running (skips store update)

#### `POST /api/loops/:id/stop` — Stop loop

Returns 409 if not running. Calls `Manager.Stop(id)` which sends SIGTERM → wait 10s → SIGKILL. Synchronously updates the store (the exit-watcher also updates atomically — both are safe due to `Store.Update()`).

#### `DELETE /api/loops/:id` — Delete loop

Flow:
1. Stop the loop if running (warn-only if stop fails)
2. Delete from store **before** removing files — this way the exit-watcher goroutine sees the loop is gone and skips its update
3. Remove runner from Manager
4. Evict enrichment cache
5. Validate that `LocalPath` is under `DataDir` (path traversal protection)
6. Remove repo directory recursively
7. Publish `loop_deleted` event
8. Return 204

#### `GET /api/loops/:id/logs` — Tail logs

Query param: `lines` (default 100, max 1000). Reads the last N lines from the ralph log file using an efficient backward-reading algorithm (8KB chunks from end of file). Returns 404 if no log file exists yet, 500 on I/O errors.

## WebSocket Handler and Protocol

`internal/api/handlers/ws.go` (82 lines)

```
GET /ws?token=<token>&loop_id=<id>
```

Connection flow:
1. Verify WebSocket upgrade request (return 426 if not)
2. Generate 12-char subscription ID
3. Subscribe to EventBus (optionally filtered by `loop_id`)
4. Set up ping/pong deadlines (pong wait: 30s, ping interval: 27s)
5. Start read-pump goroutine (detects client disconnect)
6. Enter write loop:
   - On event from bus → JSON-encode → write text frame
   - On ping tick → send ping frame
   - On client disconnect → cleanup and return

The protocol is server-push only. Client messages are read but ignored (the read-pump exists solely to detect disconnects via `SetReadDeadline`).

## Settings Handler

`internal/api/handlers/settings.go` (57 lines)

The `SettingsHandler` manages application settings via a dedicated `SettingsStore`:

```go
type SettingsHandler struct {
    settings *store.SettingsStore
}
```

#### `GET /api/settings` — Get settings

Returns the current settings. The GitHub token is **masked** in the response (only last 4 characters shown, prefixed with `****`). Includes a `has_github_token` boolean so the UI knows whether a token is configured without exposing it.

#### `PUT /api/settings` — Update settings

Request body:
```json
{
  "github_token": "ghp_xxxxxxxxxxxx"
}
```

Updates the GitHub PAT. Sending an empty string clears the token. The response returns the same masked format as GET. The token is persisted to `$DATA_DIR/settings.json` with `0o600` file permissions.

## Store Layer

`internal/store/store.go` (96 lines) + `internal/store/models.go` (47 lines) + `internal/store/settings.go` (67 lines)

### Data Model

```go
type Loop struct {
    ID          string         `json:"id"`
    GitURL      string         `json:"git_url"`
    RepoName    string         `json:"repo_name"`
    LocalPath   string         `json:"local_path"`
    Status      LoopStatus     `json:"status"`
    PID         int            `json:"pid,omitempty"`
    CreatedAt   time.Time      `json:"created_at"`
    StartedAt   *time.Time     `json:"started_at,omitempty"`
    StoppedAt   *time.Time     `json:"stopped_at,omitempty"`
    RalphStatus *RalphStatusData `json:"ralph_status,omitempty"`  // live, not persisted
    Progress    *ProgressData    `json:"progress,omitempty"`      // live, not persisted
}
```

Status transitions: `cloning` → `stopped` → `running` → `complete`/`failed`/`error`

### Persistence Mechanics

- **In-memory:** `map[string]*Loop` for O(1) lookups
- **On disk:** `$DATA_DIR/loops.json` (pretty-printed JSON)
- **Atomic writes:** marshal → temp file (0600 permissions) → `os.Rename` to final path
- **Copy semantics:** `Get()` and `List()` return value copies, not pointers
- **Atomic update:** `Update(id, fn func(*Loop))` acquires write lock, calls `fn`, then flushes
- **Thread safety:** `sync.RWMutex` — concurrent reads, exclusive writes

### Settings Store

`SettingsStore` persists application-level settings (currently: GitHub PAT) to `$DATA_DIR/settings.json`:

- **Thread safety:** `sync.RWMutex` for concurrent reads
- **Atomic writes:** Same temp-file + rename pattern as the loop store
- **File permissions:** `0o600` (owner read/write only) to protect the token
- **Env seeding:** On first startup, if no token is persisted and `GITHUB_TOKEN` env var is set, the token is automatically saved

## Ralph Integration

### Installer (`internal/ralph/installer.go`, 55 lines)

Called at startup. Checks if `ralph` is on `PATH`; if not, clones `ralph-claude-code` from GitHub (shallow clone) and runs its `install.sh` script. The app exits if installation fails.

### Runner (`internal/ralph/runner.go`, 177 lines)

Manages a single ralph OS process:

- **Start:** Creates `exec.Cmd` for `ralph` binary in the repo directory. Sets `Setpgid=true` to create a process group. Filters environment variables to prevent leaking server secrets (only passes PATH, HOME, USER, SHELL, LANG, TERM, ANTHROPIC_API_KEY, TMPDIR, XDG_CONFIG_HOME, XDG_DATA_HOME).
- **Stop:** SIGTERM to process group → 10s wait → SIGKILL → 5s wait. A `stopping` flag prevents duplicate work from concurrent Stop calls.
- **Done channel:** Closed when the process exits. Used by the exit-watcher goroutine.

### Manager (`internal/ralph/manager.go`, 100 lines)

Registry of all runners, keyed by loop ID. Thread-safe via `RWMutex`. Provides `Start`, `Stop`, `IsRunning`, `GetRunner`, `Remove`, and `StopAll` (concurrent shutdown).

### Status Reader (`internal/ralph/status.go`, 209 lines)

Reads live data from `.ralph/` files in each repo directory:

| File | Function | Data |
|------|----------|------|
| `.ralph/status.json` | `ReadStatus()` | loop_count, calls_made, max_calls_per_hour, status, exit_reason |
| `.ralph/progress.json` | `ReadProgress()` | status, elapsed_seconds, last_output |
| `.ralph/fix_plan.md` | `ParseFixPlan()` | tasks_done, tasks_total (counts `- [x]` and `- [ ]` checkboxes) |
| `.ralph/logs/ralph.log` | `ReadLog()` | Last N lines (backward reading in 8KB chunks) |

**Enrichment cache:** `EnrichLoop()` populates live fields on a Loop struct, caching results for 2 seconds in a `sync.Map` to avoid reading 3 files per loop per API call.

## Git Operations

`internal/git/clone.go` (139 lines)

### Clone

`Clone(ctx, gitURL, targetDir, githubToken)` runs `git clone` with context timeout. If a GitHub token is provided, `InjectToken` rewrites the HTTPS URL to include the PAT as userinfo (`https://x-access-token:<token>@github.com/...`). SSH URLs are left unchanged. Disables HTTP redirects via git config env vars (`GIT_CONFIG_KEY_0=http.followRedirects`, `GIT_CONFIG_VALUE_0=false`) to prevent SSRF via redirect.

**Token safety:** If the clone fails, any error output is sanitized — the token string is replaced with `***` before being included in the error message.

### Token Injection

`InjectToken(rawURL, token)` inserts a GitHub PAT into HTTPS git URLs:
- Empty token or SSH URLs (`git@...`) → returns URL unchanged
- HTTPS URLs → sets `url.User` to `x-access-token:<token>` (the standard GitHub PAT auth method)
- Non-HTTPS or unparseable URLs → returns URL unchanged

### URL Validation

Accepts two formats:
- **HTTPS:** Must use `https://` scheme
- **SSH:** Must match `^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9_./-]+$`

After parsing, resolves the hostname via DNS and checks all returned IPs against private network ranges.

### SSRF Protection

Blocked IP ranges:
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918)
- `127.0.0.0/8` (loopback)
- `169.254.0.0/16` (link-local)
- `::1/128` (IPv6 loopback)
- `fc00::/7` (IPv6 unique local)
- `fe80::/10` (IPv6 link-local)

DNS resolution has a 5-second timeout.

## Auth Middleware

`internal/api/middleware/auth.go` (41 lines)

- If `API_KEY` is empty, all requests are allowed (development mode)
- `/api/health` is always exempt (Docker healthcheck)
- Checks `Authorization: Bearer <token>` header first
- Falls back to `?token=<value>` query parameter (needed for WebSocket — browsers cannot send custom headers during upgrade)
- Returns 401 on mismatch

## Graceful Shutdown Flow

```
SIGINT/SIGTERM received
       │
       ▼
Cancel server context
  (aborts in-progress clones)
       │
       ▼
Manager.StopAll(ctx)
  (concurrent SIGTERM to all runners, with timeout)
       │
       ▼
Server.Shutdown()
  (drain in-flight HTTP requests)
       │
       ▼
Log any errors, exit
```
