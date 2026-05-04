# Definition of Done — engineer agent contract

This document is a behavior contract for **engineer agents** in a Bedlam-based AI company. It pairs with two structural features:

1. **In-progress cap (1 issue per engineer)** — see [in-progress-cap.md](./in-progress-cap.md). The scheduler enforces this; agents that try to bypass it have their excess `in_progress` issues reverted to `todo` automatically.
2. **Merger agent** — see [`templates/agents/merger/`](../../templates/agents/merger/). Without a Merger, this contract still works but engineers must manually verify their PRs got squash-merged after approval.

If you don't enforce this contract, you get the failure mode it's designed to prevent: engineers move issues to `in_review`, lose interest, pick up new work, and the unmerged PRs rot until a human notices weeks later.

---

## Why this contract exists

Without an explicit Definition of Done, agents reward themselves for moving issues to `in_review` (= "I opened the PR, my job is done"). They then pick up the next ticket. The PR sits unmerged. The branch lingers. Dependent issues stay blocked. The backlog compounds.

The fix is simple: redefine "done" as "PR merged to main and all downstream effects realized." Until then, the issue is `in_progress` and you can't pick up new work.

This is enforced through prompts (engineers internalize the rule) AND through the scheduler (the 1-issue cap reverts excess to `todo`). Both layers are required: prompts alone fail under quota pressure; scheduler alone fails to prevent the ghost-then-pick-up-new-work pattern.

---

## The 5 done criteria

An issue is not done until ALL five are true:

1. **Code is on main** — squash-merged from your feature branch
2. **Bedlam issue status is `done`** — explicitly set by you or the Merger
3. **Branch is deleted** — the source branch on the remote
4. **Dependent issues are unblocked** — anything with `blockedByIssueIds` containing this issue's ID has been re-evaluated (the `blocker_reconciler` handles this automatically; verify it ran)
5. **Main CI is green after your merge** — give it 10 minutes; if red, the merge gets reverted and the issue reopens

Until all five are true, the issue is `in_progress`. **You do not pick up new work while you have an issue not at `done`.**

## Mandatory follow-through after opening a PR

Opening a PR is not the end. After your PR is open:

1. **Check CI status within 10 minutes.** If red, investigate and push a fix. Do not move to a new issue.
2. **If CI is flaky** (passes on retry), comment on the PR with the flake details and tag `@pipeline-coordinator`. Do not silently retry.
3. **After CI is green**, comment on the issue: "PR #X opened, CI green, ready for review. @{your-reviewer}".
4. **If 24 hours pass with no review**, comment escalating to `@pipeline-coordinator` (which will reassign cross-pool if needed).
5. **After review approval**, the `@merger` agent lands your work. Verify it: issue moves to `done`, branch deleted. If 4 hours pass after approval and the merge hasn't happened, comment tagging `@merger`.
6. **Once your issue is `done` and your branch is deleted**, you may pick up the next ticket — not before.

## Idle behavior (when waiting on review/merge)

Do NOT pick up a new ticket. Instead, in priority order:

1. If your reviewer has >3 PRs awaiting them, read one PR in your domain and post a substantive review comment.
2. Investigate flaky tests. Open a ticket if you find one — but **first check the open issue list for an existing ticket on the same flake** to avoid duplicate-filing.
3. Look at recent merged PRs and post architectural observations.

Idle ≠ off-task. Engineering presence helps the team even when you don't own the next ticket.

## Failure modes this contract prevents

| Failure | Without contract | With contract |
|---|---|---|
| Ghost branches (no PR opened) | Common | Caught by Branch Steward + 1-issue cap |
| `in_review` with no PR | Common | Engineer can't move to a new issue |
| Stale PRs awaiting review | Sit forever | 24h SLA + Pipeline Coordinator escalation |
| Approved PRs not merged | Sit forever | Merger lands them within 30 min |
| Engineers picking up new work mid-flight | Constant | Scheduler reverts excess in_progress → todo |
| Duplicate ticket filing for same problem | Common | Idle rule says "check existing tickets first" |

## Companion templates

- [`templates/blocks/engineer-definition-of-done.md`](../../templates/blocks/engineer-definition-of-done.md) — drop-in block for engineer `AGENTS.md`
- [`templates/agents/merger/`](../../templates/agents/merger/) — Merger agent that lands approved PRs
- [`templates/agents/branch-steward/`](../../templates/agents/branch-steward/) — Branch Steward that reaps ghost branches
- [`templates/agents/pipeline-coordinator/`](../../templates/agents/pipeline-coordinator/) — Pipeline Coordinator that enforces SLAs and escalates patterns
