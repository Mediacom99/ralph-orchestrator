# Deploy Ralph Orchestrator

## Option A: Direct VPS (Recommended)

Running directly on a VPS lets you use a Claude subscription (`claude login`) instead of paying per-token with an API key.

### Quick Start

```bash
# On your VPS, as root:
git clone https://github.com/mediacom99/ralph-orchestrator.git /tmp/ralph-install
cd /tmp/ralph-install
bash deploy/install.sh --binary <path-to-binary>

# Authenticate Claude (one-time):
sudo -u ralph claude login

# Start the service:
systemctl enable --now ralph-orchestrator
```

### Prerequisites

- Linux VPS (Ubuntu 22.04+, Debian 12+, etc.)
- Git, Node.js 20+, npm
- A Claude subscription **or** an `ANTHROPIC_API_KEY`

### Manual Setup

1. Create a system user:
   ```bash
   useradd --system --create-home --shell /bin/bash ralph
   ```

2. Install dependencies:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

3. Place the binary at `/opt/ralph-orchestrator/orchestrator`

4. Copy the systemd unit:
   ```bash
   cp deploy/ralph-orchestrator.service /etc/systemd/system/
   systemctl daemon-reload
   ```

5. Authenticate Claude as the service user:
   ```bash
   sudo -u ralph claude login
   ```

6. Start:
   ```bash
   systemctl enable --now ralph-orchestrator
   ```

### Configuration

Edit `/opt/ralph-orchestrator/.env` (see `deploy/.env.example`):

```bash
# Only needed if NOT using claude login:
# ANTHROPIC_API_KEY=sk-ant-...

# Optional:
# GITHUB_TOKEN=ghp_...
# API_KEY=my-secret-bearer-token
# LOG_LEVEL=debug
```

You can also configure the Anthropic API key and GitHub token from the Settings UI.

---

## Option B: Docker

Requires an `ANTHROPIC_API_KEY` (subscription auth is not supported in Docker).

### Pull the image

```bash
docker pull ghcr.io/mediacom99/ralph-orchestrator:latest
```

### Run

```bash
docker run -d \
  --name ralph \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ralph-data:/data \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  ghcr.io/mediacom99/ralph-orchestrator:latest
```

To pass optional environment variables, add more `-e` flags:

```bash
docker run -d \
  --name ralph \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ralph-data:/data \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e GITHUB_TOKEN="ghp_..." \
  -e API_KEY="my-secret-bearer-token" \
  -e LOG_LEVEL="debug" \
  ghcr.io/mediacom99/ralph-orchestrator:latest
```

### Update

Pull the latest image, stop the old container, and start a new one.
The named volume `ralph-data` keeps your data across updates.

```bash
docker pull ghcr.io/mediacom99/ralph-orchestrator:latest
docker stop ralph && docker rm ralph
docker run -d \
  --name ralph \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ralph-data:/data \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  ghcr.io/mediacom99/ralph-orchestrator:latest
```

---

## Verify

```bash
curl http://localhost:8080/api/health
```

You should get a 200 response. Open `http://<your-vps-ip>:8080` in a browser to access the UI.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | No* | — | Anthropic API key for claude-code |
| `GITHUB_TOKEN` | No | — | GitHub PAT for cloning private repos |
| `API_KEY` | No | — | Bearer token to protect the API |
| `PORT` | No | `8080` | Server port |
| `DATA_DIR` | No | `/data` | Data directory |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `CLONE_TIMEOUT` | No | `5m` | Max repo clone duration (Go duration) |
| `SHUTDOWN_TIMEOUT` | No | `30s` | Graceful shutdown wait (Go duration) |

\* Not needed when using `claude login` subscription auth (VPS deployment).
