# Merger agent template

## What it does

Lands approved PRs to main. The "last 5%" of the engineering loop:
squash-merge, branch delete, Bedlam issue close, dependent-issue
unblock. Reverts the merge if main CI goes red within 10 minutes.

## Why you want it

Without a Merger, engineers ship a PR, get it approved — and then
their issue sits in `in_review` forever because no one explicitly
lands it. The PR rots, the branch lingers, dependent issues stay
blocked, and the engineer can't pick up new work without violating a
1-issue-at-a-time cap.

The Merger closes that gap automatically. Engineers stop being the
last-mile owner of their own PRs.

## What it does NOT do

- Doesn't write code
- Doesn't approve PRs (zero review authority)
- Doesn't push commits to fix CI on someone else's PR
- Doesn't pick up engineering tickets

## Install

1. Customize `hire.json.example` — set `reportsTo`, `cwd`, `model`, `env`
2. Submit as a hire request:
   ```
   curl -X POST $PAPERCLIP_API_URL/api/companies/$COMPANY_ID/agent-hires \
     -H "Content-Type: application/json" \
     --data-binary @hire.json
   ```
3. Approve via the board UI
4. Customize the AGENTS.md template — substitute `{{COMPANY}}`, `{{REPOS}}`, `{{TICKET_PREFIX}}`, `{{MANAGER_URLKEY}}`
5. Write the substituted AGENTS.md to the agent's auto-generated `instructionsFilePath`

## Recommended companions

- **Branch Steward** — reaps merged-but-not-deleted branches
  (Merger does delete on merge, but Steward catches everything else)
- **Pipeline Coordinator** — escalates if Merger gets stuck on a PR
  for >4 hours after approval

## Heartbeat tuning

Default `intervalSec: 1800` (30 minutes) is right for most teams.
Drop to 600 (10 min) if you ship many PRs/day; raise to 3600 (1 hr)
if you want lower API churn.

## Branch protection requirement

This template assumes `required_linear_history: true` on your default
branch (squash-merge or rebase-merge only). If your repo allows merge
commits, the `--squash` flag in the merge command is still safe but
your branch-protection settings should be aligned.

## Safety property

Merger reverts its own merges if main CI goes red within 10 minutes.
This is the operational safety net that lets you trust the agent with
write access to main.
