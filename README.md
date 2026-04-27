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
Model assignment is based on task type, not a static config. Design-heavy and architecture work routes to Opus or GPT-4-class models. Standard execution routes to Sonnet-class. Mechanical and repetitive tasks route to Haiku-class. The CTO agent can patch model assignments dynamically before waking agents via the Paperclip API.

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

```sh
# Install dependencies
pnpm install

# Start with embedded database (no setup required)
```
pnpm dev
```

Server: `http://localhost:3100`
API health: `http://localhost:3100/api/health`

To reset the local dev database:

```sh
rm -rf data/pglite
pnpm dev
```

---

## Repo Structure

```
server/       Express REST API and orchestration services
ui/           React + Vite board UI
cli/          CLI for setup, onboarding, and control-plane commands
packages/
  db/         Drizzle schema, migrations, DB clients
  shared/     Shared types, constants, validators, API path constants
  adapters/   Agent adapter implementations (Claude, Codex, Cursor, Gemini, etc.)
  plugins/    Plugin system packages
doc/          Operational and product docs
docs/         Public documentation (Mintlify)
skills/       Reusable agent skill definitions
```

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

## Model Routing

Bedlam uses a three-tier routing model:

| Tier | Models | Use For |
|------|--------|---------|
| Design | Opus, GPT-4.5 | Architecture, strategy, complex reasoning |
| Execution | Sonnet | Standard task execution, code, analysis |
| Mechanical | Haiku | Formatting, classification, repetitive transforms |

Configure adapters in `packages/adapters/`. The dynamic routing layer selects tier based on task metadata before agent execution begins.

---

## Contributing

See `CONTRIBUTING.md` and `AGENTS.md` for contribution guidelines and repo conventions.

---

## Built With Bedlam

Bedlam is the internal agent orchestration platform used to build [Ancilis](https://ancilis.ai) — agent compliance intelligence for enterprise AI deployments. The Ancilis engineering team runs a 16-agent Bedlam deployment to develop the platform, with the enhancements in this repo developed and battle-tested in that context.

---

## Attribution

Bedlam is a fork of [Paperclip](https://github.com/paperclipai/paperclip), originally created by Dotta.

Upstream Paperclip is an open-source agent orchestration platform. Bedlam preserves all original Paperclip functionality and adds the enhancements described above. Bug fixes and non-breaking improvements from upstream may be merged periodically.

---

## License

Apache 2.0 — see `LICENSE`.

Bedlam additions and enhancements are Copyright (c) 2026 Ancilis, Inc., licensed under Apache 2.0. Upstream Paperclip portions remain under the original MIT License. Both notices are included in `LICENSE`.
