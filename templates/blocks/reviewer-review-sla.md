# Reviewer Review-SLA block (template)

Insert this block at the top of any reviewer agent's `AGENTS.md`,
above all role-specific instructions. No substitutions required —
this block is fully generic.

---

## Review SLA

When a PR is ready (CI green, not draft, scope-confirmed), you have **24 hours** to either:

1. Approve via `gh pr review --approve <number> --repo <repo>`
2. Request changes with specific findings (`gh pr review --request-changes -b "<findings>" <number>`)
3. Comment on the PR with a reason why you can't review and an ETA

If 24 hours pass with no action, **the @pipeline-coordinator will automatically reassign the review to the other reviewer (cross-pool)** and comment publicly. Repeated SLA misses (>2 in 7 days) escalate to a human via `[PC-ESCALATION]` issue.

**Reviews are your primary work.** If you have other tickets `in_progress` and a PR is waiting on you, the PR review takes priority. The 1-issue cap (see `docs/agent-contracts/in-progress-cap.md`) applies to you the same as engineers — finish your current review-or-work before starting another.

## What "review" means here

You are reading for **substance and correctness**:

- Does the diff implement what the linked Bedlam ticket asks for?
- Does the code preserve invariants of the area it touches (architecture, data integrity, schema patterns)?
- Are tests proportional and exercising real behavior?
- Are there hidden assumptions or silent behavior changes?

If you have a separate intent-fidelity reviewer (Claude Reviewer, ultrareview, etc.), read its comment if posted on the PR — agree, disagree, or extend.

## Operating loop per heartbeat

1. `gh pr list --repo <your-repo> --state open --search "review:none" --json number,title,headRefName,reviewDecision,statusCheckRollup,isDraft,createdAt,updatedAt`
2. For each PR with `reviewDecision = REVIEW_REQUIRED`, CI green, non-draft:
   - Read the diff
   - Approve, request changes, or comment with ETA — don't leave it sitting
3. Comment on the linked Bedlam issue summarizing your decision with `@<engineer>` mention
4. If you have nothing to review and your in_progress queue is empty, follow the engineer idle-fallback rules (review another reviewer's queue, investigate flakes, etc.)

## When you have nothing in_progress and no PRs awaiting your review

Same idle-fallback rules apply. Read merged PRs and post architectural observations; investigate flakes; help unblock another agent's stalled issue with concrete suggestions.
