---
title: macOS LaunchAgent (Long-Running)
summary: Run Bedlam as a supervised, auto-restarting service on macOS
---

`pnpm dev` is fine for a dev session. For a long-running deployment
on a Mac mini, MacBook running 24/7, or any persistent setup where
agents are doing real work, supervise the process with a LaunchAgent
instead. The repo ships with a one-command installer.

## Install

From the bedlam repo root:

```sh
./scripts/macos/install.sh
```

The installer:

1. Generates a 64-character `BEDLAM_AGENT_JWT_SECRET` if you don't
   already have one
2. Materializes `~/Library/LaunchAgents/ai.bedlam.dev.plist` from the
   template at `scripts/macos/ai.bedlam.dev.plist.template`
3. Bootstraps the agent into `gui/$(id -u)` so it runs under your
   GUI session
4. Waits for `http://127.0.0.1:3100/api/health` to return 200

If you have an existing secret you need to keep using:

```sh
./scripts/macos/install.sh --jwt "$EXISTING_SECRET"
```

## Lifecycle

```sh
./scripts/macos/install.sh status     # launchctl print summary
./scripts/macos/install.sh restart    # kickstart -k (after pulling code)
./scripts/macos/install.sh logs       # tail the server log
./scripts/macos/install.sh stop       # bootout, no auto-restart
./scripts/macos/install.sh uninstall  # remove the plist
```

The plist itself stays at `~/Library/LaunchAgents/ai.bedlam.dev.plist`.
Logs go to `/tmp/bedlam-launchd.log`.

## What the LaunchAgent does

The plist defines a single service: `pnpm dev:once` from your repo
root, supervised by `launchd`.

Key fields:

- **`KeepAlive.Crashed = true`** — `launchd` restarts the process on
  abnormal exit. A clean exit (you ran `bootout`) does not trigger a
  restart, so stop is stop.
- **`ThrottleInterval = 15`** — minimum 15 seconds between restart
  attempts, so a broken build doesn't spin up hundreds of crash loops
  per minute.
- **`ProcessType = Interactive`** — tells `launchd` this is a foreground
  developer service, not a background daemon. Normal scheduling
  priority, not aggressively jetsammed under memory pressure.
- **`RunAtLoad = true`** — starts at login.
- **`NODE_OPTIONS = --max-old-space-size=8192`** — 8 GB heap. The
  default 4 GB Node heap is not enough for a long-running Bedlam
  server with many active agent runs and will eventually crash with
  `Ineffective mark-compacts near heap limit`.

## Why GUI domain (and not a daemon)

The installer loads the plist into `gui/$(id -u)`, your user's GUI
session domain. This matters more than it sounds.

`launchctl` exposes several domains. The two that come up here are:

- **`user/$UID`** — your background user domain, present whether you're
  logged into the GUI or not.
- **`gui/$UID`** — your *interactive* GUI session domain, present only
  when you're logged in at the console (or via Screen Sharing /
  Tailscale Desktop / etc.).

Children of a `gui/$UID` LaunchAgent inherit the GUI session security
context. Children of a `user/$UID` LaunchAgent or a cron job do not.
That security context is what governs:

- Keychain access for items whose ACL requires user interaction
  (Claude Code subscription tokens, in particular)
- `SSH_AUTH_SOCK` and SSH agent forwarding for git operations during
  agent runs
- XPC service registrations various tools rely on

The practical observation: a `claude_local` agent run from a
cron-spawned Bedlam will fail with `Not logged in · Please run /login`
even though `claude --print` works fine from your terminal as the same
user. Loading Bedlam into `gui/$UID` makes the keychain lookup work.

If you don't run any adapters that depend on GUI-context tools, you
can change the install target to `user/$UID` and let Bedlam run even
when you're not logged in. For mixed-adapter setups (which most are),
keep the default.

## Memory and OOM

Long-lived Node processes accumulate heap pressure from agent runs,
parsed JSONL session files, and the embedded Postgres client pool.
The plist sets `NODE_OPTIONS=--max-old-space-size=8192` to give Bedlam
8 GB of heap. With this, a busy 20-agent setup typically holds steady.

If you see `FATAL ERROR: Ineffective mark-compacts near heap limit`
in `/tmp/bedlam-launchd.log`, the LaunchAgent will restart the process
automatically (KeepAlive will catch the crash). If it's happening more
than once a day, either bump the heap further or look at what's
holding references — long-running adapters that buffer tool-call
history are the usual culprit.

## Migrating from a cron-based watchdog

If you previously used a `*/2 * * * *` cron entry to restart Bedlam
on health-check failures, retire it before installing the LaunchAgent:

```sh
crontab -l | grep -v 'paperclip-watchdog\|bedlam-watchdog' | crontab -
```

Then install:

```sh
./scripts/macos/install.sh --jwt "$EXISTING_BEDLAM_AGENT_JWT_SECRET"
```

The two patterns are not compatible — running both means cron will
periodically kill the LaunchAgent's child and `launchd` will restart
it, churning the process tree.

## Troubleshooting

**Service shows `state = not running` and `last exit status = 1`.**
Check the log:

```sh
tail -100 /tmp/bedlam-launchd.log
```

Most common cause: pnpm or node not on the LaunchAgent's `PATH`. The
template hardcodes `/opt/homebrew/bin` first. If you're on Intel
Homebrew or have node installed elsewhere, edit the plist's
`PATH` env var and run `./scripts/macos/install.sh restart`.

**`bootstrap failed: 5: Input/output error` from launchctl.** Usually
means a previous version of the agent is still loaded. Run:

```sh
./scripts/macos/install.sh stop
./scripts/macos/install.sh
```

**Agents fail with "Not logged in" after the install.** Confirm the
service is in the GUI domain:

```sh
launchctl print "gui/$(id -u)/ai.bedlam.dev" | head -5
```

If `launchctl print` complains about the path, the agent loaded into
the wrong domain. Re-run the installer, which always targets `gui/$UID`.
