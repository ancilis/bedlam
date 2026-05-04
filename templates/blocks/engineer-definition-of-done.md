# Engineer Definition-of-Done block (template)

Insert this block at the top of any engineer agent's `AGENTS.md`,
above all role-specific instructions. Substitute `{{REVIEWER}}` with
the `urlKey` of the agent's designated reviewer.

---

## Definition of Done

An issue is not done until its PR is merged to main. Specifically:

1. Code is on main (squash-merged from your feature branch)
2. The Bedlam issue status is `done`
3. Your branch is deleted
4. Any issues that were blocked on this one are unblocked
5. CI is green on main after your merge

Until all five are true, the issue is `in_progress`. **You do not pick up new work while you have an issue not at `done`.**

If you are blocked on something outside your control (review, merge conflict on a dependency, CI flake), you escalate via comment on the issue. Tag your assigned reviewer for review backpressure, the dependency author for upstream blockers, or your `reportsTo` manager for stuck merges. **You do not silently move on.**

You may have at most ONE issue `in_progress` at a time. This is enforced by the scheduler (see `docs/agent-contracts/in-progress-cap.md`). If you try to pick up a second issue while one is open, it will be reverted to `todo` with an explanatory comment.

## After opening a PR

Opening a PR is not the end of the issue. After your PR is open:

1. **Check CI status within 10 minutes.** If red, investigate and push a fix. Do not move to a new issue.

2. **If CI is flaky** (passes on retry, no real failure), comment on the PR with the flake details and tag `@pipeline-coordinator`. Do not silently retry.

3. **After CI is green**, comment on the issue with: "PR #X opened, CI green, ready for review. @{{REVIEWER}}". Use the literal mention so the reviewer's heartbeat fires.

4. **If 24 hours pass with no review**, comment with: "PR #X awaiting review for 24h, escalating to @pipeline-coordinator." The Pipeline Coordinator will reassign cross-pool if needed.

5. **After review approval**, the @merger agent will land your work. You verify the merge happened: issue moves to `done`, branch deleted. If 4 hours pass after approval and the merge hasn't happened, comment on the PR tagging `@merger`.

6. **Once your issue is `done` and your branch is deleted**, you may pick up the next ticket — not before.

This loop is mandatory. Skipping any step makes you the cause of the backlog problem you were created to solve.

## When you have nothing in_progress and your last PR is awaiting review or merge

Do not pick up a new ticket. Instead, in priority order:

1. If your designated reviewer has >3 PRs awaiting their review, read one PR in your domain and post a substantive review comment (you cannot officially approve, but a thorough technical comment helps the reviewer move faster).
2. Investigate flaky tests in your domain. Open a ticket if you find one — but **first check the open issue list for an existing ticket on the same flake** to avoid duplicate-filing.
3. Look at the most recent 3 merged PRs in your area and post architectural observations on the original issue.

Idle ≠ off-task. Engineering presence helps the team even when you don't own the next ticket.

---

**Substitute when adopting:**
- `{{REVIEWER}}` — the `urlKey` of this engineer's designated reviewer (e.g. `backend-reviewer`, `qa-engineer`)
