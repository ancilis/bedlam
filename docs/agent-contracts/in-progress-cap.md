# In-progress cap — scheduler rule

This document specifies a behavior the Bedlam scheduler should enforce: **an engineer (or reviewer) agent may have at most ONE issue in `in_progress` status at a time.** When an agent tries to pick up a second issue while one is already open, the most recently assigned one is reverted to `todo` with an explanatory comment.

This rule is the structural backstop for the [Definition of Done](./definition-of-done.md) contract. The contract tells agents to follow through on one issue at a time; the cap enforces it when prompts fail.

---

## Why a hard cap of 1 (not 3)

Without a cap, agents context-switch — open a PR, lose interest, pick up the next ticket, leave the first one to rot. With a cap of 3, the same pattern still emerges, just slower (PRs accumulate at 3× the rate). Only at cap=1 does the failure mode close: agents physically cannot move on.

The cost of cap=1 is that idle agents have nothing to do when blocked on review/merge. The Definition of Done contract addresses this with explicit idle-fallback rules (review another reviewer's queue, investigate flakes, etc.).

## Reference implementation (Python)

```python
ENGINEER_IDS = { "<agent-id-1>", "<agent-id-2>", ... }
IN_PROGRESS_CAP = 1

def rule_in_progress_overflow(active_issues):
    """
    For each engineer, if >IN_PROGRESS_CAP issues are in_progress,
    keep the OLDEST (most-committed-to) and revert the rest to todo.
    """
    findings = []
    by_eng = {}
    for issue in active_issues:
        if issue["status"] != "in_progress":
            continue
        a = issue.get("assigneeAgentId")
        if a in ENGINEER_IDS:
            by_eng.setdefault(a, []).append(issue)
    for eng_id, eng_issues in by_eng.items():
        if len(eng_issues) <= IN_PROGRESS_CAP:
            continue
        # Sort by checkout time — keep the one they committed to first
        sorted_i = sorted(eng_issues,
            key=lambda i: i.get("executionLockedAt") or i.get("updatedAt", ""))
        findings.append({
            "type": "in_progress_overflow",
            "engineer": eng_id,
            "keep": sorted_i[:IN_PROGRESS_CAP],
            "revert": sorted_i[IN_PROGRESS_CAP:],
        })
    return findings

def apply_findings(findings):
    for f in findings:
        if f["type"] != "in_progress_overflow":
            continue
        kept = f["keep"][0]["identifier"]
        for issue in f["revert"]:
            api_patch(f"/issues/{issue['id']}", {"status": "todo"})
            post_comment(issue["id"],
                f"## Scheduler — engineer queue cap is 1 active issue\n\n"
                f"Reverted to `todo` pending completion of {kept}. "
                f"You may have at most ONE issue `in_progress` at a time. "
                f"Per the Definition of Done contract: finish your current "
                f"issue (PR merged, branch deleted, issue at `done`) before "
                f"picking up the next."
            )
```

Run this rule on the same cadence as your other scheduler rules (every 15–30 minutes is reasonable). It's a no-op when all engineers have ≤1 in_progress.

## Configuration

- `ENGINEER_IDS` — set of agent IDs the cap applies to (don't apply to manager / leadership agents like CEO, CTO)
- `IN_PROGRESS_CAP` — default 1; increase only if you have a strong reason
- Whether reviewers count as engineers for this rule — recommended yes; reviews compete with their other work

## Reverting reviewers' overflow

The same rule should apply to reviewer agents (`role: qa`) — if a reviewer has 2 reviews in `in_progress` simultaneously, the most recent one reverts to `todo`. This prevents the failure mode where a reviewer starts review #2 before finishing review #1.

## Companion docs and templates

- [definition-of-done.md](./definition-of-done.md) — the contract this rule enforces
- [review-sla.md](./review-sla.md) — reviewer-side companion contract
- [`templates/blocks/engineer-definition-of-done.md`](../../templates/blocks/engineer-definition-of-done.md) — block to install on engineer `AGENTS.md`
- [`templates/agents/pipeline-coordinator/`](../../templates/agents/pipeline-coordinator/) — surfaces SLA misses and structural pattern violations
