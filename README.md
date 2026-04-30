# Bedlam

**Open-source agent orchestration platform. Deploy a team of AI agents locally with org charts, budgets, governance, and stigmergic coordination.**

Bedlam is a modified fork of [Paperclip](https://github.com/paperclipai/paperclip) with significant architectural enhancements for production-grade local agent deployments. It gives you a full control plane for running AI agent companies — complete with org structure, budget enforcement, task governance, and agent-to-agent coordination — without sending your data or workflows to any external service.

---

## What's Different from Paperclip

Bedlam ships with the following enhancements on top of upstream Paperclip:

### Stigmergic Coordination
Agents communicate indirectly through shared environmental state rather than direct message passing. This allows large agent teams to self-organize around work without tight coupling or central orchestration bottlenecks. Agents leave traces; other agents respond to those traces.

### Reflexion-Based Quality Patterns
Agents evaluate their own outputs before surfacing results. Reflexion loops are built into the execution pipeline: an agent produces a result, critiques it against defined quality criteria, and iterates until the output meets the bar or escalates to a human approver.

### Dynamic Model Routing
Model assignment is based on task type, not a static config. Design-heavy and architecture work routes to frontier-tier models (Claude Opus, OpenAI o3/GPT-5). Standard execution routes to Sonnet-class. Mechanical and repetitive tasks route to Haiku-class. The CTO agent can patch model assignments dynamically before waking agents via the API. With the OpenRouter adapter, the same routing logic spans any model available on [openrouter.ai](https://openrouter.ai) — Anthropic, OpenAI, Google, Meta, DeepSeek, Mistral, xAI, and more — through a single API key.

### Custom Agent Persona System ([AGENTS.md](http://AGENTS.md) + [SOUL.md](http://SOUL.md))

Each agent has two definition files:

- [**AGENTS.md**](http://AGENTS.md) — role, responsibilities, decision authority, escalation paths, and operational rules
- [**SOUL.md**](http://SOUL.md) — personality, communication style, values, and behavioral defaults

This gives agents consistent, predictable identities across long-running sessions and multi-agent collaborations.

### AOA Heartbeat Protocols

Agents emit structured heartbeat signals during execution. These signals carry task state, confidence levels, and dependency flags. Other agents and the control plane use heartbeats to coordinate sequencing, detect stalls, and trigger interventions without polling.

### Turnkey Local Deployment

Bedlam is designed to run entirely on your own hardware. Embedded Postgres ships in the box for zero-config local runs. Docker Compose configs are included for containerized deployments. No cloud account required.

### Blocker Autonomy

Issues have structured blocker fields (`blockedByIssueIds`, `blockedReason`, `needsHumanAt`, `needsHumanReason`, `selfFixAttempts`). An in-process scheduler auto-unblocks issues when their dependencies complete (`blocker_reconciler`), flags blocked-too-long issues for human attention (`stale_blocked_escalator`), and writes a human-readable daily status digest (`daily_status_writer`). A behavior contract for engineer agents (`docs/agent-contracts/block-handling.md`) ensures agents try self-fix before blocking and use `needsHumanAt` for auth/credential issues. Operators see only what genuinely needs them, not a full blocked queue. See `docs/blocker-autonomy.md`.

---

## Quick Start

The fastest way to get Bedlam running:

```sh
npx bedlam onboard --yes
```

This walks through setup, configures your environment, and starts the server at `http://localhost:3100`. Re-running `onboard` keeps your existing config and data. Use `bedlam configure` to edit settings later.

Subsequent runs:

```sh
npx bedlam run
```

### Working from a clone (contributors)

```sh
pnpm install
pnpm dev
```

To reset the local dev database:

```sh
rm -rf ~/.bedlam/instances/default/db
pnpm dev
```

For long-running deployments, see [Production Deployment](#production-deployment-macos) below — don't run `pnpm dev` in a terminal forever.

---

## Repo Structure

```
server/                Express REST API and orchestration services
ui/                    React + Vite board UI
cli/                   CLI for setup, onboarding, and control-plane commands
packages/
  db/                  Drizzle schema, migrations, DB clients
  shared/              Shared types, constants, validators, API path constants
  adapter-utils/       Shared utilities for adapter implementations
  adapters/            Agent adapter implementations (see Adapters section)
  plugins/             Plugin system packages
doc/                   Operational and product docs
docs/                  Public documentation (Mintlify)
skills/                Reusable agent skill definitions
```

---

## Adapters

Adapters connect Bedlam's orchestration layer to specific agent runtimes. Each adapter knows how to invoke an agent, capture its output, and report token usage. You pick the adapter per-agent — different agents in the same company can run on different runtimes.

| Adapter | Type Key | What It Runs |
|---------|----------|--------------|
| Claude Local | `claude_local` | Claude Code CLI, locally |
| Codex Local | `codex_local` | OpenAI Codex CLI, locally |
| Gemini Local | `gemini_local` | Gemini CLI, locally |
| OpenCode Local | `opencode_local` | OpenCode CLI, multi-provider via `provider/model` |
| Cursor | `cursor` | Cursor in background mode |
| Pi Local | `pi_local` | Embedded Pi agent, locally |
| OpenClaw Gateway | `openclaw_gateway` | Upstream Paperclip ecosystem gateway endpoint |
| **OpenRouter** | `openrouter` | **Any model on OpenRouter — Anthropic, OpenAI, Google, Meta, DeepSeek, Mistral, xAI, and more — through a single API key** |
| Process | `process` | Arbitrary shell commands |
| HTTP | `http` | Webhooks to external agents |

### OpenRouter

The OpenRouter adapter lets you route any agent to any model available on [openrouter.ai](https://openrouter.ai) using one API key and one billing account. Useful when you want different agents on different providers without managing separate credentials, or when you need access to models that don't have a dedicated CLI adapter (Llama, Mistral, Grok, DeepSeek, etc.).

```json
{
  "adapterType": "openrouter",
  "adapterConfig": {
    "apiKey": "sk-or-...",
    "model": "anthropic/claude-sonnet-4-5",
    "instructionsFilePath": "/absolute/path/to/AGENTS.md",
    "maxTokens": 4096,
    "temperature": 0.5
  }
}
```

Specify any model in `provider/model` format — `anthropic/claude-opus-4`, `openai/gpt-4.1`, `openai/o3`, `google/gemini-2.5-pro`, `meta-llama/llama-4-maverick`, `deepseek/deepseek-r2`, `x-ai/grok-3`. Token usage is captured from the response and attributed to the `openrouter` biller for cost tracking. Full reference: `docs/adapters/openrouter.md`.

### Building Your Own Adapter

Each adapter is a workspace package under `packages/adapters/<name>/` with a server module (executes the agent), a UI module (renders run transcripts and config forms), and a CLI module (formats output for `bedlam run --watch`). See `docs/adapters/creating-an-adapter.md`.

---

## Agent Configuration

Define your agent team in the `skills/` directory. Each agent gets:

**`AGENTS.md`** — operational definition:
```markdown
# CEO Agent

## Role
Sets company direction, approves major decisions, manages the executive team.

## Responsibilities
- Review and approve strategic plans
- Unblock agents with conflicting priorities
- Escalate budget overruns to human operator

## Decision Authority
- Can approve tasks up to $50 budget
- Cannot modify core architecture without human approval
```

**`SOUL.md`** — behavioral definition:
```markdown
# CEO Soul

Direct and decisive. Communicates in short, clear sentences.
Prioritizes clarity over completeness. Pushes back on scope creep.
Values execution speed over perfection on reversible decisions.
```

---

## Docker

```sh
# Standard deployment
docker compose -f docker/docker-compose.yml up

# Quickstart (single command)
docker compose -f docker/docker-compose.quickstart.yml up
```

See `doc/DOCKER.md` for full deployment options.

---

## Production Deployment (macOS)

For long-running deployments on a Mac, supervise the process with a LaunchAgent rather than `pnpm dev` in a terminal. The repo includes a one-command installer:

```sh
./scripts/macos/install.sh
```

This generates a fresh agent JWT secret, installs `~/Library/LaunchAgents/ai.bedlam.dev.plist`, and bootstraps the agent into your GUI session domain (`gui/$UID`) so adapters that depend on the GUI security context (Claude Code subscription auth, SSH agent forwarding) work correctly.

The LaunchAgent uses `KeepAlive` for crash recovery and an 8 GB Node heap. See [`docs/deploy/macos-launchagent.md`](docs/deploy/macos-launchagent.md) for the full rationale, lifecycle commands, troubleshooting, and the manual install path.

For Linux, the equivalent pattern is a `systemd --user` unit. A reference unit is on the roadmap.

---

## Model Routing

Bedlam uses a three-tier routing model. Tier assignment is based on task type, not a static config — the CTO agent can patch model assignments dynamically before waking agents via the API.

| Tier | Examples (direct adapters) | Examples (via OpenRouter) | Use For |
|------|----------------------------|---------------------------|---------|
| Design | Claude Opus, GPT-5 (Codex) | `anthropic/claude-opus-4`, `openai/o3` | Architecture, strategy, complex reasoning |
| Execution | Claude Sonnet | `anthropic/claude-sonnet-4-5`, `openai/gpt-4.1`, `google/gemini-2.5-pro` | Standard task execution, code, analysis |
| Mechanical | Claude Haiku | `anthropic/claude-haiku-3-5`, `openai/gpt-4.1-mini` | Formatting, classification, repetitive transforms |

Direct CLI adapters (`claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `hermes_local`) give you tool execution, streaming output, and subscription auth. The OpenRouter adapter gives you breadth — any model on OpenRouter, one API key, unified billing — at the cost of CLI tool execution. Mix and match: code-writing agents on direct CLI adapters, reasoning and reviewer agents on OpenRouter, mechanical agents on whichever is cheapest.

Configure adapters in `packages/adapters/`. The dynamic routing layer selects tier based on task metadata before agent execution begins.

---

## Contributing

See `CONTRIBUTING.md` and `AGENTS.md` for contribution guidelines and repo conventions.

---

## Built With Bedlam

Bedlam is the internal agent orchestration platform used to build [Ancilis](https://ancilis.ai) — agent compliance intelligence for enterprise AI deployments. The Ancilis engineering team runs a multi-team Bedlam deployment to develop the platform, with the enhancements in this repo developed and battle-tested in that context.

Operationally, the production-grade pattern we use is documented in `docs/deploy/macos-launchagent.md`: a supervised LaunchAgent loaded into the user's GUI session domain, with `KeepAlive` for crash recovery and an 8 GB Node heap. The `scripts/macos/install.sh` installer in this repo materializes that setup in one command. We previously used a cron-based watchdog and migrated off it because cron-spawned processes can't access the macOS keychain entries that subscription-auth adapters (notably `claude_local`) depend on.

---

## Attribution

Bedlam is a fork of [Paperclip](https://github.com/paperclipai/paperclip), originally created by Dotta.

Upstream Paperclip is an open-source agent orchestration platform. Bedlam preserves all original Paperclip functionality and adds the enhancements described above. Bug fixes and non-breaking improvements from upstream may be merged periodically.

---

## License

Apache 2.0 — see `LICENSE`.

Bedlam additions and enhancements are Copyright (c) 2026 Ancilis, Inc., licensed under Apache 2.0. Upstream Paperclip portions remain under the original MIT License. Both notices are included in `LICENSE`.
