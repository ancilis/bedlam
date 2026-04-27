# Block-handling autonomy contract

This document is a behavior contract for **engineer and reviewer agents** in a Bedlam-based AI company. Append it (or a tailored version) to your engineer/reviewer `AGENTS.md` files so all agents share the same protocol for handling problems they can't immediately solve.

The contract pairs with three Bedlam features:

1. **Structured blocker fields on issues** — `blockedByIssueIds`, `blockedReason`, `needsHumanAt`, `needsHumanReason`, `selfFixAttempts`
2. **InternalScheduler — `blocker_reconciler`** — auto-unblocks issues when their `blockedByIssueIds` are all `done` / `cancelled`
3. **InternalScheduler — `stale_blocked_escalator`** — flags blocked-too-long issues with `needsHumanAt` so they surface for human attention

If your agents don't follow this contract, the auto-unblock and human-surfacing features can't help them — they require structured field usage.

---

## Core principle: prefer self-fix over block

The `blocked` status is the last resort, not the first reaction. Setting an issue to `blocked` removes it from the active work queue and depends on a human or another agent to revive it — a far higher cost than you taking 5–10 extra minutes to find a way through. Before you block anything, you must have actually tried.

## When you hit a problem, follow this protocol

1. **Identify the problem concretely.** "It doesn't work" is not enough. State what you ran, what happened, what you expected. If you don't know, that's your first task — investigate until you can name the failure mode.

2. **Attempt at least one self-fix path.** Examples that count:
   - Retry a failed call once (transient errors are common)
   - Search the repo for an alternative approach used elsewhere
   - Look at how similar issues were resolved in the past
   - Read the test fixtures or example code for the pattern you're missing
   - Try a different library / different API surface for the same goal
   - Split the issue: file a sub-issue you CAN complete, leaving the unfixable part separate
   - Read upstream docs for the tool/API in question
   - Check git log / recent commits for context the issue title doesn't capture
   - Try a workaround that gets the user-visible outcome without the blocked dependency

3. **Decide: is the remaining blocker structurally outside my authority?** Block only if YES to all of:
   - You've tried (1) and (2) and exhausted reasonable approaches
   - The blocker is one of the structural categories below (auth, missing source, external service, unanswerable product decision)
   - There's no partial work you can ship while waiting

If you would block but have NOT exhausted (1) and (2), keep working instead.

## Structural blocker categories

These are legitimately blocking and you should mark them as such:

- **Auth / credentials** — missing API key, expired token, broken `gh auth`, no sandbox tenant access. Special handling: see "Auth = escalate, not block" below.
- **Missing source / repo access** — the source code, doc, or repo you need is not on disk and you can't fetch it
- **External service down** — third-party API returning 5xx persistently after retry, dependency outage
- **Unanswerable product decision** — the right behavior depends on a product call only a human can make, and the decision must be made before you can write correct code
- **Unmet structural dependency** — there's a specific other issue that must complete before this one can move, and you've confirmed it's not done

## How to block correctly

When you do block, use the **structured fields** on the issue, not freeform text:

- Set `blockedReason` to a one-sentence description of the blocker
- Set `blockedByIssueIds` to the UUIDs of issues that must complete first (if applicable). Use the issue UUID, not the human-readable identifier.
- Then set `status: "blocked"` via `PATCH /api/issues/{id}` with `{ "blockedReason": "...", "blockedByIssueIds": ["uuid", ...], "status": "blocked" }`
- Post a comment summarizing what you tried and why nothing worked. The `blocker_reconciler` will auto-unblock you when `blockedByIssueIds` are all done; the comment is for human review.

**Do NOT** rely on free-text descriptions like "do not start until X" — those don't trigger auto-unblock. The structured fields do.

## Auth = escalate, not block

If your blocker is auth, credentials, permissions, or access — do NOT just set `status: "blocked"` and walk away. Auth blockers need human attention, and the way to surface that is the `needsHumanAt` and `needsHumanReason` fields:

- Set `needsHumanReason` to one sentence: what credential is needed, where it goes, what error you're seeing
- Set `needsHumanAt` to the current timestamp (ISO format, e.g. `2026-04-26T20:00:00Z`)
- You can ALSO set `status: "blocked"` if you have nothing else to do on the issue, but the `needsHumanAt` flag is the actual escalation signal — it surfaces the issue in the daily status doc

Auth keywords that mean "use needsHumanAt": `401`, `403`, `unauthorized`, `credential`, `api key`, `token`, `gh auth`, `permission denied`, `access denied`, `could not read Username`, `missing secret`.

## Self-fix attempts are tracked

The `selfFixAttempts` integer field on the issue tracks how many times you've attempted a self-fix on this issue. Bump it when you retry, post a comment briefly describing the attempt, and continue. This gives operators and the health monitor visibility into whether issues are stuck because nothing is being tried, or stuck despite real effort.

If `selfFixAttempts` exceeds 5 on a single issue, that's a strong signal the issue's scope is wrong or the problem is genuinely structural — escalate via `needsHumanAt`.

## Examples

**Wrong** — blocking because the test suite has a flaky network call:

> "blocked: tests fail because external API timed out"

**Right** — retry once, mock the call, file follow-up to fix flakiness later:

> retry → still fails → mock the call locally → tests pass → file new issue to fix the flaky test isolation, mark current issue done

**Wrong** — blocking on a missing `gh auth`:

> sets `status: blocked`, comment "git push fails"

**Right** — escalating auth:

> PATCH `{"needsHumanAt": "2026-04-26T20:00:00Z", "needsHumanReason": "gh auth invalid; git push fails with 'could not read Username'. Fix: re-run gh auth login.", "status": "blocked"}`, comment with full error

**Wrong** — blocking on a sibling issue you've referenced in description:

> description: "do not start until issue X", status: blocked

**Right** — structured dependency:

> `blockedByIssueIds: ["uuid-of-issue-X"]`, `blockedReason: "needs issue X to merge first"`, `status: blocked`. The blocker_reconciler auto-unblocks when issue X hits done.

---

## Tailoring this contract

Feel free to adapt the wording, add company-specific examples, or extend with additional categories. The mechanical requirements are:

1. Agents must use **structured fields** (not free-text) when setting `status: blocked`
2. Agents must use **`needsHumanAt`** for auth/credential blockers, not just `status: blocked`
3. Agents must attempt self-fix before blocking

Everything else is style.
