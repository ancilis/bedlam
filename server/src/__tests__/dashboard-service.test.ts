import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  budgetPolicies,
  companies,
  companyLearnings,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  createDb,
  goals,
  issues,
  projects,
  proposalOutcomes,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { dashboardService } from "../services/dashboard.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres dashboard service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("dashboardService expanded company summary", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof dashboardService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-dashboard-summary-");
    db = createDb(tempDb.connectionString);
    svc = dashboardService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(proposalOutcomes);
    await db.delete(companyLearnings);
    await db.delete(companyLoopProposals);
    await db.delete(companyLoopRuns);
    await db.delete(companyLoops);
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(budgetPolicies);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("returns mission, org, work, budget, loops, proposals, and learnings for command center", async () => {
    const companyId = randomUUID();
    const ceoId = randomUUID();
    const engineerId = randomUUID();
    const goalId = randomUUID();
    const projectId = randomUUID();
    const staleIssueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "AI Engineering Company",
      description: "Make Bedlam instantly adoptable as a local-first agent company control plane.",
      issuePrefix: "AEC",
      budgetMonthlyCents: 5000,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: ceoId,
        companyId,
        name: "CEO",
        role: "ceo",
        status: "active",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: engineerId,
        companyId,
        name: "Engineer",
        role: "engineer",
        status: "running",
        reportsTo: ceoId,
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);
    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Create a 5-minute AI company wow moment",
      level: "company",
      status: "active",
      ownerAgentId: ceoId,
    });
    await db.insert(projects).values({
      id: projectId,
      companyId,
      goalId,
      name: "Improve Bedlam",
      status: "in_progress",
      leadAgentId: engineerId,
    });
    await db.insert(budgetPolicies).values({
      companyId,
      scopeType: "company",
      scopeId: companyId,
      metric: "billed_cents",
      windowKind: "monthly",
      amount: 5000,
      warnPercent: 70,
      hardStopEnabled: true,
    });
    await db.insert(issues).values([
      {
        id: staleIssueId,
        companyId,
        projectId,
        goalId,
        title: "Stale in-progress task",
        status: "in_progress",
        priority: "high",
        assigneeAgentId: engineerId,
        updatedAt: new Date("2026-06-26T12:00:00.000Z"),
      },
      {
        companyId,
        projectId,
        goalId,
        title: "Blocked product call",
        status: "blocked",
        priority: "high",
        assigneeAgentId: ceoId,
        needsHumanReason: "Need board decision",
        needsHumanAt: new Date("2026-06-28T12:00:00.000Z"),
      },
    ]);
    const [loop] = await db
      .insert(companyLoops)
      .values({
        companyId,
        name: "Throughput Optimizer",
        kind: "throughput_optimizer",
        status: "active",
        riskTier: "low",
      })
      .returning();
    const [run] = await db
      .insert(companyLoopRuns)
      .values({
        companyId,
        loopId: loop.id,
        status: "ready_to_apply",
        summary: "Found stale and blocked work.",
      })
      .returning();
    const [proposal] = await db
      .insert(companyLoopProposals)
      .values({
        companyId,
        loopRunId: run.id,
        proposalType: "add_issue_comment",
        status: "proposed",
        riskTier: "low",
        requiresApproval: false,
        title: "Comment on stale task",
        payloadJson: { issueId: staleIssueId, body: "Check ownership." },
      })
      .returning();
    await db.insert(proposalOutcomes).values({
      companyId,
      proposalId: proposal.id,
      outcomeStatus: "observing",
      summary: "Watching whether the stale task moves after the comment.",
      evidenceJson: { issueId: staleIssueId },
    });
    await db.insert(companyLearnings).values({
      companyId,
      sourceType: "loop_run",
      sourceId: run.id,
      category: "throughput",
      summary: "Blocked work should surface next to active loops.",
      evidenceJson: { blockedCount: 1 },
    });

    const summary = await svc.summary(companyId);

    expect(summary.company).toMatchObject({
      id: companyId,
      name: "AI Engineering Company",
      mission: "Make Bedlam instantly adoptable as a local-first agent company control plane.",
    });
    expect(summary.org.totalAgents).toBe(2);
    expect(summary.org.roots[0]).toMatchObject({ id: ceoId, name: "CEO" });
    expect(summary.work.open).toBe(2);
    expect(summary.work.blocked).toBe(1);
    expect(summary.work.stale.length).toBe(1);
    expect(summary.work.stale[0]).toMatchObject({ id: staleIssueId, title: "Stale in-progress task" });
    expect(summary.spend.monthBudgetCents).toBe(5000);
    expect(summary.loops.active).toBe(1);
    expect(summary.loops.throughputOptimizer?.id).toBe(loop.id);
    expect(summary.proposals.latest[0]).toMatchObject({ id: proposal.id, title: "Comment on stale task" });
    expect(summary.learnings.latest[0]).toMatchObject({ summary: "Blocked work should surface next to active loops." });
  });
});
