# Testing & CI/CD

## Go Test Coverage

### Store Tests

`internal/store/store_test.go` (134 lines)

| Test | What It Verifies |
|------|-----------------|
| `TestSaveAndGet` | Basic CRUD: save a loop, retrieve it by ID |
| `TestGetReturnsCopy` | Mutation isolation: modifying returned loop doesn't affect store |
| `TestListReturnsCopies` | Slice copy safety: modifying list items doesn't affect store |
| `TestUpdate` | Atomic read-modify-write under lock |
| `TestUpdateMissing` | Error handling for non-existent loop |
| `TestDelete` | Removal of loop from store |
| `TestConcurrentAccess` | Thread safety with 50 concurrent goroutines doing saves and reads |
| `TestAtomicFlush` | Persistence across reloads: write, reopen store, verify data |

These tests cover the core persistence guarantees: copy semantics, atomicity, and concurrent access safety.

### Config Tests

`internal/config/config_test.go` (76 lines)

| Test | What It Verifies |
|------|-----------------|
| `TestValidateValid` | Valid configuration passes validation |
| `TestValidateEmptyDataDir` | DataDir is required |
| `TestValidateInvalidPort` | Port must be 1–65535 |
| `TestValidateNegativeTimeouts` | CloneTimeout and ShutdownTimeout must be positive |

### Git Tests

`internal/git/clone_test.go`

Tests cover:
- URL validation for HTTPS and SSH formats
- SSRF protection: private IP detection for all blocked ranges
- Repo name extraction from various URL formats

### Handler Tests

`internal/api/handlers/handlers_test.go`

Tests cover:
- Health endpoint returns `{ "status": "ok" }`
- Loop handler responses for various scenarios

The `setupTestApp` helper initializes a `SettingsStore` alongside the loop `Store`, matching the updated `NewLoopHandler` constructor signature that now requires a `*store.SettingsStore` parameter.

### Auth Middleware Tests

`internal/api/middleware/auth_test.go`

Tests cover:
- Valid bearer token passes authentication
- Invalid token returns 401
- Missing token returns 401
- Query parameter token fallback
- Empty API key disables auth
- Health endpoint bypasses auth

## Frontend Test Coverage

### Component Tests

**ProgressBar** (`components/ProgressBar.test.tsx`, 21 lines)

| Test | What It Verifies |
|------|-----------------|
| Renders percentage and task count | Displays "75%" and "3/4 tasks" |
| Clamps percentage between 0 and 100 | 150 → "100%", -10 → "0%" |

**LoopCard** (`components/LoopCard.test.tsx`, 53 lines)

| Test | What It Verifies |
|------|-----------------|
| Renders name, status, and URL | Basic content rendering |
| Shows Start button when stopped | Status-dependent button visibility |
| Shows Stop button when running | Running state shows correct action |
| Shows progress bar when data exists | Conditional rendering of progress |

Uses a `makeLoop()` helper factory for creating test data with sensible defaults.

**NewLoopForm** (`components/NewLoopForm.test.tsx`, 29 lines)

| Test | What It Verifies |
|------|-----------------|
| Opens and closes form | Toggle visibility on button click |
| Resets state on cancel | Form state clears when cancelled |

### Hook Tests

**useLoops** (`hooks/useLoops.test.ts`, 66 lines)

| Test | What It Verifies |
|------|-----------------|
| Returns loops from API | Happy path data fetching |
| Handles API error | Error state management |
| Ignores stale requests | Race condition prevention: second request supersedes first |

Mocks: `useWebSocket` returns `{ connected: false }`, `api.listLoops` is a `vi.fn()` mock.

### API Client Tests

**client.ts** (`api/client.test.ts`, 72 lines)

| Test | What It Verifies |
|------|-----------------|
| Stores and retrieves token | localStorage persistence |
| Clears token | Token removal |
| Adds auth header when token exists | Authorization header injection |
| Dispatches auth-required on 401 | Custom event dispatch on unauthorized |
| Handles fetch abort as timeout | DOMException → "Request timed out" |

Mocks: `global.fetch` is replaced with `vi.fn()` to control responses.

## CI Pipeline

`.github/workflows/ci.yml` (102 lines)

