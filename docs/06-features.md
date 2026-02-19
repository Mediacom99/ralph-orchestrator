# Features & Functionality

## Feature Inventory

| Feature | Status | Backend | Frontend |
|---------|--------|---------|----------|
| Loop creation (git URL) | Complete | `POST /api/loops` | `NewLoopForm` |
| Git clone with SSRF protection | Complete | `internal/git/clone.go` | — |
| Loop start/stop | Complete | `POST /api/loops/:id/start\|stop` | `LoopCard` buttons |
| Loop deletion with cleanup | Complete | `DELETE /api/loops/:id` | `LoopCard` delete button |
| Loop listing with enrichment | Complete | `GET /api/loops` | `LoopList` grid |
| Real-time WebSocket events | Complete | `handlers/ws.go` + `events/bus.go` | `useWebSocket` hook |
| Adaptive polling fallback | Complete | — | `useLoops` hook (5s/30s) |
| Live log tailing | Complete | `GET /api/loops/:id/logs` | `LiveLog` modal |
| Progress tracking | Complete | `ralph/status.go` (fix_plan.md parser) | `ProgressBar` |
| Ralph status display | Complete | `ralph/status.go` (status.json reader) | `LoopCard` stats |
| Bearer token auth | Complete | `middleware/auth.go` | `AuthPrompt` + `client.ts` |
| Security headers (CSP, etc.) | Complete | `server.go` middleware | — |
| CORS configuration | Complete | `server.go` + `config.go` | — |
| Graceful shutdown | Complete | `main.go` signal handler | — |
| Stale loop reconciliation | Complete | `main.go` startup | — |
| Docker deployment | Complete | `Dockerfile` (multi-stage) | — |
| Health check endpoint | Complete | `GET /api/health` | — |
| CI pipeline | Complete | `.github/workflows/ci.yml` | — |
| GitHub PAT / Settings | Complete | `GET/PUT /api/settings` + `store/settings.go` | `SettingsPanel` |
| Error boundary | Complete | — | `ErrorBoundary` component |

## Loop Lifecycle

### State Machine

```
                         ┌──────────────┐
            POST /loops  │   cloning    │
           ─────────────►│              │
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │ clone     │           │ clone
                    │ success   │ not ralph │ failure
                    │           │           │
                    ▼           ▼           ▼
              ┌──────────┐  ┌──────────┐
              │  stopped  │  │  error   │
              └─────┬─────┘  └──────────┘
                    │
          POST      │
         /:id/start │
                    ▼
              ┌──────────┐
              │  running  │
              └─────┬─────┘
                    │
          ┌─────────┼──────────┐
          │         │          │
     POST │    ralph │     ralph │
    /:id/ │    exits │     exits │
     stop │    ok    │     error │
          │         │          │
          ▼         ▼          ▼
     ┌─────────┐ ┌──────────┐ ┌────────┐
     │ stopped │ │ complete │ │ failed │
     └─────────┘ └──────────┘ └────────┘
          │
          │ can be restarted
          ▼
     ┌──────────┐
     │  running  │  (loop restarts)
     └──────────┘
```

Loops in `stopped`, `failed`, or `complete` status can be restarted. The `error` status indicates a clone-time failure (invalid repo, not a ralph project, clone timeout).

### Create Flow

1. User submits git URL via `NewLoopForm`
2. Frontend calls `POST /api/loops` with `{ git_url, auto_start }`
3. Backend generates 12-char UUID, saves loop as `cloning`
4. Backend publishes `loop_created` event (WebSocket clients notified)
5. Background goroutine runs:
   - Validate URL (SSRF checks: DNS resolution, private IP blocking)
   - `git clone` with timeout (default 5 minutes)
   - Verify `.ralph/` directory exists in cloned repo
6. On success → status becomes `stopped`; if `auto_start` → immediately starts
7. On failure → status becomes `error` with reason

### Start Flow

1. User clicks "Start" button on a stopped/failed/complete loop
2. Frontend calls `POST /api/loops/:id/start`
3. Backend starts ralph process via `Manager.Start(id, dir)`
4. Runner creates process group (`Setpgid=true`), filters environment variables
5. Store updated to `running` with PID and `started_at`
6. Exit-watcher goroutine spawned to detect when process exits
7. WebSocket event `loop_started` published

### Monitor Flow (Real-Time)

While a loop is running, monitoring happens through:

1. **Enrichment on API calls:** Every `GET /api/loops` reads `.ralph/status.json`, `.ralph/progress.json`, and `.ralph/fix_plan.md` from the repo directory (cached for 2 seconds)
2. **WebSocket events:** State changes (start, stop, exit) push events immediately
3. **Log tailing:** `GET /api/loops/:id/logs?lines=200` reads the last N lines from the ralph log file using backward file reading

