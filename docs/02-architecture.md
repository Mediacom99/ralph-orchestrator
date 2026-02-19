# Architecture & Design

## System Architecture

```
                          Browser
                            │
                 ┌──────────┴──────────┐
                 │  HTTP / WebSocket    │
                 └──────────┬──────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Fiber HTTP Server      │
              │                            │
              │  Middleware Stack:          │
              │  1. Recovery (panic)        │
              │  2. Security Headers        │
              │  3. CORS                    │
              │  4. Bearer Auth             │
              │                            │
              │  Routes:                   │
              │  GET  /api/health           │
              │  GET  /api/settings         │
              │  PUT  /api/settings         │
              │  GET  /api/loops            │
              │  POST /api/loops            │
              │  GET  /api/loops/:id        │
              │  POST /api/loops/:id/start  │
              │  POST /api/loops/:id/stop   │
              │  DEL  /api/loops/:id        │
              │  GET  /api/loops/:id/logs   │
              │  GET  /ws                   │
              │  GET  /* (SPA fallback)     │
              └──┬─────┬─────┬─────┬──────┘
                 │     │     │     │
      ┌──────────▼┐ ┌──▼──┐ ┌▼────▼────┐ ┌──────────┐
      │   Store    │ │ Git │ │ Manager  │ │ EventBus │
      │ (JSON)     │ │     │ │          │ │          │
      │            │ │     │ │ Runner 1 │ │ pub/sub  │
      │ loops.json │ │     │ │ Runner 2 │ │ channels │
      │            │ │     │ │ Runner N │ │          │
      └────────────┘ └─────┘ └──────────┘ └──────────┘
                                  │
                         ┌────────▼────────┐
                         │  OS Processes    │
                         │  (ralph binary)  │
                         └─────────────────┘
```

## Backend Package Structure

```
.
├── cmd/orchestrator/
│   └── main.go              # Entry point, startup sequence
├── embed.go                 # //go:embed all:web/dist
├── internal/
│   ├── api/
│   │   ├── server.go        # Fiber app setup, middleware, routes
│   │   ├── spa.go           # Embedded SPA serving with fallback
│   │   ├── handlers/
│   │   │   ├── health.go    # GET /api/health
│   │   │   ├── loops.go     # All loop CRUD + start/stop handlers
│   │   │   ├── settings.go  # GET/PUT /api/settings (GitHub PAT)
│   │   │   └── ws.go        # WebSocket upgrade + event streaming
│   │   └── middleware/
│   │       └── auth.go      # Bearer token authentication
│   ├── config/
│   │   └── config.go        # Environment variable loading + validation
│   ├── events/
│   │   └── bus.go           # In-process event pub/sub
│   ├── git/
│   │   └── clone.go         # Git clone with SSRF protection
│   ├── ralph/
│   │   ├── installer.go     # ralph-claude-code auto-installation
│   │   ├── manager.go       # Registry of running ralph processes
│   │   ├── runner.go        # Individual process lifecycle
│   │   └── status.go        # Read/cache .ralph/ status files
│   └── store/
│       ├── models.go        # Loop, RalphStatusData, ProgressData types
│       ├── settings.go      # Settings persistence (GitHub PAT)
│       └── store.go         # JSON file persistence with atomic writes
├── Dockerfile               # Multi-stage build
└── web/                     # React frontend (see 04-frontend.md)
```

### Package Responsibilities

| Package | Responsibility |
|---------|---------------|
| `cmd/orchestrator` | Bootstrap: load config, init services, wire dependencies, handle signals |
| `internal/api` | HTTP server setup, SPA serving, route registration |
| `internal/api/handlers` | Request handling, input validation, response formatting |
| `internal/api/middleware` | Cross-cutting concerns (auth) |
| `internal/config` | Environment variable parsing with defaults and validation |
| `internal/events` | Decoupled event broadcasting (EventBus) |
| `internal/git` | Git operations with security (SSRF protection, URL validation) |
| `internal/ralph` | ralph-claude-code process management and status reading |
| `internal/store` | Persistence layer (JSON files with atomic writes: loops + settings) |

## Frontend Component Tree

