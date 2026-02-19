# Project Overview

## What Is Ralph Orchestrator?

Ralph Orchestrator is a web-based management tool for running multiple [ralph-claude-code](https://github.com/frankbria/ralph-claude-code) loops simultaneously. Each "loop" represents an autonomous coding agent that clones a Git repository, analyzes its codebase, and iteratively makes improvements using Claude.

The orchestrator solves the problem of managing these autonomous coding agents at scale: creating them, monitoring their progress in real time, reading their logs, and controlling their lifecycle — all from a single dashboard.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Single Go Binary                  │
│                                                     │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │  Embedded     │    │  Go Backend (Fiber)       │  │
│  │  React SPA    │    │                           │  │
│  │  (web/dist)   │◄──►│  REST API  (/api/...)     │  │
│  │               │    │  WebSocket (/ws)          │  │
│  └──────────────┘    │  Auth Middleware           │  │
│                      │  Security Headers          │  │
│                      └─────────┬─────────────────┘  │
│                                │                    │
│                      ┌─────────▼─────────────────┐  │
│                      │  Core Services             │  │
│                      │                           │  │
│                      │  Manager → Runner(s)      │  │
│                      │  EventBus → WebSocket     │  │
│                      │  Store (JSON file)        │  │
│                      │  Git (clone + SSRF guard) │  │
│                      └───────────────────────────┘  │
│                                │                    │
│                      ┌─────────▼─────────────────┐  │
│                      │  OS Processes              │  │
│                      │  ralph (loop 1)            │  │
│                      │  ralph (loop 2)            │  │
│                      │  ralph (loop N)            │  │
│                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

The application compiles to a **single binary** that embeds the React frontend via Go's `embed` package. No separate web server, no static file hosting — just one process serving both API and UI.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Go | 1.24 |
| Web framework | Fiber | v2 |
| Frontend | React | 19 |
| Language (frontend) | TypeScript | 5.7 |
| CSS | Tailwind CSS | v4 |
| Bundler | Vite | 6 |
| Testing (Go) | stdlib `testing` | — |
| Testing (frontend) | Vitest + Testing Library | 4 / 16 |
| CI/CD | GitHub Actions | — |
| Container | Docker (multi-stage) | Alpine 3.21 |
| Data store | JSON file | — |

## Key Design Decisions

- **No database.** All state is persisted to a single JSON file (`loops.json`) with atomic writes. This keeps deployment simple — no external dependencies.
- **No external auth provider.** Authentication is a single bearer token set via environment variable. Empty token disables auth entirely (development mode).
- **Embedded SPA.** The React frontend is compiled into the Go binary at build time, eliminating the need for a separate web server or CDN.
- **Process groups.** Each ralph subprocess runs in its own process group so that `SIGTERM`/`SIGKILL` kills the entire tree, preventing orphaned processes.
- **Event-driven updates.** An in-process EventBus pushes events to WebSocket clients. The frontend uses adaptive polling (fast when WS is down, slow when connected) as a fallback.

## Project Status

The project is in active development on the `fresh-start` branch. Core functionality is complete:

- Loop CRUD (create, read, update, delete)
- Git clone with SSRF protection
- Process lifecycle management (start, stop, graceful shutdown)
- Real-time monitoring via WebSocket
- Live log tailing
- Progress tracking from ralph status files
- Bearer token authentication
- Docker deployment with multi-stage build
- CI pipeline (lint, test, build, Docker push)
- 16 frontend tests and Go tests covering store, config, git, handlers, and auth

See [10-extendability.md](10-extendability.md) for known gaps and future work.
