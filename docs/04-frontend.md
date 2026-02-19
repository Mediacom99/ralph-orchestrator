# Frontend Deep Dive

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.7 | Type safety (`strict: true`, `erasableSyntaxOnly`) |
| Tailwind CSS | v4 | Utility-first styling (imported via `@import "tailwindcss"`) |
| Vite | 6 | Dev server, HMR, production bundler |
| Vitest | 4 | Unit testing (jsdom environment) |
| Testing Library | 16 | Component testing utilities |

TypeScript constraints: `erasableSyntaxOnly` is enabled — no parameter properties in classes. `useRef()` with no argument is disallowed in React 19 types.

## Component Hierarchy

```
src/
├── main.tsx                    # Entry point, StrictMode + ErrorBoundary
├── App.tsx                     # Root component, layout, auth gate
├── api/
│   ├── client.ts               # fetch wrapper, token management
│   └── types.ts                # Loop, LoopStatus, RalphStatusData, ProgressData, SettingsResponse
├── hooks/
│   ├── useLoops.ts             # Loop data fetching + adaptive polling
│   └── useWebSocket.ts         # WebSocket connection + auto-reconnect
└── components/
    ├── ErrorBoundary.tsx        # Class component, catches unhandled errors
    ├── AuthPrompt.tsx           # Modal: API key input + verification
    ├── SettingsPanel.tsx        # Modal: GitHub PAT management
    ├── NewLoopForm.tsx          # Collapsible form: git URL + auto-start
    ├── LoopList.tsx             # Responsive grid of LoopCards
    ├── LoopCard.tsx             # Individual loop: status, stats, actions
    ├── ProgressBar.tsx          # Visual progress with task count
    └── LiveLog.tsx              # Modal: auto-scrolling log viewer
```

## Component Responsibilities

### `App` (56 lines)

Root component that manages top-level state and layout:

- **State:** `loops`, `loading`, `error`, `wsConnected`, `needsAuth`
- **Auth gate:** Listens for `ralph:auth-required` custom event dispatched by the API client on 401 responses. Shows `AuthPrompt` modal when triggered.
- **Layout:** Max-width container (`max-w-6xl`) with header, error banner, and loop grid
- **WebSocket indicator:** Green/red dot showing connection status

### `ErrorBoundary` (44 lines)

Class component wrapping the entire app. On unhandled errors, displays a red error card with the error message and a "Try Again" button that resets state.

### `AuthPrompt` (60 lines)

Modal overlay for API key entry:

1. User enters API key in a password field
2. Key is stored via `setToken()`
3. Verification call to `api.listLoops()` — if it succeeds, auth is valid
4. On failure, token is cleared and "Invalid API key" is shown

### `SettingsPanel` (129 lines)

Modal overlay for managing application settings (currently: GitHub PAT):

1. On mount, fetches current settings via `api.getSettings()`
2. Displays masked current token if one exists (e.g., `****abc1`)
3. User can enter a new token or clear the existing one
4. Save calls `api.updateSettings({ github_token })`, which persists to the backend
5. Success/error feedback displayed inline
6. Close button dismisses the modal

Opened from the "Settings" button in the header. Uses the same modal overlay pattern as `AuthPrompt` and `LiveLog`.

### `NewLoopForm` (88 lines)

Collapsible form toggled by a "+ New Loop" button:

- **Fields:** Git URL (text input), Auto-start (checkbox, default true)
- **Submission:** Calls `api.createLoop({ git_url, auto_start })`, then triggers `onCreated` callback
- **Cancel:** Resets all state and closes form

### `LoopList` (28 lines)

Responsive grid that maps loops to `LoopCard` components. Shows "No loops yet" empty state when the array is empty.

Grid breakpoints:
- `sm`: 1 column
- `md`: 2 columns
- `lg`: 3 columns

### `LoopCard` (172 lines)

The main data display component for each loop:

- **Status badge:** Color-coded pill (blue=cloning, emerald=running, gray=stopped, green=complete, red=failed/error)
- **Stats:** Loop count, API calls made, elapsed time (formatted as "45s", "2m", "1h 30m")
- **Progress bar:** Shown when `progress.tasks_total > 0`
- **Action buttons:**
  - **Start:** Visible when stopped/failed/complete
  - **Stop:** Visible when running
  - **Logs:** Opens LiveLog modal
  - **Delete:** Always visible, requires `window.confirm()` confirmation
- **Loading state:** All buttons disabled while an action is in progress. Buttons stay disabled until `onRefresh()` completes and fresh data arrives.
- **Unmount safety:** `mountedRef` prevents state updates after the component unmounts.

### `ProgressBar` (24 lines)

