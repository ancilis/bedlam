# CLI Reference

Bedlam CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm bedlam --help
```

First-time local bootstrap + run:

```sh
pnpm bedlam run
```

Choose local instance:

```sh
pnpm bedlam run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `bedlam onboard` and `bedlam configure --section server` set deployment mode in config
- runtime can override mode with `BEDLAM_DEPLOYMENT_MODE`
- `bedlam run` and `bedlam doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm bedlam allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.bedlam`:

```sh
pnpm bedlam run --data-dir ./tmp/bedlam-dev
pnpm bedlam issue list --data-dir ./tmp/bedlam-dev
```

## Context Profiles

Store local defaults in `~/.bedlam/context.json`:

```sh
pnpm bedlam context set --api-base http://localhost:3100 --company-id <company-id>
pnpm bedlam context show
pnpm bedlam context list
pnpm bedlam context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm bedlam context set --api-key-env-var-name BEDLAM_API_KEY
export BEDLAM_API_KEY=...
```

## Company Commands

```sh
pnpm bedlam company list
pnpm bedlam company get <company-id>
pnpm bedlam company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm bedlam company delete PAP --yes --confirm PAP
pnpm bedlam company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `BEDLAM_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `BEDLAM_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm bedlam issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm bedlam issue get <issue-id-or-identifier>
pnpm bedlam issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm bedlam issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm bedlam issue comment <issue-id> --body "..." [--reopen]
pnpm bedlam issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm bedlam issue release <issue-id>
```

## Agent Commands

```sh
pnpm bedlam agent list --company-id <company-id>
pnpm bedlam agent get <agent-id>
pnpm bedlam agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Bedlam agent:

- creates a new long-lived agent API key
- installs missing Bedlam skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `BEDLAM_API_URL`, `BEDLAM_COMPANY_ID`, `BEDLAM_AGENT_ID`, and `BEDLAM_API_KEY`

Example for shortname-based local setup:

```sh
pnpm bedlam agent local-cli codexcoder --company-id <company-id>
pnpm bedlam agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm bedlam approval list --company-id <company-id> [--status pending]
pnpm bedlam approval get <approval-id>
pnpm bedlam approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm bedlam approval approve <approval-id> [--decision-note "..."]
pnpm bedlam approval reject <approval-id> [--decision-note "..."]
pnpm bedlam approval request-revision <approval-id> [--decision-note "..."]
pnpm bedlam approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm bedlam approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm bedlam activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm bedlam dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm bedlam heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.bedlam/instances/default`:

- config: `~/.bedlam/instances/default/config.json`
- embedded db: `~/.bedlam/instances/default/db`
- logs: `~/.bedlam/instances/default/logs`
- storage: `~/.bedlam/instances/default/data/storage`
- secrets key: `~/.bedlam/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
BEDLAM_HOME=/custom/home BEDLAM_INSTANCE_ID=dev pnpm bedlam run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm bedlam configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
