# Blocker autonomy

Bedlam includes a built-in blocker autonomy system: a set of database fields, an in-process scheduler, and a behavior contract that together let agents handle blocked work autonomously and surface only what genuinely needs human attention.

## The problem

Without structure, blocked issues accumulate in three failure modes:

- **Stale-blocked**: an issue is blocked on another issue, the other issue completes, but the dependent issue is never reactivated. It rots in `blocked` forever.
- **Misclassified**: agents set `status: blocked` for things humans need to fix (auth, credentials), but humans never see them — they're buried in a flat blocked list.
- **Premature**: agents block on the first failure instead of trying alternatives, treating every error as terminal.

The result: a `blocked` queue full of work that's actually unblocked, mixed with work that's genuinely stuck on humans, mixed with work that's not really stuck at all. Operators have to manually triage the entire list to find the few items that need them.

## What Bedlam provides out of the box

### 1. Structured blocker fields

Five new columns on `issues`:

| Field | Type | Purpose |
|---|---|---|
| `blockedByIssueIds` | `uuid[]` | UUIDs of issues that must complete before this one can move. Used by `blocker_reconciler` to auto-unblock when all are done. |
| `blockedReason` | `text` | One-sentence machine-readable reason. Surfaces in daily status. |
| `needsHumanAt` | `timestamptz` | Set when an issue requires human intervention. Surfaces immediately in the daily status doc's "Needs human attention" section. |
| `needsHumanReason` | `text` | One-sentence description of what the human needs to do. |
| `selfFixAttempts` | `integer` | Counter tracking how many times the agent has attempted a self-fix. Indicator of effort vs. structural blocker. |

Plus an index `issues_company_needs_human_idx` for fast querying of needs-human issues.

These fields are part of the `issues` schema and accepted by both `createIssueSchema` and `updateIssueSchema`. You can set them via the standard `POST /api/companies/{id}/issues` and `PATCH /api/issues/{id}` endpoints.

### 2. InternalScheduler

An in-process scheduler running inside the Bedlam server. Three jobs:

| Job | Cadence | What it does |
|---|---|---|
| `blocker_reconciler` | every 15 min | Scans every issue with `status: blocked` and a non-empty `blockedByIssueIds`. If all referenced issues are `done` or `cancelled`, transitions the issue to `todo`, clears the blocker fields, and posts an audit comment. |
| `stale_blocked_escalator` | every 60 min | Scans every issue with `status: blocked` that hasn't moved in >48h and isn't already flagged. Sets `needsHumanAt` so it surfaces for human attention. |
| `daily_status_writer` | every 30 min | Spawns a configurable Python script (`scripts/daily-status.py` by default) that writes a human-readable markdown digest. |

The scheduler ticks every minute and runs jobs at their cadences. Each tick is independently try/catch'd — a failed run logs and continues, never crashes the server.

### 3. Daily status writer

A reference Python script (`scripts/daily-status.py`) that reads Bedlam state via the API and writes a markdown digest covering:

- Top-line numbers (shipped 24h, in-progress, blocked, needs-human)
- ⚠️ Needs human attention (front-and-center)
- Active right now
- Shipped last 24h
- In review (with stale flagging)
- Stuck blocked >48h
- Status breakdown
- Active by project

Output goes to `$BEDLAM_STATUS_OUT_DIR` (default `/tmp/bedlam-status`), as both `{date}-status.md` and `CURRENT.md`. The script is generic — discovers companies, agents, and projects via the API. No hardcoded IDs.

### 4. Autonomy contract

A behavior contract for engineer/reviewer agents at `docs/agent-contracts/block-handling.md`. Append it to your engineer/reviewer `AGENTS.md` files so all agents share the same protocol:

- Prefer self-fix over block
- Use structured fields when blocking
- Use `needsHumanAt` for auth/credential blockers
- Track `selfFixAttempts`

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `BEDLAM_INTERNAL_SCHEDULER_ENABLED` | `true` | Set to `false` to disable all jobs |
| `BEDLAM_DAILY_STATUS_SCRIPT` | unset | Path to daily-status script. If unset, `daily_status_writer` is skipped — the other two jobs still run. To enable, set to e.g. `/path/to/bedlam/scripts/daily-status.py` |
| `BEDLAM_STATUS_OUT_DIR` | `/tmp/bedlam-status` | Where the daily-status script writes output |
| `BEDLAM_COMPANY_ID` | unset | Filter daily status to one company. If unset, reports on all companies. |
| `BEDLAM_API_BASE` | `http://127.0.0.1:3100/api` | API endpoint the daily-status script reads from |

## Quick start

To turn on daily-status writing in your environment:

```bash
# 1. Make sure the daily-status script is executable
chmod +x scripts/daily-status.py

# 2. Set the env var so the scheduler picks it up
export BEDLAM_DAILY_STATUS_SCRIPT="$(pwd)/scripts/daily-status.py"
export BEDLAM_STATUS_OUT_DIR="$HOME/bedlam-status"

# 3. Start (or restart) Bedlam
pnpm dev
```

You should see in the logs:

```
InternalScheduler starting {"jobs":["daily_status_writer","blocker_reconciler","stale_blocked_escalator"],"dailyStatusEnabled":true}
daily_status_writer succeeded
```

And `$HOME/bedlam-status/CURRENT.md` will exist within a few seconds of startup.

## Disabling individual jobs

The scheduler accepts a `disabled: Set<string>` option for tests. In production, you can disable the whole scheduler with `BEDLAM_INTERNAL_SCHEDULER_ENABLED=false`. To disable just `daily_status_writer`, leave `BEDLAM_DAILY_STATUS_SCRIPT` unset — the other two jobs still run.

## Implementation files

- `packages/db/src/schema/issues.ts` — schema fields
- `packages/db/src/migrations/0047_*.sql` — migration adding the columns and index
- `packages/shared/src/validators/issue.ts` — Zod validators including new fields
- `server/src/services/internal-scheduler.ts` — scheduler implementation
- `server/src/index.ts` — wiring (look for `InternalScheduler`)
- `scripts/daily-status.py` — reference daily-status writer
- `docs/agent-contracts/block-handling.md` — autonomy contract for agents

## Extending

The scheduler is intentionally minimal — three jobs, in-process, no plugin surface. If you need more jobs, add them directly in `internal-scheduler.ts`. If you need a richer scheduling story (cron expressions, distributed coordination, backpressure), see `server/src/services/plugin-job-scheduler.ts` for the heavier-weight system Bedlam uses for plugin-defined jobs.
