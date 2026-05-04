# Pipeline Coordinator agent template

## What it does

Hourly intervention agent. Watches the queue and:

- Reassigns reviews after 24h SLA miss (cross-pool)
- Reverts `in_progress` issues with no commits in 5+ days back to `todo`
- Comments on engineers/reviewers with specific redirects
  (e.g., "@engineer your PR has been waiting 48h, status?")
- Warns agents posting >2 issues/day but shipping <0.5/day
- Posts a daily Pipeline Health Report (shipping ratio per agent,
  median time-to-merge, block depth, throughput trend)
- Escalates structural patterns to a human (does NOT auto-close
  issues, pause agents, or kill stale PRs)

## Why you want it

Without a Pipeline Coordinator, the pipeline gets stuck in invisible
ways: PRs sitting on a reviewer with no SLA pressure, engineers
context-switched off a stalled `in_progress` and silently moved on,
ticket-creation outpacing ticket-completion. By the time a human
notices, the backlog has compounded for weeks.

The Coordinator surfaces these patterns at the moment they happen
and intervenes on the cheap ones automatically. Operators see a
single daily Pipeline Health Report instead of a blocked queue.

## What it does NOT do

- Doesn't write code
- Doesn't approve PRs (the Reviewer's job)
- Doesn't merge PRs (Merger's job)
- Doesn't delete branches (Branch Steward's job)
- Doesn't auto-close issues — surfaces, you decide

## Install

1. Customize `hire.json.example`
2. Submit hire request
3. Approve via board UI
4. Customize `AGENTS.md` — substitute `{{COMPANY}}`, `{{N}}`
5. Write substituted AGENTS.md to `instructionsFilePath`

## Required prerequisites for the prompt to be effective

The Coordinator's interventions reference behaviors defined in
contract docs:

- `docs/agent-contracts/definition-of-done.md` — engineers must
  follow this for the Coordinator's "stale in_progress" intervention
  to make sense
- `docs/agent-contracts/review-sla.md` — reviewers must follow this
  for the Coordinator's "review SLA miss" intervention to make sense
- `docs/agent-contracts/in-progress-cap.md` — scheduler must enforce
  this for the queue-cap reversion semantics

Install the engineer + reviewer block templates first so the agents
the Coordinator nudges are operating under the same rules.

## Heartbeat tuning

Default `intervalSec: 3600` (hourly) is right for most teams. Drop to
1800 (30 min) if you have a high-velocity team and want faster SLA
enforcement; raise to 7200 (2 hr) if you want lower API churn.

## Safety property

Coordinator can revert `in_progress` → `todo` and reassign reviews,
both fully reversible. It cannot close issues, pause agents, or kill
PRs — those go through escalation to a human.