```
<StrictMode>
  <ErrorBoundary>
    <App>
      ├── <AuthPrompt />         (conditional: auth required)
      ├── <SettingsPanel />      (conditional: settings open)
      ├── Header
      │   ├── Title
      │   ├── WS Indicator       (green/red dot)
      │   ├── Settings Button
      │   └── <NewLoopForm />
      ├── Error Banner           (conditional: API error)
      ├── Loading State          (conditional: first load)
      └── <LoopList>
          └── <LoopCard>         (for each loop)
              ├── Status Badge
              ├── Stats (loop count, calls, elapsed)
              ├── <ProgressBar /> (conditional: has tasks)
              ├── Action Buttons  (Start/Stop/Delete)
              └── <LiveLog />     (conditional: modal open)
```

## Data Flow

### REST API Flow

```
User Action → Component → api.client → fetch(/api/...) → Fiber Handler
                                                              │
                                                    Store / Manager / Git
                                                              │
                                                         JSON Response
                                                              │
Component ← useState update ← api.client ← Response ◄────────┘
```

### Real-Time Event Flow

```
ralph process writes to .ralph/status.json
         │
LoopHandler enriches loop data from .ralph/ files (cached 2s)
         │
Background goroutine detects state change
         │
EventBus.Publish(event)
         │
    ┌────▼────────────────────┐
    │ For each subscriber:     │
    │   if loopID matches:     │
    │     send to channel      │
    └────┬────────────────────┘
         │
WebSocket handler reads from channel
         │
JSON frame sent to browser
         │
useWebSocket.onEvent() fires
         │
useLoops.refresh() fetches fresh data via REST
         │
React re-renders with updated loop state
```

### Adaptive Polling

The frontend uses a dual strategy for freshness:

1. **WebSocket connected** → poll every 30 seconds (backup)
2. **WebSocket disconnected** → poll every 5 seconds (primary)
3. **Any WebSocket event** → immediate refresh

This ensures the UI stays current even when the WebSocket connection drops.

## Embedded SPA Pattern

The React frontend is embedded into the Go binary at compile time:

```go
// embed.go
//go:embed all:web/dist
var EmbeddedWebDist embed.FS
```

At runtime, `spa.go` serves this embedded filesystem:

1. `/assets/*` → serve with 30-day cache headers (hashed filenames)
2. `/api/*`, `/ws` → skip SPA, handled by API routes
3. Any other path → try file first, then fall back to `index.html` (SPA client-side routing)

In development (`DEV_MODE=true`), the SPA middleware is skipped entirely. Vite's dev server proxies `/api` and `/ws` to the Go backend.

## Event System

The `EventBus` is a simple in-process pub/sub system:

- **Publishers:** Handler functions publish events after state changes (loop created, started, stopped, deleted, clone failed/complete)
- **Subscribers:** Each WebSocket connection subscribes with an optional `loop_id` filter
- **Channel buffer:** 64 events per subscriber; slow subscribers get dropped events with a warning log
- **Thread safety:** `sync.RWMutex` protects the subscriber map

Event types: `loop_created`, `clone_failed`, `clone_complete`, `loop_started`, `loop_stopped`, `loop_deleted`, `status_update`

## Data Persistence

The `Store` uses a JSON file with these properties:

- **In-memory map** (`map[string]*Loop`) for fast reads
- **Atomic writes:** marshal → write temp file → rename (prevents corruption)
- **Copy semantics:** `Get()` and `List()` return copies, not pointers
- **Atomic update:** `Update(id, fn)` applies a callback under write lock then flushes
- **Thread safety:** `sync.RWMutex` allows concurrent reads

The store file is at `$DATA_DIR/loops.json`. Live data (`ralph_status`, `progress`) is **not** persisted — it's read from `.ralph/` files on demand and cached for 2 seconds.

## Process Management Model

```
Manager (registry)
  │
  ├── Runner (loop-abc123)
  │     ├── exec.Cmd (ralph binary)
  │     ├── Process group (Setpgid=true)
  │     ├── Filtered environment
  │     ├── done channel (closed on exit)
  │     └── stopping flag (prevents duplicate Stop)
  │
  ├── Runner (loop-def456)
  │     └── ...
  └── ...
```

- **Manager** holds a map of loop ID → Runner. Thread-safe via `RWMutex`.
- **Runner** wraps `exec.Cmd` with lifecycle: Start → (running) → Stop. Stop sends SIGTERM to the process group, waits 10s, then SIGKILL.
- **Exit watcher** is a background goroutine per runner that calls `cmd.Wait()` and updates the store when the process exits.
- **Graceful shutdown** (`StopAll`) stops all runners concurrently with a context timeout.
