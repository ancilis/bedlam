# macOS LaunchAgent for Bedlam

Files in this directory:

FilePurpose`ai.bedlam.dev.plist.template`LaunchAgent definition with placeholders for `HOME`, `USER`, `REPO`, `JWTinstall.sh`Idempotent installer: materializes the plist, bootstraps it into `gui/$UID`, waits for health

## Quick install

From the repo root:

```sh
./scripts/macos/install.sh
```

This generates a fresh `BEDLAM_AGENT_JWT_SECRET`, installs the plist to `~/Library/LaunchAgents/ai.bedlam.dev.plist`, loads it into your GUI session domain, and waits for `http://127.0.0.1:3100/api/health`to return 200.

If you already have a secret in use elsewhere (for example, you're migrating from a cron-based watchdog), pass it explicitly so JWTs issued by the previous instance remain valid:

```sh
./scripts/macos/install.sh --jwt "$YOUR_EXISTING_SECRET"
```

## Common commands

```sh
./scripts/macos/install.sh status     # launchctl print summary
./scripts/macos/install.sh restart    # kickstart -k (after pulling code)
./scripts/macos/install.sh logs       # tail /tmp/bedlam-launchd.log
./scripts/macos/install.sh stop       # bootout (no auto-restart)
./scripts/macos/install.sh uninstall  # bootout and remove plist
```

## Why a LaunchAgent

Bedlam needs to run continuously and survive crashes. The two viable patterns on macOS are:

1. **Cron + nohup + watchdog script** — the classic approach. A `*/2 * * * *`cron entry checks `/api/health` and restarts the process if it's down.
2. **LaunchAgent with KeepAlive** — `launchd` supervises the process directly, restarts on crash, throttles fast crash loops, runs at login.

We use option 2 because cron-spawned processes on macOS run *outside*your authenticated GUI session. They don't inherit the same security context, environment, or service registrations. In practice this breaks:

- **Claude Code subscription auth** — the CLI stores OAuth tokens in the macOS keychain. Cron-launched processes spawning `claude` may fail with "Not logged in · Please run /login" even though `claude` works fine from your terminal as the same user.
- **SSH agent forwarding** for adapters that pull from private repos during execution.
- **Various XPC service registrations** (`SSH_AUTH_SOCK`, etc.) that GUI-domain children get for free.

Loading the LaunchAgent into `gui/$(id -u)` puts Bedlam under the same launchd domain that Finder, Terminal, and your other GUI apps live in. Children inherit the same session context, so adapters that depend on that context behave the same way they do when you run them by hand.

## Linux

If you're on Linux, use a `systemd --user` unit instead. The pattern is the same: KeepAlive equivalent (`Restart=on-failure`), `ThrottleInterval` equivalent (`RestartSec=`), 8 GB Node heap (`Environment="NODE_OPTIONS=--max-old-space-size=8192"`), and your agent JWT secret in `Environment=BEDLAM_AGENT_JWT_SECRET=…`.

A reference systemd unit is on the roadmap; PRs welcome.

## Manual install (if you don't want to run the script)

```sh
# 1. Copy the template and fill in placeholders
sed \
  -e "s|{{HOME}}|$HOME|g" \
  -e "s|{{USER}}|$USER|g" \
  -e "s|{{REPO}}|$(pwd)|g" \
  -e "s|{{JWT}}|$(openssl rand -hex 32)|g" \
  scripts/macos/ai.bedlam.dev.plist.template \
  > ~/Library/LaunchAgents/ai.bedlam.dev.plist

# 2. Validate
plutil -lint ~/Library/LaunchAgents/ai.bedlam.dev.plist

# 3. Bootstrap into your GUI session
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/ai.bedlam.dev.plist

# 4. Wait for health
curl -s http://127.0.0.1:3100/api/health
```