### Triggers

- Push to `main` or `fresh-start` branches
- Pull requests to any branch
- Concurrency: cancels in-progress jobs on new push to same ref

### Pipeline Flow

```
Push/PR
  │
  ├─── lint-go          (golangci-lint)
  ├─── test-go          (go test -race -coverprofile)
  ├─── lint-frontend    (npx tsc -b)
  └─── test-frontend    (npm test)
         │
         ▼ (all must pass)
       build
  (npm ci && npm run build && go build)
         │
         ▼ (push events only)
       docker
  (build + push to ghcr.io)
```

### Job Details

| Job | Runner | Steps |
|-----|--------|-------|
| `lint-go` | ubuntu-latest | Setup Go → golangci-lint |
| `test-go` | ubuntu-latest | Setup Go → `go test -race -coverprofile=coverage.out ./...` → upload artifact |
| `lint-frontend` | ubuntu-latest | Setup Node 22 → `npm ci` → `npx tsc -b` |
| `test-frontend` | ubuntu-latest | Setup Node 22 → `npm ci` → `npm test` |
| `build` | ubuntu-latest | Setup Go + Node → build frontend → build Go binary |
| `docker` | ubuntu-latest | Docker login → build → push `ghcr.io/{repo}:{sha}` |

Key details:
- Go tests run with `-race` flag (race condition detection)
- Coverage output uploaded as artifact for later analysis
- Docker job only runs on push events (not PRs)
- Docker image tagged with commit SHA

## What's Tested vs What's Not

### Well Tested

- **Store persistence:** CRUD, copy semantics, concurrency, atomic flush
- **Configuration validation:** Required fields, range checks
- **Git URL validation:** HTTPS/SSH formats, SSRF protection
- **Auth middleware:** All paths (valid, invalid, missing, query param, disabled)
- **Frontend components:** Rendering, conditional display, user interaction
- **API client:** Token management, headers, error handling, timeouts
- **Hook logic:** Data fetching, error states, race condition prevention

### Not Tested (Identified Gaps)

1. **WebSocket handler.** The `ws.go` handler has no tests. Testing WebSocket requires a running server or specialized test utilities.

2. **Ralph runner/manager.** Process management (start, stop, signal handling) is not unit tested. These involve OS processes which are harder to mock.

3. **Ralph status reader.** File reading and caching logic in `status.go` has no tests. Could test with fixture files.

4. **Ralph installer.** Auto-installation from GitHub is not tested (involves network and shell execution).

5. **SPA serving.** The embedded SPA middleware (`spa.go`) has no tests.

6. **End-to-end loop lifecycle.** No integration test that creates a loop, starts it, monitors it, and stops it.

7. **LiveLog component.** No tests for the log viewer (polling, auto-scroll, escape key).

8. **useWebSocket hook.** No tests for WebSocket connection, reconnection, or event handling.

9. **AuthPrompt component.** No tests for the auth flow.

10. **Error boundary.** No tests for error catching and recovery UI.

## Recommendations

### Short Term

1. **Add fixture-based tests for `ralph/status.go`** — create sample `.ralph/status.json`, `progress.json`, and `fix_plan.md` files and verify parsing, including edge cases (missing files, corrupt JSON, empty fix plans).

2. **Add WebSocket handler tests** — use `fasthttp/websocket` test utilities or start a test server to verify connection upgrade, event delivery, and cleanup.

3. **Add integration tests** — at minimum, test the full API flow: create loop → verify cloning → (mock ralph) → start → verify running → stop → verify stopped → delete.

### Medium Term

4. **Add coverage thresholds** — configure the CI pipeline to fail if Go or frontend coverage drops below a threshold.

5. **Test ralph runner with mock processes** — create a simple test binary that the runner can start/stop, verifying signal handling and exit detection.

6. **Add frontend E2E tests** — use Playwright or Cypress to test the full user flow through the browser.

### Long Term

7. **Property-based testing for store** — use Go's `testing/quick` or a property testing library to generate random loop data and verify store invariants.

8. **Fuzz testing for git URL validation** — use Go's built-in fuzz testing to find edge cases in URL parsing and SSRF protection.
