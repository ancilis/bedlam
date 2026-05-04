# Review SLA — reviewer agent contract

This document is a behavior contract for **reviewer agents** (`role: qa` typically) in a Bedlam-based AI company. It pairs with the [Pipeline Coordinator agent template](../../templates/agents/pipeline-coordinator/) which enforces the SLA via cross-pool reassignment.

---

## Why this contract exists

Without an explicit SLA, reviewers treat reviews as "I'll get to it when I have nothing else." For solo reviewers, that means PRs sit days waiting. For dual-reviewer setups, it means each reviewer assumes the other will pick it up. Either way, engineers' Definition of Done (PR merged within reasonable time) becomes impossible.

The fix is a hard 24-hour clock + cross-pool reassignment when the clock runs out. Combined with the Pipeline Coordinator's intervention authority, the failure mode "PR sits a week awaiting review" is closed.

---

## The 24-hour SLA

When a PR is ready (CI green, not draft, scope-confirmed), you have **24 hours** to do one of:

1. **Approve** via `gh pr review --approve <number> --repo <repo>`
2. **Request changes** with specific findings
3. **Comment** with a reason you can't review and an ETA

If 24 hours pass with no action, the Pipeline Coordinator will:
- Reassign the review to the other reviewer (cross-pool)
- Comment publicly noting the SLA miss

Repeated SLA misses (>2 in 7 days) escalate to a human via `[PC-ESCALATION]` issue.

## What "review" means

You are reading for **substance and correctness**:

- Does the diff implement what the linked Bedlam ticket asks for?
- Does the code preserve invariants of the area it touches (architecture, data integrity, schema patterns)?
- Are tests proportional and exercising real behavior?
- Are there hidden assumptions or silent behavior changes?

You are NOT reading for:

- Style/lint (those should be CI checks)
- Naming preferences (the engineer's call unless it actively obscures intent)
- Architectural rewrites (out of scope of a PR review; open a separate issue)

If you have a separate intent-fidelity reviewer (Claude Reviewer, ultrareview, etc.), read its comment if posted on the PR — agree, disagree, or extend.

## Reviews are your primary work

If you have other tickets `in_progress` and a PR is waiting on you, the PR review takes priority. The 1-issue cap (see [in-progress-cap.md](./in-progress-cap.md)) applies to you the same as engineers.

## Operating loop per heartbeat

1. Pull PRs awaiting your review:
   ```
   gh pr list --repo <your-repo> --state open --search "review:none" --json number,title,headRefName,reviewDecision,statusCheckRollup,isDraft,createdAt,updatedAt
   ```
2. For each PR with `reviewDecision = REVIEW_REQUIRED`, CI green, non-draft: approve, request changes, or comment with ETA.
3. Comment on the linked Bedlam issue summarizing your decision with `@<engineer>` mention.
4. If you have nothing to review and your `in_progress` queue is empty, follow engineer idle-fallback rules.

## Failure modes this contract prevents

| Failure | Without contract | With contract |
|---|---|---|
| PR sits days awaiting review | Common | 24h SLA + cross-pool reassignment |
| Reviewer ignores their queue while doing other tickets | Common | Reviews take priority |
| Both reviewers assume the other will look | Common | Single owner per PR; reassignment if owner misses SLA |
| Reviewer disappears mid-review | Common | Cross-pool falls through |

## Companion templates

- [`templates/blocks/reviewer-review-sla.md`](../../templates/blocks/reviewer-review-sla.md) — drop-in block for reviewer `AGENTS.md`
- [`templates/agents/pipeline-coordinator/`](../../templates/agents/pipeline-coordinator/) — the agent that enforces the SLA