Displayed data:
- **Loop count:** How many fix iterations ralph has completed
- **API calls:** Calls made vs max per hour
- **Elapsed time:** Duration since start
- **Progress:** Tasks done / tasks total (from fix_plan.md checkbox counting)
- **Last output:** Most recent ralph activity

### Stop Flow

1. User clicks "Stop" button
2. Frontend calls `POST /api/loops/:id/stop`
3. Backend sends SIGTERM to the process group (ralph + all child processes)
4. Waits up to 10 seconds for graceful exit
5. If still running after 10 seconds → SIGKILL
6. Store updated to `stopped`, PID cleared, `stopped_at` set
7. WebSocket event `loop_stopped` published

### Delete Flow

1. User clicks "Delete" button, confirms via browser dialog
2. Frontend calls `DELETE /api/loops/:id`
3. Backend stops the loop if running (warn on failure)
4. Deletes from store **before** removing files (prevents exit-watcher race)
5. Removes runner from Manager, evicts enrichment cache
6. Validates `LocalPath` is under `DataDir` (path traversal protection)
7. Removes repo directory recursively
8. WebSocket event `loop_deleted` published
9. Returns 204 No Content

## Real-Time Monitoring

### WebSocket Protocol

Connection: `GET /ws?token=<token>&loop_id=<id>`

Events are JSON frames:
```json
{
  "type": "loop_started",
  "loop_id": "abc123def456",
  "data": { ... }
}
```

Event types:
- `loop_created` — new loop added
- `clone_complete` — git clone succeeded
- `clone_failed` — git clone failed (data includes error reason)
- `loop_started` — ralph process started
- `loop_stopped` — ralph process exited
- `loop_deleted` — loop removed
- `status_update` — live status change

Connection health:
- Server sends ping every 27 seconds
- Client must respond with pong within 30 seconds
- Dead connections are detected and cleaned up

### Adaptive Polling

The frontend uses `useLoops` hook with two polling intervals:

- **WebSocket connected:** Poll every 30 seconds (safety net)
- **WebSocket disconnected:** Poll every 5 seconds (primary data source)
- **On any WebSocket event:** Immediate refresh

This dual strategy ensures data freshness even when WebSocket is unavailable.

## Authentication System

### Configuration

Set `API_KEY` environment variable to enable authentication. When empty, all requests are allowed.

### Flow

1. User opens the app → frontend calls `GET /api/loops`
2. If 401 response → API client clears token, dispatches `ralph:auth-required` custom event
3. `App` component catches the event, shows `AuthPrompt` modal
4. User enters API key → stored in `localStorage["ralph_api_token"]`
5. Verification call to `GET /api/loops` — if success, modal closes
6. All subsequent requests include `Authorization: Bearer <token>` header
7. WebSocket connections pass token via `?token=<value>` query parameter (browser limitation)

### Exclusions

- `GET /api/health` is always unauthenticated (Docker healthcheck)

## Settings / GitHub PAT

The settings system allows configuring a GitHub Personal Access Token for cloning private repositories.

### Flow

1. **Env seeding:** On first startup, if `GITHUB_TOKEN` env var is set and no token is persisted, it's saved to `$DATA_DIR/settings.json`
2. **UI management:** Users can view (masked), set, or clear the token via the Settings panel (gear button in header)
3. **Clone injection:** When creating a loop, the `LoopHandler` reads the token from `SettingsStore` and passes it to `git.Clone()`. The `InjectToken` function rewrites HTTPS URLs to include the PAT as `x-access-token` userinfo
4. **Security:** Token is masked in API responses (last 4 chars only), sanitized from error output, and stored with `0o600` permissions

## Error Handling and Recovery

### Backend

- **Clone failures:** Status set to `error`, event published with reason
- **Process crashes:** Exit-watcher detects exit, updates status to `failed`
- **Stale state on restart:** Startup reconciliation resets all `running`/`cloning` loops to `stopped`
- **Concurrent operations:** Atomic `Store.Update()` prevents lost updates; Runner `stopping` flag prevents duplicate Stop work
- **Missing loop on delete:** Exit-watcher checks if loop still exists before updating (benign skip)
- **Path traversal:** Delete validates `LocalPath` is under `DataDir`

### Frontend

- **Error boundary:** Catches unhandled component errors, shows recovery UI
- **Stale request prevention:** `requestIdRef` counter in `useLoops` discards superseded responses
- **Unmount safety:** `mountedRef` in `LoopCard` prevents state updates after unmount
- **AbortController:** `LiveLog` cancels in-flight requests on unmount or new fetch
- **Request timeout:** 30-second timeout on all API calls
- **Auth recovery:** 401 triggers auth prompt without losing app state
