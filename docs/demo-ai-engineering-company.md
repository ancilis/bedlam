---
title: AI Engineering Company Demo
summary: Seed and inspect Bedlam's deterministic flagship demo company
---

The AI Engineering Company demo shows Bedlam as a local-first agent company control plane. It seeds a realistic software company, runs a governed reflex loop, and records durable operating ledger entries without calling an external model, API, or agent CLI.

## Install And Run

For a fresh local install:

```sh
npx bedlam demo ai-engineering --yes && npx bedlam run
```

For a clone of this repository:

```sh
pnpm bedlam demo ai-engineering --yes && pnpm bedlam run
```

Open [http://localhost:3100](http://localhost:3100) and select **Bedlam AI Engineering Company**. Re-running `bedlam demo ai-engineering` is idempotent; it reuses the existing demo company and does not duplicate agents, goals, issues, loop, learnings, or outcomes.

## What Gets Seeded

The demo creates:

- company mission and goals for making Bedlam instantly adoptable
- org chart with CEO, CTO, Engineer, Reviewer, Merger, Budget Steward, and Quality Steward agents
- project **Improve Bedlam**
- issues covering stale `in_progress`, blocked work, failed-run follow-up, high-priority backlog, review queue, and safety-policy checks
- labels, starter docs, deterministic heartbeat-run fixture data, and budget policies
- one active **Throughput Optimizer** company reflex loop
- one starter company learning and one proposal outcome in the Company Operating Ledger

All agents use deterministic local fixture configuration for this seed. The demo does not require provider credentials or local agent CLIs.

## Run The Loop

From the dashboard, click **Run Throughput Optimizer**. You can also open **Loops** from the sidebar and click **Run now**.

The loop deterministically inspects company state for stale work, blocked issues, failed runs, and overloaded queues. It records observations and creates narrow, reviewable proposals such as follow-through comments or triage issues.

The loop does not autonomously change agent configuration, model routing, budgets, plugins, repository code, or deployment settings.

## Inspect The Result

After running the loop:

- **Dashboard** shows mission, org, open work, budget posture, active loops, latest proposals, and latest learnings.
- **Loops** shows observations, run summaries, and proposals.
- **Ledger** shows durable proposal outcomes and company learnings scoped to the selected company.
- **Activity** includes entries for demo seeding, loop activity, and ledger recording.

The operating ledger is structured Postgres data, not a vector database. It is meant to be queryable, company-scoped memory for decisions, outcomes, and evidence.

## Reset

To remove all local development data when using the default embedded Postgres instance:

```sh
rm -rf ~/.bedlam/instances/default/db
```

Then rerun the install commands above.
