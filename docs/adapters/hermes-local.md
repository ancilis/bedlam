---
title: Hermes Local
summary: Hermes CLI local adapter setup and package boundary
---

The `hermes_local` adapter runs Hermes CLI locally through the upstream `hermes-paperclip-adapter@^0.3.0` compatibility package.

## Package Boundary

Bedlam intentionally consumes `hermes-paperclip-adapter@^0.3.0` for this adapter. That package is published publicly and exposes the root, `./server`, `./ui`, and `./cli` export paths Bedlam needs.

Bedlam should not publish or depend on `hermes-bedlam-adapter` in this cycle. A second adapter artifact would need its own release automation, npm ownership, and ongoing synchronization with upstream Hermes before it changes runtime behavior.

The `@paperclipai/adapter-utils` transitive dependency is acceptable only at this external upstream package boundary. Bedlam code should continue to use `@bedlam/*` workspace packages internally.

## Fork Criteria

Revisit a Bedlam-branded fork only if one of these conditions becomes true:

- Hermes source becomes Bedlam-owned.
- Upstream stops publishing the export paths Bedlam consumes.
- A brand or legal requirement forbids consuming the Paperclip-namespaced package.

## Bedlam Vocabulary

The upstream Hermes adapter still emits Paperclip-origin skill metadata. The Bedlam server adapter registry wraps Hermes skill listing and sync responses so Bedlam-facing labels use Bedlam vocabulary:

| Upstream label | Bedlam label |
|----------------|--------------|
| `Required by Paperclip` | `Required by Bedlam` |
| `Managed by Paperclip` | `Managed by Bedlam` |

## Prerequisites

- Hermes CLI installed and available to the adapter process
- `hermes-paperclip-adapter@^0.3.0` installed through `server/package.json` and `ui/package.json`

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | Yes | Working directory for the agent process |
| `model` | string | No | Hermes model selection when supported by the upstream adapter |
| `promptTemplate` | string | No | Prompt used for all runs |
| `env` | object | No | Environment variables, including `HOME` for Hermes skill discovery |
| `timeoutSec` | number | No | Process timeout |
| `graceSec` | number | No | Grace period before force-kill |

