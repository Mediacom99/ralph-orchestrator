# Ralph Orchestrator

A Go REST API that orchestrates AI-powered development pipelines. Point it at a GitHub repo, define your objectives, and let AI agents handle the implementation cycle — planning, coding, testing, and committing.

Built with **Go**, **Fiber**, **SQLite**, and **WebSockets** for real-time monitoring.

## What it does

Ralph Orchestrator manages "loops" — automated development cycles where an AI coding agent (Claude Code) clones a repo, reads the objectives, implements changes, runs tests, and commits. You control everything through a web dashboard or the REST API.

Each loop:
1. Clones the target repository
2. Reads the project objectives (PROMPT.md)
3. Executes the AI agent in a sandboxed environment
4. Streams real-time progress via WebSocket
5. Commits changes back to the repo

## Architecture

```
cmd/orchestrator/       → Entry point
internal/
  api/                  → Fiber HTTP server + WebSocket handlers
    handlers/           → REST endpoints (loops, health, settings)
    middleware/         → Auth middleware (API key)
  config/              → Environment-based configuration
  events/              → Event bus for real-time updates
  git/                 → Repository cloning and management
  ralph/               → AI agent lifecycle (install, run, stop)
  store/               → SQLite persistence (loops, settings)
web/                   → React + TypeScript dashboard
deploy/                → Dockerfile, systemd service, install script
```

## Quick Start

```bash
# Clone and build
git clone https://github.com/Mediacom99/ralph-orchestrator.git
cd ralph-orchestrator
go build -o ralph ./cmd/orchestrator

# Configure
cp .env.example .env
# Edit .env with your GitHub token and Anthropic API key

# Run
./ralph
```

The dashboard is available at `http://localhost:PORT` (default: 3001).

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/loops` | List all loops |
| POST | `/api/loops` | Create a new loop |
| POST | `/api/loops/:id/start` | Start a loop |
| POST | `/api/loops/:id/stop` | Stop a loop |
| DELETE | `/api/loops/:id` | Delete a loop |
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |
| GET | `/ws` | WebSocket for real-time events |

## Deployment

Docker and systemd configurations are included in `deploy/`. See [DEPLOY.md](DEPLOY.md) for detailed instructions.

```bash
# Docker
docker build -t ralph-orchestrator .
docker run -p 3001:3001 --env-file .env ralph-orchestrator
```

## Tech Stack

- **Go 1.24** with Fiber v2 (HTTP) and gorilla/websocket
- **SQLite** via JSON file store for persistence
- **React + TypeScript** dashboard with Vite
- **Docker** + systemd for deployment
- **GitHub Actions** CI pipeline

## License

MIT
