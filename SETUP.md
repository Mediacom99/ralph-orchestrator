# ralph-orchestrator

## What is this

ralph-orchestrator is a web dashboard for managing multiple [ralph-claude-code](https://github.com/anthropics/ralph-claude-code) loops. Each loop is a git repository paired with an autonomous Claude Code cycle that continuously works on the codebase — fixing issues, implementing features, running tests, and committing results.

The orchestrator lets you create loops by pointing at a git URL, start and stop them, monitor their progress in real time via WebSocket, and inspect their logs. It is a single Go binary with an embedded React frontend, backed by a JSON file store. No database required.

You run it on a VPS, put Cloudflare in front for HTTPS, and manage your autonomous coding agents from a browser.

## Architecture

```
Browser → Cloudflare (HTTPS) → VPS :8080 (HTTP) → Go / Fiber
  ├── React SPA (embedded in binary)
  ├── REST API (/api/*)
  ├── WebSocket (/ws)
  └── spawns ralph-claude-code processes
       └── reads .ralph/status.json
                 .ralph/progress.json
                 .ralph/fix_plan.md
```

The Go server embeds the built React frontend at compile time. In production there is a single static binary and nothing else to serve. The API layer manages loop lifecycle, while a background goroutine watches each spawned ralph process for exit. An event bus pushes status changes to connected browsers over WebSocket.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic API key for Claude |
| `PORT` | `8080` | HTTP server listen port |
| `DATA_DIR` | `data` | Directory for loop data and cloned repos |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `API_KEY` | *(empty)* | Bearer token for API auth (empty = no auth) |
| `GITHUB_TOKEN` | *(empty)* | GitHub PAT for cloning private repos (seeds settings on first run) |
| `ALLOWED_ORIGINS` | `http://localhost:5173, http://localhost:8080` | CORS allowed origins (comma-separated) |
| `CLONE_TIMEOUT` | `5m` | Timeout for git clone operations |
| `SHUTDOWN_TIMEOUT` | `30s` | Graceful shutdown timeout |

`DEV_MODE=true` skips embedded SPA serving (for local frontend development with Vite).

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check → `{"status":"ok"}` |
| GET | `/api/settings` | Get settings (GitHub token masked) |
| PUT | `/api/settings` | Update settings (GitHub PAT) |
| GET | `/api/loops` | List all loops (enriched with live ralph status) |
| POST | `/api/loops` | Create loop → `{"git_url":"...","auto_start":true}` |
| GET | `/api/loops/:id` | Get single loop |
| POST | `/api/loops/:id/start` | Start a stopped loop |
| POST | `/api/loops/:id/stop` | Stop a running loop |
| DELETE | `/api/loops/:id` | Delete loop and remove cloned repo |
| GET | `/api/loops/:id/logs` | Read logs → `?lines=100` |
| GET | `/ws` | WebSocket events → `?loop_id=<id>` to filter |

## How a loop works

### Lifecycle

```
create → cloning → stopped → running → complete
            ↓         ↑          ↓
          error        ←── stop ←─┤
                                   ↓
                                failed
```

When you POST to `/api/loops`, the orchestrator clones the repo into `DATA_DIR/<id>/` and sets the status to `cloning`. If the clone fails or the repo isn't ralph-enabled, the loop moves to `error`. Otherwise it moves to `stopped` (or `running` if `auto_start` was true).

Starting a loop spawns a `ralph` process in the cloned repo directory. The orchestrator watches the process in a background goroutine. While running, the ralph process writes status files that the orchestrator reads on each API request:

- `.ralph/status.json` — loop count, API calls made, current status, exit reason
- `.ralph/progress.json` — task progress, elapsed time, last output
- `.ralph/fix_plan.md` — current fix plan (if any)

When the process exits cleanly the loop moves to `complete`. If it exits with an error, it moves to `failed`. You can restart a stopped or failed loop with POST `/api/loops/:id/start`.

On server startup, any loops left in `running` or `cloning` state (from a crash) are reset to `stopped`.

## Deploy on Hetzner VPS with Docker

### Prerequisites

- A Hetzner VPS (CX22 or larger) running Ubuntu/Debian
- Docker installed (`curl -fsSL https://get.docker.com | sh`)
- A domain pointed at Cloudflare
- An Anthropic API key

### Build and run

Clone the repo and create your env file:

```bash
git clone https://github.com/edoardo/ralph-orchestrator.git
cd ralph-orchestrator

cat > .env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=8080
DATA_DIR=/data
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-domain.com
EOF
```

Build the Docker image:

```bash
docker build -t ralph-orchestrator .
```

The multi-stage Dockerfile builds the React frontend, compiles the Go binary, installs ralph-claude-code, and produces a minimal Alpine image.

Run it:

```bash
docker run -d \
  --name ralph-orchestrator \
  --restart unless-stopped \
  --env-file .env \
  -p 8080:8080 \
  -v ralph-data:/data \
  ralph-orchestrator
```

Verify it's running:

```bash
curl http://localhost:8080/api/health
# {"status":"ok"}
```

### Systemd service (auto-start on boot)

Create `/etc/systemd/system/ralph-orchestrator.service`:

```ini
[Unit]
Description=ralph-orchestrator
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop ralph-orchestrator
ExecStartPre=-/usr/bin/docker rm ralph-orchestrator
ExecStart=/usr/bin/docker run \
  --name ralph-orchestrator \
  --env-file /root/ralph-orchestrator/.env \
  -p 8080:8080 \
  -v ralph-data:/data \
  ralph-orchestrator
ExecStop=/usr/bin/docker stop ralph-orchestrator

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable ralph-orchestrator
systemctl start ralph-orchestrator
```

### Cloudflare setup

1. Add an **A record** pointing your domain to the VPS IP address
2. Set the proxy toggle to **Proxied** (orange cloud)
3. In SSL/TLS settings, set encryption mode to **Full** (not Full Strict, since the origin serves plain HTTP)
4. Cloudflare terminates HTTPS and forwards HTTP to your VPS on port 8080

### Firewall

Lock down the VPS so only Cloudflare can reach port 8080:

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS from Cloudflare only
# See https://www.cloudflare.com/ips/ for current ranges
for ip in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 \
          141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 \
          197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 \
          104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
  ufw allow from $ip to any port 8080
done

# Block everything else
ufw default deny incoming
ufw default allow outgoing
ufw enable
```

Port 8080 is not exposed to the public internet — all traffic arrives through Cloudflare's proxy.

## Updating

```bash
cd /root/ralph-orchestrator
git pull
docker build -t ralph-orchestrator .
systemctl restart ralph-orchestrator
```

The Docker volume (`ralph-data`) persists loop data across rebuilds.
