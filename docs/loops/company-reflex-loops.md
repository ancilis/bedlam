---
title: Company Reflex Loops
summary: Governed, auditable self-improvement loops for Bedlam companies
---

Company Reflex Loops are first-class control-plane objects that improve a Bedlam company through an inspectable sequence:

```
observe -> diagnose -> propose -> evaluate -> approve/apply -> learn
```

Loops do not grant broad autonomy. Each loop records observations, creates typed proposals, evaluates the proposal set, requests approval when required, applies only supported actions, and leaves activity-log evidence for the run and proposal lifecycle.

## First Loop Kind

The first supported kind is `throughput_optimizer`.

It runs deterministically and does not call an external model. It inspects company issues and heartbeat runs for:

- blocked issues with `needsHumanAt` or `needsHumanReason`
- stale `in_progress` or `in_review` issues
- failed or timed-out heartbeat runs on active issues
- overloaded agents with too many open high/critical issues
- blocked issues whose recorded dependencies are already done

## Executable Proposal Types

Only these proposal types are executable in the initial foundation:

| Type | Default risk | Approval behavior |
|------|--------------|-------------------|
| `add_issue_comment` | `low` | Can be applied without approval when the loop risk tier is `low` |
| `create_issue` | `medium` | Requires approval unless the loop config explicitly downgrades safe auto-create behavior |

`add_issue_comment` payload:

```json
{
  "issueId": "uuid",
  "body": "Visible follow-through note"
}
```

`create_issue` payload:

```json
{
  "title": "Triage overloaded queue",
  "description": "Why this issue should exist",
  "priority": "high",
  "projectId": "uuid-or-null",
  "assigneeAgentId": "uuid-or-null",
  "parentId": "uuid-or-null"
}
```

All referenced issues, projects, parents, and agents must belong to the same company as the loop run.

## Current Non-Executable Future Types

The control-plane model can eventually represent proposals for agent configuration, budgets, model routing, plugin installation, workspace operations, or code changes. Those are intentionally not executable in this foundation.

Future executable types should be added only with:

- typed payload validators
- company-boundary validation
- risk-tier defaults
- approval semantics
- activity-log events
- deterministic tests

## REST API

```
GET  /api/companies/{companyId}/loops
POST /api/companies/{companyId}/loops
GET  /api/loops/{loopId}
PATCH /api/loops/{loopId}
POST /api/loops/{loopId}/archive
POST /api/loops/{loopId}/run
GET  /api/loops/{loopId}/runs
GET  /api/loop-runs/{runId}
GET  /api/loop-runs/{runId}/proposals
POST /api/loop-proposals/{proposalId}/approve
POST /api/loop-proposals/{proposalId}/reject
POST /api/loop-proposals/{proposalId}/apply
```

## Activity Log

Loop services write activity entries for:

- loop creation, update, and archive
- run creation
- proposal creation
- proposal approval
- proposal rejection
- proposal application

This lets operators inspect what the loop saw, what it proposed, who approved it, and what changed.