Pure presentational component:
- Percentage text + task count label
- Animated bar fill (`transition-all duration-500`)
- Percentage clamped to 0–100

### `LiveLog` (75 lines)

Modal overlay for viewing ralph logs:

- **Fetching:** Polls `api.getLogs(loopId, 200)` every 3 seconds with AbortController
- **Smart auto-scroll:** Only auto-scrolls when the user is within 50px of the bottom. Scrolling up disables auto-scroll so the user can read.
- **Keyboard:** Escape key closes the modal
- **Display:** Monospace font, pre-formatted whitespace

## Custom Hooks

### `useLoops` (44 lines)

Provides loop data with real-time updates:

```typescript
function useLoops(): {
  loops: Loop[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  wsConnected: boolean;
}
```

**Stale request prevention:** Uses an incrementing `requestIdRef` counter. Each fetch checks if its ID is still current before updating state, discarding results from superseded requests.

**Adaptive polling:**
- WebSocket connected → poll every 30 seconds (backup)
- WebSocket disconnected → poll every 5 seconds (primary)
- Any WebSocket event → immediate refresh via `onEvent` callback

### `useWebSocket` (74 lines)

Manages WebSocket connection with auto-reconnect:

```typescript
function useWebSocket(opts?: {
  loopId?: string;
  onEvent?: (event: WSEvent) => void;
}): { connected: boolean }
```

**Connection URL:** `ws[s]://{host}/ws?token={token}&loop_id={loopId}`

**Lifecycle:**
- `onopen` → `connected = true`
- `onmessage` → parse JSON, call `onEvent()`
- `onclose` → `connected = false`, schedule reconnect in 3 seconds
- `onerror` → close socket (triggers `onclose` reconnect)

**Cleanup:** Sets `disposed = true` flag on unmount to prevent state updates. Clears reconnect timeout and closes socket.

**Options ref:** Uses `optsRef` to hold latest options without recreating the connection effect.

## API Client Layer

`src/api/client.ts` (76 lines)

### Token Management

```typescript
export function getToken(): string    // reads from localStorage["ralph_api_token"]
export function setToken(token: string): void
export function clearToken(): void
```

### Request Function

```typescript
async function request<T>(path: string, init?: RequestInit): Promise<T>
```

Features:
- **Timeout:** 30-second AbortController. Throws "Request timed out" on abort.
- **Auth header:** Adds `Authorization: Bearer {token}` when token exists
- **Content-Type:** Auto-sets `application/json` when body is present
- **401 handling:** Clears token, dispatches `ralph:auth-required` custom event, throws "Unauthorized"
- **204 handling:** Returns `undefined as T` for no-content responses
- **Error messages:** Extracts error text from response body, falls back to HTTP status code

### API Methods

```typescript
export const api = {
  listLoops:  ()              => GET  /api/loops
  getLoop:    (id)            => GET  /api/loops/:id
  createLoop: ({git_url, auto_start}) => POST /api/loops
  startLoop:  (id)            => POST /api/loops/:id/start
  stopLoop:   (id)            => POST /api/loops/:id/stop
  deleteLoop: (id)            => DELETE /api/loops/:id
  getLogs:    (id, lines, signal) => GET /api/loops/:id/logs?lines=N
  getSettings:    ()             => GET  /api/settings
  updateSettings: ({github_token}) => PUT /api/settings
}
```

## State Management Approach

The frontend uses **no external state management library** (no Redux, Zustand, etc.). Instead:

- **Component-local state** via `useState` for UI concerns (form visibility, loading states, errors)
- **`useLoops` hook** as the single source of truth for loop data, shared at the App level
- **Props drilling** from App → LoopList → LoopCard for data and refresh callbacks
- **Custom events** (`ralph:auth-required`) for cross-cutting concerns (auth state)
- **Refs** for mutable values that shouldn't trigger re-renders (requestIdRef, mountedRef, optsRef)

This approach keeps the codebase simple and avoids the boilerplate of state management libraries. With the current component tree depth (3 levels), props drilling is not a burden.

## Real-Time Updates

The frontend combines three mechanisms:

1. **WebSocket events** — immediate notification of state changes. The EventBus publishes events for every lifecycle change (created, started, stopped, deleted, clone complete/failed). The `useWebSocket` hook receives these and triggers a full data refresh.

2. **Adaptive polling** — periodic REST calls to `/api/loops` to catch anything the WebSocket might miss. Interval adapts based on WebSocket connectivity (5s vs 30s).

3. **User-triggered refresh** — every action (start, stop, delete, create) awaits the `onRefresh()` callback, keeping buttons disabled until fresh data arrives.
