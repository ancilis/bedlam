---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm bedlam issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm bedlam issue get <issue-id-or-identifier>

# Create issue
pnpm bedlam issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm bedlam issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm bedlam issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm bedlam issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm bedlam issue release <issue-id>
```

## Company Commands

```sh
pnpm bedlam company list
pnpm bedlam company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm bedlam company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm bedlam company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm bedlam company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm bedlam agent list
pnpm bedlam agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm bedlam approval list [--status pending]

# Get approval
pnpm bedlam approval get <approval-id>

# Create approval
pnpm bedlam approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm bedlam approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm bedlam approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm bedlam approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm bedlam approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm bedlam approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm bedlam activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm bedlam dashboard get
```

## Heartbeat

```sh
pnpm bedlam heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
