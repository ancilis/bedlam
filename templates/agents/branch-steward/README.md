# Branch Steward agent template

## What it does

Daily branch reaping with Bedlam cross-reference. For each branch in
each configured repo:

- Reachable from main with `ahead=0` → delete (effectively merged)
- No common ancestor with main → delete (history severed)
- Has open PR → leave alone
- Linked Bedlam issue is `done` → delete
- Linked issue is `in_progress` and last commit >5 days → comment
  asking the assignee to open a PR or move to `blocked`
- Linked issue is `blocked` → verify blockers are still real
- Linked issue is `todo`/`backlog` → archive then delete
  (premature branch creation)
- `in_review` with no PR → comment asking assignee to open the PR
  or revert to `in_progress`

Posts a daily Branch Steward log summarizing what was inspected and
what action was taken.

## Why you want it

Without a Branch Steward, repos accumulate dead branches at ~5–10 per
week per active developer. After 6 months of agent-driven development,
expect 40–60 orphans per repo. Most are merged work that wasn't
deleted, plus "rescue" duplicate pairs from rebase attempts that
failed mid-flight.

The cost isn't disk — it's cognitive. Every PR list, every search,
every "what's already in flight" check has to filter through them.

## What it does NOT do

- Doesn't write code
- Doesn't merge or approve PRs
- Doesn't modify or close Bedlam issues (only comments)
- Doesn't touch `main`, `master`, `release/*`, `hotfix/*`, `archive/*`
- Doesn't delete branches <2 days old (could be active work pre-PR)
- Doesn't bulk-delete >20 branches per heartbeat

## Install

1. Customize `hire.json.example`
2. Submit hire request via `POST /api/companies/{id}/agent-hires`
3. Approve via board UI
4. Customize `AGENTS.md` template — substitute `{{COMPANY}}`, `{{REPOS}}`, `{{TICKET_PREFIX}}`, `{{REPO_COUNT}}`
5. Write substituted AGENTS.md to the agent's `instructionsFilePath`

## Recommended companions

- **Merger** — already deletes branches on merge; Branch Steward
  catches everything else
- **Pipeline Coordinator** — Steward surfaces ghost branches via
  comments; Coordinator takes follow-up action if assignees ignore
  the comments

## Heartbeat tuning

Default `intervalSec: 86400` (daily) is right for most teams. Drop to
21600 (every 6 hours) if you ship many branches/day or are doing a
one-time cleanup sprint.

## Safety property

Steward never deletes a branch with an open PR, never deletes
`main`/`master`/release branches, and bulk-deletes are throttled to
20/heartbeat. Worst-case mistake: a comment on an active branch
asking for status — recoverable.
