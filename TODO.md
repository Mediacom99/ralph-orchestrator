# TODO — Ralph Orchestrator

## 🔴 Must have (before deploy)

- [ ] **Branch selector** — when creating or starting a loop, allow choosing which git branch to run Ralph on (currently not supported)
- [ ] **Redo the UI** — current UI needs a full redesign from scratch

## 🟡 High priority

- [ ] **Log viewer** — in-UI log viewer with scroll and search (currently logs are raw terminal output only)
- [ ] **Restart loop** — restart a loop from UI without manual stop + start
- [ ] **Task progress** — real-time fix_plan.md task status with progress bar (done/total, % complete) — like the ralph.html dashboard
- [ ] **Multi-project overview** — aggregated view of all active loops: name, status, task %, last action
- [ ] **Telegram notification on completion/failure** — trigger notification when loop exits (graceful complete or error), not just while running
- [ ] **Verify claude login flow** — check whether API key is truly optional when `claude login` is already authenticated; fix if it's being required unnecessarily

## 🟢 Nice to have

- [ ] **PROMPT.md editor** — edit loop objectives from UI without SSH
- [ ] **Loop history** — per-loop stats: runs, tasks completed, commits made, duration
- [ ] **Diff viewer** — show latest commits made by Ralph directly in UI (git log + diff)
- [ ] **Budget cap** — stop loop after N API calls or N hours of runtime
- [ ] **Auto-install claude code** — detect if `claude` is missing and offer install flow

## 📝 Notes

- `claude login` (subscription) should be supported as alternative to `ANTHROPIC_API_KEY` — verify this works correctly in production
- SQLite is used to persist loop list across restarts — good, keep it
- WebSocket for real-time updates — keep, works well
