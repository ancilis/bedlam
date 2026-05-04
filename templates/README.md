# Bedlam agent templates

Production-tested agent templates and AGENTS.md blocks for solving the
**follow-through problem** — the failure mode where engineer agents
open PRs, lose interest, pick up new work, and unmerged PRs accumulate
into an unmanageable backlog.

## When to use these templates

You're seeing one or more of these symptoms in your Bedlam-driven team:

- 30–60+ orphan branches per repo (no PR, no recent commits)
- Issues stuck in `in_review` with no actual PR opened
- Approved PRs sitting unmerged for days
- Duplicate ticket-filing for the same problem (the same CI failure
  filed as 8 separate tickets)
- A reviewer pool that's "always busy" but no review actually happens
  within 24 hours
- The same engineer making the same mistake 5+ times despite redirects

These templates address that failure mode directly. They were extracted
from a real-world deployment after a 60-branch / 89-stalled-issue
cleanup that surfaced the underlying behavior gaps.

## What's here

```
templates/
  agents/                            <- new agents you HIRE
    merger/                          - lands approved PRs to main
    branch-steward/                  - reaps ghost branches
    pipeline-coordinator/            - enforces SLAs + reports throughput
  blocks/                            <- modifications to existing agents
    engineer-definition-of-done.md   - prepend to engineer AGENTS.md
    reviewer-review-sla.md           - prepend to reviewer AGENTS.md
```

Companion contract docs live in [`../docs/agent-contracts/`](../docs/agent-contracts/):

- `definition-of-done.md` — the engineer follow-through policy
- `review-sla.md` — the reviewer 24h SLA policy
- `in-progress-cap.md` — scheduler rule (reference Python implementation)
- `block-handling.md` — existing block-handling autonomy contract (the
  baseline these new contracts build on)

## Recommended adoption order

1. **Install the engineer block** in every engineer agent's `AGENTS.md`.
   This is the contract that says "an issue isn't done until merged
   and branch deleted." Without this, the new agents have nothing to
   enforce.

2. **Install the in-progress cap** in your scheduler (see
   `docs/agent-contracts/in-progress-cap.md` for the reference Python
   implementation). This is the structural backstop for the contract
   above.

3. **Install the reviewer block** in every reviewer agent's `AGENTS.md`.
   This sets the 24h SLA the Pipeline Coordinator will later enforce.

4. **Hire the Merger.** Now your engineers have someone to land their
   approved PRs. Definition of Done becomes achievable in finite time.

5. **Hire the Pipeline Coordinator.** Now SLA misses get caught
   automatically and structural patterns surface as escalations.

6. **Hire the Branch Steward.** Last because it's lower-frequency
   (daily) and addresses cleanup of past mess rather than preventing
   future mess.

You can hire all three agents in one go if you prefer — the order above
is the dependency order, not a strict timeline.

## Genericization status

All templates use `{{PLACEHOLDER}}` substitution markers for the
ANC-specific things from the original deployment:

- `{{COMPANY}}` — your company name
- `{{REPOS}}` — list of repos
- `{{TICKET_PREFIX}}` — your Bedlam ticket prefix
- `{{REVIEWER}}` — `urlKey` of designated reviewer
- `{{MANAGER_URLKEY}}` — `urlKey` of `reportsTo` agent

Substitute these when adopting. The hire.json.example files have
`<your-...>` placeholders for the same purpose.

## Provenance

These templates were authored after a real-world Paperclip stall
diagnosis covering 89 active issues across two repos. The diagnosis
identified categories of failure (ghost branches, duplicate ticket
filing, in_review without a PR, approved PRs not merged, stale blocked
status) and the templates here are the structural fix for each
category.

Original deployment was on a Paperclip + Ancilis SDK / platform setup;
the templates are now generic-ized for any Bedlam-based AI company.

## Safety properties

- **Merger** reverts its own merges if main CI goes red within 10 min.
- **Branch Steward** never deletes branches with open PRs, never
  touches `main`/`master`/`release/*`, throttles to 20 deletions per
  heartbeat.
- **Pipeline Coordinator** can revert `in_progress` → `todo` and
  reassign reviews (both reversible) but cannot close issues, pause
  agents, or kill PRs (those go through human escalation).

These are not unattended-superhuman agents. They're scoped to specific
mechanical operations with an explicit revert path.
