---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `bedlam run`

One-command bootstrap and start:

```sh
pnpm bedlam run
```

Does:

1. Auto-onboards if config is missing
2. Runs `bedlam doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm bedlam run --instance dev
```

## `bedlam onboard`

Interactive first-time setup:

```sh
pnpm bedlam onboard
```

If Bedlam is already configured, rerunning `onboard` keeps the existing config in place. Use `bedlam configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm bedlam onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm bedlam onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts Bedlam with that setup.

## `bedlam doctor`

Health checks with optional auto-repair:

```sh
pnpm bedlam doctor
pnpm bedlam doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `bedlam configure`

Update configuration sections:

```sh
pnpm bedlam configure --section server
pnpm bedlam configure --section secrets
pnpm bedlam configure --section storage
```

## `bedlam env`

Show resolved environment configuration:

```sh
pnpm bedlam env
```

## `bedlam allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm bedlam allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.bedlam/instances/default/config.json` |
| Database | `~/.bedlam/instances/default/db` |
| Logs | `~/.bedlam/instances/default/logs` |
| Storage | `~/.bedlam/instances/default/data/storage` |
| Secrets key | `~/.bedlam/instances/default/secrets/master.key` |

Override with:

```sh
BEDLAM_HOME=/custom/home BEDLAM_INSTANCE_ID=dev pnpm bedlam run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm bedlam run --data-dir ./tmp/bedlam-dev
pnpm bedlam doctor --data-dir ./tmp/bedlam-dev
```
