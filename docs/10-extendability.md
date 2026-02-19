# Extendability & Future Work

## Clean Extension Points

### Adding New API Endpoints

The routing is centralized in `internal/api/server.go`. Adding a new endpoint requires:

1. Create a handler function in `internal/api/handlers/`
2. Register the route in `server.go`'s `NewServer()` function
3. The middleware stack (auth, security headers, CORS) applies automatically

Example: adding a `PATCH /api/loops/:id` endpoint for updating loop configuration would follow the same pattern as the existing handlers.

### Adding New Event Types

The EventBus (`internal/events/bus.go`) is type-agnostic — events are `struct { Type string; LoopID string; Data any }`. To add a new event:

1. Publish with a new `Type` string (e.g., `"loop_restarted"`)
2. Frontend `useWebSocket` already forwards all events to `onEvent()` — no change needed
3. Add frontend handling if the event needs specific UI treatment

### Adding New Status File Readers

The `EnrichLoop()` function in `internal/ralph/status.go` reads three files from `.ralph/`. To add a new data source:

1. Add a new reader function (e.g., `ReadMetrics()`)
2. Add the corresponding field to the `Loop` model in `internal/store/models.go`
3. Add the field to the frontend `Loop` type in `web/src/api/types.ts`
4. Call the reader in `EnrichLoop()` — it's already cached with a 2-second TTL

### Adding New Frontend Components

The component tree is shallow (3 levels). Adding a new view or feature:

1. Create a component in `web/src/components/`
2. Add it to `App.tsx` (or to `LoopCard.tsx` if it's loop-specific)
3. If it needs data from the API, add a method to `web/src/api/client.ts`
4. If it needs a new API endpoint, add the backend handler first

### Adding New Middleware

Fiber middleware is registered in `server.go`. The order matters:

1. Recovery (first — catches panics from all other middleware)
2. Security headers
3. CORS
4. Auth
5. (new middleware would go here)
6. Routes

Example: adding request logging, rate limiting, or request ID generation would be straightforward additions to this chain.

## Missing Features / Roadmap Ideas

### Multi-User Support

The current auth is a single shared API key. For team use:
- User accounts with role-based access (admin, viewer)
- Per-user loop ownership
- Audit logging of actions

### Loop Configuration

Currently loops have no configurable parameters beyond the git URL. Potential additions:
- Custom ralph arguments or flags
- Environment variable overrides per loop
- Max loop iterations limit
- Scheduled start/stop

### Notifications

No alerting when loops complete, fail, or encounter errors:
- Webhook callbacks (POST to a URL on status change)
- Email notifications
- Slack/Discord integration

### Loop Templates

No way to save and reuse loop configurations:
- Named templates with pre-filled git URLs and settings
- Quick-launch from templates

### Bulk Operations

No batch actions:
- Start/stop/delete multiple loops at once
- Select-all functionality

### Search and Filtering

The loop list shows all loops without filtering:
- Filter by status (running, stopped, failed)
- Search by repo name or URL
- Sort by creation date, status, or activity

### Persistent Logs

Logs are only available while the repo directory exists. After deletion, logs are lost:
- Archive logs before deletion
- Centralized log storage
- Log rotation for long-running loops

### Metrics and Dashboards

No aggregate metrics:
- Total API calls across all loops
- Success/failure rates
- Historical charts

## Architectural Limitations

### Single-Process Model

The orchestrator runs as a single process. This means:

- **No horizontal scaling.** Multiple instances would each manage their own subprocesses and JSON store, with no coordination.
- **Process limit.** Each ralph loop is an OS process. The practical limit depends on memory and CPU, but there's no built-in cap.
- **Restart loses running state.** On restart, all running loops are marked as stopped. The startup reconciliation handles this gracefully, but running processes are not re-attached.

To support multiple instances, the architecture would need:
- A shared database (PostgreSQL, etc.) instead of a JSON file
- A process supervision layer (systemd, Kubernetes) instead of in-process management
- Distributed event broadcasting (Redis pub/sub, NATS) instead of in-process channels

### JSON File Store

The JSON file store is simple but has limits:

- **Memory bound.** All loops are held in memory. With thousands of loops, memory usage grows linearly.
- **Write contention.** Every write flushes the entire file. With many concurrent writes, this becomes a bottleneck.
- **No queries.** Filtering, sorting, and searching must be done in application code after loading all data.
- **No migration system.** Schema changes require manual migration of the JSON file.

For scale beyond ~100 loops, consider SQLite (single-file, embedded) or PostgreSQL.

### No Queue / Job System

Clone operations and process starts run as background goroutines with no retry, priority, or queue semantics. For production use:
- A work queue would prevent unbounded concurrent clones
- Retry logic with backoff would handle transient failures
- Priority would let important loops start first

### WebSocket Fan-Out

Every WebSocket client receives every event (filtered only by optional `loop_id`). With many clients watching many loops:
- The EventBus iterates all subscribers for every event
- Channel buffers (64) may overflow for slow clients
- No message deduplication or batching

## Scalability Considerations

### Current Capacity

The architecture is suitable for:
- **Loops:** 10–50 concurrent ralph processes (limited by CPU/memory for subprocess overhead)
- **WebSocket clients:** ~100 concurrent connections (limited by goroutine overhead and event fan-out)
- **API throughput:** ~1000 requests/second (limited by JSON store mutex and file I/O)

### Bottlenecks at Scale

1. **JSON file store.** Every write serializes all loops and flushes to disk. At >100 loops, this becomes the primary bottleneck.
2. **Enrichment I/O.** Even with 2-second caching, listing 50 loops requires reading up to 150 files (3 per loop) every 2 seconds.
3. **Process management.** Each ralph process consumes memory and CPU. The OS process table and CPU scheduling become limiting factors.
4. **EventBus broadcast.** O(subscribers) per event, with non-blocking writes that drop events for slow consumers.

### Scaling Strategies

1. **Vertical:** Run on a larger machine with more CPU and memory. The single-process model works well here.
2. **Database migration:** Replace JSON store with SQLite for better write performance and querying.
3. **Process limits:** Add a configurable maximum concurrent loops to prevent resource exhaustion.
4. **Enrichment batching:** Instead of per-request enrichment, run a background goroutine that periodically reads all status files and caches results.
5. **WebSocket namespacing:** Shard subscribers by loop ID to reduce broadcast overhead.
