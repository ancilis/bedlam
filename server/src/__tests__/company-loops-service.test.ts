import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  companyLoopEvaluations,
  companyLoopObservations,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  createDb,
  heartbeatRuns,
  issueComments,
  issues,
  projects,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyLoopsService } from "../services/company-loops.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company loop service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyLoopsService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companyLoopsService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-company-loops-service-");
    db = createDb(tempDb.connectionString);
    svc = companyLoopsService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(companyLoopEvaluations);
    await db.delete(companyLoopProposals);
    await db.delete(companyLoopObservations);
    await db.delete(companyLoopRuns);
    await db.delete(companyLoops);
    await db.delete(issueComments);
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(projects);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedBaseFixture() {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const agentId = randomUUID();
    const secondAgentId = randomUUID();
    const otherCompanyAgentId = randomUUID();
    const projectId = randomUUID();

    await db.insert(companies).values([
      {
        id: companyId,
        name: "Bedlam",
        issuePrefix: `L${companyId.replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Other",
        issuePrefix: `O${otherCompanyId.replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    await db.insert(agents).values([
      {
        id: agentId,
        companyId,
        name: "CodexCoder",
        role: "engineer",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: secondAgentId,
        companyId,
        name: "Reviewer",
        role: "qa",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: otherCompanyAgentId,
        companyId: otherCompanyId,
        name: "OtherAgent",
        role: "engineer",
        status: "active",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Loops",
      status: "in_progress",
    });

    return { companyId, otherCompanyId, agentId, secondAgentId, otherCompanyAgentId, projectId };
  }

  async function seedThroughputFixture() {
    const base = await seedBaseFixture();
    const oldDate = new Date("2026-06-25T12:00:00.000Z");
    const freshDate = new Date("2026-06-29T12:00:00.000Z");
    const failedRunId = randomUUID();
    const blockedIssueId = randomUUID();
    const staleIssueId = randomUUID();
    const failedIssueId = randomUUID();
    const dependencyIssueId = randomUUID();
    const resolvedBlockedIssueId = randomUUID();

    await db.insert(heartbeatRuns).values({
      id: failedRunId,
      companyId: base.companyId,
      agentId: base.agentId,
      invocationSource: "assignment",
      status: "failed",
      contextSnapshot: { issueId: failedIssueId },
      startedAt: oldDate,
      finishedAt: oldDate,
    });

    await db.insert(issues).values([
      {
        id: blockedIssueId,
        companyId: base.companyId,
        projectId: base.projectId,
        title: "Blocked payment handoff",
        status: "blocked",
        priority: "high",
        assigneeAgentId: base.agentId,
        needsHumanAt: oldDate,
        needsHumanReason: "Vendor credentials are missing",
        updatedAt: oldDate,
      },
      {
        id: staleIssueId,
        companyId: base.companyId,
        projectId: base.projectId,
        title: "Stale review",
        status: "in_review",
        priority: "medium",
        assigneeAgentId: base.secondAgentId,
        updatedAt: oldDate,
      },
      {
        id: failedIssueId,
        companyId: base.companyId,
        projectId: base.projectId,
        title: "Failed run issue",
        status: "in_progress",
        priority: "critical",
        assigneeAgentId: base.agentId,
        executionRunId: failedRunId,
        updatedAt: freshDate,
      },
      {
        id: dependencyIssueId,
        companyId: base.companyId,
        projectId: base.projectId,
        title: "Dependency done",
        status: "done",
        priority: "medium",
        updatedAt: oldDate,
      },
      {
        id: resolvedBlockedIssueId,
        companyId: base.companyId,
        projectId: base.projectId,
        title: "Still blocked after dependency",
        status: "blocked",
        priority: "medium",
        assigneeAgentId: base.secondAgentId,
        blockedByIssueIds: [dependencyIssueId],
        updatedAt: oldDate,
      },
      ...Array.from({ length: 4 }).map((_, index) => ({
        id: randomUUID(),
        companyId: base.companyId,
        projectId: base.projectId,
        title: `High priority queue ${index + 1}`,
        status: "todo",
        priority: index === 0 ? "critical" : "high",
        assigneeAgentId: base.agentId,
        updatedAt: freshDate,
      })),
    ]);

    const loop = await svc.createLoop(
      base.companyId,
      {
        name: "Throughput Optimizer",
        kind: "throughput_optimizer",
        cadenceKind: "manual",
        riskTier: "low",
        configJson: {
          staleIssueAgeHours: 1,
          maxHighPriorityOpenIssuesPerAgent: 3,
        },
      },
      { actorType: "user", actorId: "board-user", userId: "board-user" },
    );

    return { ...base, loop, blockedIssueId, staleIssueId, failedIssueId, resolvedBlockedIssueId };
  }

  it("creates, lists, gets, and updates loops for a company", async () => {
    const { companyId, agentId } = await seedBaseFixture();

    const created = await svc.createLoop(
      companyId,
      {
        name: "Throughput",
        kind: "throughput_optimizer",
        description: "Watch flow",
        cadenceKind: "manual",
        riskTier: "low",
        ownerAgentId: agentId,
        configJson: { staleIssueAgeHours: 6 },
      },
      { actorType: "user", actorId: "board-user", userId: "board-user" },
    );

    expect(created.companyId).toBe(companyId);
    expect(created.ownerAgentId).toBe(agentId);

    const list = await svc.listLoops(companyId);
    expect(list).toHaveLength(1);
    expect(list[0].lastRun).toBeNull();

    const fetched = await svc.getLoop(created.id);
    expect(fetched?.name).toBe("Throughput");

    const updated = await svc.updateLoop(
      created.id,
      { name: "Throughput Optimizer", status: "paused" },
      { actorType: "user", actorId: "board-user", userId: "board-user" },
    );
    expect(updated.name).toBe("Throughput Optimizer");
    expect(updated.status).toBe("paused");
  });

  it("manually runs throughput_optimizer and creates deterministic observations and proposals", async () => {
    const { companyId, loop } = await seedThroughputFixture();

    const run = await svc.runLoopManually(loop.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });
    expect(run.status).toBe("awaiting_approval");
    expect(run.summary).toContain("observations");

    const detail = await svc.getRun(run.id);
    expect(detail?.observations.map((observation) => observation.kind)).toEqual(
      expect.arrayContaining([
        "blocked_needs_human",
        "stale_active_issue",
        "failed_heartbeat_run",
        "resolved_blockers_still_blocked",
        "agent_high_priority_overload",
      ]),
    );
    expect(detail?.proposals.map((proposal) => proposal.proposalType)).toEqual(
      expect.arrayContaining(["add_issue_comment", "create_issue"]),
    );
    const commentProposal = detail?.proposals.find((proposal) => proposal.proposalType === "add_issue_comment");
    const createIssueProposal = detail?.proposals.find((proposal) => proposal.proposalType === "create_issue");
    expect(commentProposal?.requiresApproval).toBe(false);
    expect(createIssueProposal?.requiresApproval).toBe(true);

    const logs = await db.select().from(activityLog).where(eq(activityLog.companyId, companyId));
    const actions = logs.map((row) => row.action);
    expect(actions).toContain("company_loop.run_created");
    expect(actions.filter((action) => action === "company_loop.proposal_created").length).toBeGreaterThan(0);
  });

  it("approves and rejects proposals with activity log entries", async () => {
    const { companyId, loop } = await seedThroughputFixture();
    const run = await svc.runLoopManually(loop.id, { actorType: "user", actorId: "board-user", userId: "board-user" });
    const proposals = await svc.listProposalsForRun(run.id);
    const createIssueProposal = proposals.find((proposal) => proposal.proposalType === "create_issue");
    const commentProposal = proposals.find((proposal) => proposal.proposalType === "add_issue_comment");

    expect(createIssueProposal).toBeTruthy();
    expect(commentProposal).toBeTruthy();

    const approved = await svc.approveProposal(createIssueProposal!.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });
    const rejected = await svc.rejectProposal(commentProposal!.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });

    expect(approved?.status).toBe("approved");
    expect(rejected?.status).toBe("rejected");

    const actions = (await db.select().from(activityLog).where(eq(activityLog.companyId, companyId))).map(
      (row) => row.action,
    );
    expect(actions).toContain("company_loop.proposal_approved");
    expect(actions).toContain("company_loop.proposal_rejected");
  });

  it("applies a low-risk add_issue_comment proposal without approval", async () => {
    const { loop } = await seedThroughputFixture();
    const run = await svc.runLoopManually(loop.id, { actorType: "user", actorId: "board-user", userId: "board-user" });
    const proposals = await svc.listProposalsForRun(run.id);
    const commentProposal = proposals.find((proposal) => proposal.proposalType === "add_issue_comment");
    expect(commentProposal?.requiresApproval).toBe(false);

    const applied = await svc.applyProposal(commentProposal!.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });

    expect(applied?.status).toBe("applied");
    const comments = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, (commentProposal!.payloadJson as { issueId: string }).issueId));
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toContain("Company Reflex Loop");
  });

  it("applies an approved create_issue proposal", async () => {
    const { companyId, loop } = await seedThroughputFixture();
    const run = await svc.runLoopManually(loop.id, { actorType: "user", actorId: "board-user", userId: "board-user" });
    const proposals = await svc.listProposalsForRun(run.id);
    const createIssueProposal = proposals.find((proposal) => proposal.proposalType === "create_issue");
    expect(createIssueProposal?.requiresApproval).toBe(true);

    await svc.approveProposal(createIssueProposal!.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });
    const applied = await svc.applyProposal(createIssueProposal!.id, {
      actorType: "user",
      actorId: "board-user",
      userId: "board-user",
    });

    expect(applied?.status).toBe("applied");
    const createdIssue = await db
      .select()
      .from(issues)
      .where(and(eq(issues.companyId, companyId), eq(issues.originId, createIssueProposal!.id)))
      .then((rows) => rows[0] ?? null);
    expect(createdIssue?.title).toContain("Triage overloaded queue");
    expect(createdIssue?.status).toBe("todo");
    expect(createdIssue?.priority).toBe("high");
  });

  it("rejects proposal application across company boundaries and marks the proposal failed", async () => {
    const { companyId, otherCompanyId, otherCompanyAgentId, loop } = await seedThroughputFixture();
    const otherIssueId = randomUUID();
    await db.insert(issues).values({
      id: otherIssueId,
      companyId: otherCompanyId,
      title: "Foreign issue",
      status: "todo",
      priority: "medium",
      assigneeAgentId: otherCompanyAgentId,
    });
    const [run] = await db
      .insert(companyLoopRuns)
      .values({ companyId, loopId: loop.id, status: "ready_to_apply" })
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
        title: "Bad cross-company comment",
        payloadJson: { issueId: otherIssueId, body: "Do not cross the boundary" },
      })
      .returning();

    await expect(
      svc.applyProposal(proposal.id, { actorType: "user", actorId: "board-user", userId: "board-user" }),
    ).rejects.toThrow(/must belong to the loop company/);

    const failed = await db
      .select()
      .from(companyLoopProposals)
      .where(eq(companyLoopProposals.id, proposal.id))
      .then((rows) => rows[0] ?? null);
    expect(failed?.status).toBe("failed");
  });
});
