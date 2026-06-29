---
title: Lineage and Attribution
summary: Bedlam lineage, upstream attribution, and license model
---

Bedlam began as a fork of [Paperclip](https://github.com/paperclipai/paperclip), originally created by Dotta.

Bedlam now leads as a local-first company AI control plane for running agent teams with org charts, governed work loops, budgets, approvals, workspaces, model routing, execution traces, and auditability.

## Material Bedlam Changes

Bedlam has added substantial product, architecture, and operations work beyond the original upstream project, including:

- company-scoped governance, budgets, approvals, and activity auditing
- issue workflows with blockers, heartbeat runs, execution workspaces, and run recovery
- routines, agent templates, and follow-through operating contracts
- local-first deployment tooling, embedded Postgres flows, and supervised macOS deployment
- multiple local and gateway adapters, model routing, cost tracking, and quota handling
- plugin infrastructure and board UI surfaces
- Company Reflex Loops for auditable self-improvement proposals

## License Model

Bedlam-specific additions and modifications are licensed under the Apache License, Version 2.0.

Portions derived from upstream Paperclip remain under the original MIT License. Those notices are preserved in `LICENSE` and `NOTICE`.

Package metadata uses a valid SPDX expression where a package can contain both Bedlam additions and upstream-derived portions.

## Attribution

Paperclip source:

https://github.com/paperclipai/paperclip

Upstream Paperclip portions are Copyright (c) 2025 Paperclip AI and licensed under MIT terms. Bedlam additions are Copyright (c) 2026 Ancilis, Inc. and licensed under Apache 2.0 unless otherwise stated.
