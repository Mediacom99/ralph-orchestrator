# Deployment & Operations

## Docker Multi-Stage Build

`Dockerfile` (45 lines)

The build uses four stages to minimize the final image:

### Stage 1: Frontend Build

```dockerfile
FROM node:20-alpine AS frontend
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build
```

Produces `web/dist/` with optimized, hashed static assets.

### Stage 2: Go Binary Build

```dockerfile
FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o orchestrator ./cmd/orchestrator
```

- `CGO_ENABLED=0` produces a statically linked binary (no C dependencies)
- `-ldflags="-w -s"` strips debug info and symbol table for smaller binary
- Frontend assets are embedded via `//go:embed all:web/dist`

### Stage 3: Ralph Installation

```dockerfile
FROM node:20-alpine AS ralph-installer
RUN apk add --no-cache git bash
RUN npm install -g @anthropic-ai/claude-code
RUN git clone --depth 1 https://github.com/frankbria/ralph-claude-code.git /tmp/ralph \
    && cd /tmp/ralph && bash install.sh && rm -rf /tmp/ralph
```

Installs both `claude` (Claude Code CLI) and `ralph` binaries.

### Stage 4: Runtime

```dockerfile
FROM alpine:3.21
RUN apk add --no-cache git bash
RUN mkdir -p /data
COPY --from=builder /app/orchestrator .
COPY --from=ralph-installer /usr/local/bin/ralph /usr/local/bin/ralph
COPY --from=ralph-installer /usr/local/bin/claude /usr/local/bin/claude
RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
RUN chown -R app:app /data /app
USER app
EXPOSE 8080
ENV DATA_DIR=/data
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["./orchestrator"]
```

Final image contains only:
- Alpine base (~5MB)
- `git` and `bash` (runtime dependencies)
- `orchestrator` binary (statically linked)
- `ralph` and `claude` binaries
- Non-root `app` user

### Building

```bash
docker build -t ralph-orchestrator .
```

### Running

```bash
docker run -d \
  -p 8080:8080 \
  -e API_KEY=your-secret-key \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ralph-data:/data \
  ralph-orchestrator
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP listen port |
| `DATA_DIR` | No | `data` (local) / `/data` (Docker) | Root directory for loops.json and repos |
| `LOG_LEVEL` | No | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `DEV_MODE` | No | `false` | Skip embedded SPA, use Vite dev proxy |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173, http://localhost:8080` | CORS allowed origins (comma-separated) |
| `CLONE_TIMEOUT` | No | `5m` | Maximum time for git clone operations |
| `SHUTDOWN_TIMEOUT` | No | `30s` | Maximum time for graceful shutdown |
| `API_KEY` | Recommended | (empty = no auth) | Bearer token for API authentication |
| `ANTHROPIC_API_KEY` | Yes (for ralph) | — | Anthropic API key passed to ralph subprocesses |

## Health Check Endpoint

```
GET /api/health
```

Response:
```json
{"status": "ok"}
```

- Always returns 200 if the server is running
- Exempt from authentication (no token required)
- Used by Docker HEALTHCHECK (wget every 30s)
- Can be used by load balancers, Kubernetes probes, or monitoring systems

Docker HEALTHCHECK configuration:
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 5 seconds (grace period for startup)
- Retries: 3 (mark unhealthy after 3 consecutive failures)

## Dev Mode Setup

### Prerequisites

- Go 1.24+
- Node.js 20+ (via fnm: `export PATH="$HOME/.local/share/fnm/aliases/default/bin:$PATH"`)
- `ralph-claude-code` installed (or let the server auto-install it)

### Backend

```bash
# From repo root
DEV_MODE=true LOG_LEVEL=debug go run ./cmd/orchestrator
```

`DEV_MODE=true` skips the embedded SPA middleware, so the Go server only serves API and WebSocket routes on `:8080`.

### Frontend

```bash
# From web/ directory
cd web && npm install && npm run dev
```

Vite dev server starts on `:5173` with HMR. The `vite.config.ts` proxies:
- `/api/*` → `http://localhost:8080`
- `/ws` → `ws://localhost:8080`

### Full Workflow

1. Terminal 1: `DEV_MODE=true go run ./cmd/orchestrator`
2. Terminal 2: `cd web && npm run dev`
3. Open `http://localhost:5173` in browser

Changes to React code hot-reload instantly. Changes to Go code require restarting the server.

## Build Commands

### Frontend Only

```bash
cd web && npm run build
```

Produces `web/dist/` with:
- `index.html`
- `assets/*.js` (hashed filenames)
- `assets/*.css` (hashed filenames)

### Backend Only (Without Embedded SPA)

```bash
go build ./cmd/orchestrator
```

The binary will work but serve no frontend. Use with `DEV_MODE=true` and a separate frontend.

### Full Production Build

```bash
cd web && npm ci && npm run build && cd ..
go build -ldflags="-w -s" -o orchestrator ./cmd/orchestrator
```

Frontend must be built **before** Go because the `//go:embed all:web/dist` directive requires `web/dist/` to exist at compile time.

### Running Tests

```bash
# Go tests with race detection
go test -race ./...

# Frontend tests
cd web && npm test
```

## Data Directory Structure

```
$DATA_DIR/
├── loops.json              # Persisted loop metadata
└── repos/
    ├── my-repo-abc123def4/ # Cloned repository
    │   ├── .ralph/
    │   │   ├── status.json     # Ralph loop count, API calls, status
    │   │   ├── progress.json   # Elapsed time, last output
    │   │   ├── fix_plan.md     # Markdown checklist (task tracking)
    │   │   └── logs/
    │   │       └── ralph.log   # Ralph execution log
    │   └── (repo files...)
    └── other-repo-def456ab/
        └── ...
```

- `loops.json` is the single source of truth for loop metadata
- Each loop has a directory under `repos/` named `{repo-name}-{12-char-id}`
- `.ralph/` files are created by the ralph-claude-code process
- Live data (status, progress) is read from these files on demand, not persisted in `loops.json`

## CI/CD Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to `main`/`fresh-start` and on all pull requests:

1. **Lint + Test (parallel):** golangci-lint, `go test -race`, TypeScript type check, Vitest
2. **Build (after all checks):** Full frontend + backend production build
3. **Docker (push events only):** Build and push to `ghcr.io/{owner}/ralph-orchestrator:{sha}`

Docker images are tagged with the git commit SHA for traceability.
