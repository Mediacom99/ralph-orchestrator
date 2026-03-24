<div align="center">

# 🤖 Ralph Orchestrator

**AI-powered development pipelines, orchestrated.**

Point it at a repo. Define your objectives. Watch AI agents plan, code, test, and commit.

[![CI](https://github.com/Mediacom99/ralph-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/Mediacom99/ralph-orchestrator/actions/workflows/ci.yml)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![Fiber](https://img.shields.io/badge/Fiber-v2-00ACD7?logo=go&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## ⚡ What is this?

Ralph Orchestrator is a **Go REST API** that manages automated development cycles ("loops"). Each loop:

```
📦 Clone repo → 📋 Read objectives → 🤖 Run AI agent → ✅ Test → 📝 Commit
```

Everything streams in real-time through **WebSockets** to a built-in React dashboard.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Ralph Orchestrator              │
├──────────────┬──────────────┬───────────────────┤
│   🌐 API     │   🧠 Core    │   💾 Storage      │
│              │              │                   │
│  Fiber v2    │  Loop Mgr    │  SQLite           │
│  WebSocket   │  Git Clone   │  Settings Store   │
│  Auth MW     │  Agent Runner│  Loop State       │
│  SPA Embed   │  Event Bus   │                   │
├──────────────┴──────────────┴───────────────────┤
│                 🎨 Dashboard                     │
│           React + TypeScript + Vite              │
└─────────────────────────────────────────────────┘
```

```
cmd/orchestrator/       → Entry point
internal/
  api/                  → HTTP server, handlers, middleware
  config/               → Environment-based config
  events/               → Real-time event bus
  git/                  → Repository cloning
  ralph/                → AI agent lifecycle management
  store/                → Persistence layer
web/                    → React + TypeScript dashboard
deploy/                 → Docker, systemd, install script
```

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Mediacom99/ralph-orchestrator.git
cd ralph-orchestrator

# Configure
cp .env.example .env
# Add your GitHub token + Anthropic API key

# Build & Run
go build -o ralph ./cmd/orchestrator
./ralph
```

Dashboard at `http://localhost:3001`

---

## 📡 API

| Method | Endpoint | Description |
|:------:|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/loops` | List all loops |
| `POST` | `/api/loops` | Create a new loop |
| `POST` | `/api/loops/:id/start` | Start a loop |
| `POST` | `/api/loops/:id/stop` | Stop a loop |
| `DELETE` | `/api/loops/:id` | Delete a loop |
| `GET` | `/api/settings` | Get settings |
| `PUT` | `/api/settings` | Update settings |
| `WS` | `/ws` | Real-time events stream |

---

## 🐳 Deploy

```bash
# Docker
docker build -t ralph-orchestrator .
docker run -p 3001:3001 --env-file .env ralph-orchestrator

# Or systemd — see deploy/ folder
```

Full deployment guide → [DEPLOY.md](DEPLOY.md)

---

## 🛠️ Tech Stack

| | Technology | Role |
|---|---|---|
| 🔵 | **Go 1.24** | Backend runtime |
| ⚡ | **Fiber v2** | HTTP framework |
| 🔌 | **WebSocket** | Real-time streaming |
| 💾 | **SQLite** | Persistence |
| ⚛️ | **React + TypeScript** | Dashboard |
| 🏗️ | **Vite** | Frontend build |
| 🐳 | **Docker** | Containerization |
| ⚙️ | **GitHub Actions** | CI pipeline |

---

## 📄 License

MIT

