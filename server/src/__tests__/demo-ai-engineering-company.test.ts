import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  activityLog,
  agents,
  budgetPolicies,
  companies,
  companyLearnings,
  companyLoopEvaluations,
  companyLoopObservations,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  createDb,
  goals,
  heartbeatRuns,
  issueComments,
  issueLabels,
  issues,
  labels,
  projects,
  proposalOutcomes,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { seedAiEngineeringCompanyDemo } from "../services/demo-ai-engineering-company.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres AI engineering company demo tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("seedAiEngineeringCompanyDemo", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-demo-ai-engineering-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(proposalOutcomes);
    await db.delete(companyLearnings);
    await db.delete(companyLoopEvaluations);
    await db.delete(companyLoopProposals);
    await db.delete(companyLoopObservations);
    await db.delete(companyLoopRuns);
    await db.delete(companyLoops);
    await db.delete(issueLabels);
    await db.delete(labels);
    await db.delete(issueComments);
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(budgetPolicies);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("creates the flagship demo with expected agents, work, loop, ledger, and budgets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("external calls are forbidden"));

    const result = await seedAiEngineeringCompanyDemo(db, {
      actor: { actorType: "system", actorId: "demo-seed" },
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result.companyId).toEqual(expect.any(String));
    expect(fetchSpy).not.toHaveBeenCalled();

    const company = await db.select().from(companies).where(eq(companies.id, result.companyId)).then((rows) => rows[0]);
    expect(company.name).toBe("Bedlam AI Engineering Company");
    expect(company.issuePrefix).toBe("AEC");
    expect(company.description).toContain("local-first agent company control plane");

    const agentRows = await db.select().from(agents).where(eq(agents.companyId, result.companyId));
    expect(agentRows.map((agent) => agent.name).sort()).toEqual([
      "Budget Steward",
      "CEO",
      "CTO",
      "Engineer",
      "Merger",
      "Quality Steward",
      "Reviewer",
    ]);
    expect(agentRows.every((agent) => agent.adapterType === "process")).toBe(true);
    expect(agentRows.every((agent) => JSON.stringify(agent.adapterConfig).includes("echo"))).toBe(true);

    const goalRows = await db.select().from(goals).where(eq(goals.companyId, result.companyId));
    expect(goalRows.map((goal) => goal.title)).toEqual(
      expect.arrayContaining([
        "Make Bedlam instantly adoptable",
        "Create a 5-minute AI company wow moment",
      ]),
    );

    const projectRows = await db.select().from(projects).where(eq(projects.companyId, result.companyId));
    expect(projectRows).toHaveLength(1);
    expect(projectRows[0].name).toBe("Improve Bedlam");

    const issueRows = await db.select().from(issues).where(eq(issues.companyId, result.companyId));
    expect(issueRows.map((issue) => issue.title)).toEqual(
      expect.arrayContaining([
        "Stale in-progress implementation needs owner checkpoint",
        "Blocked CLI adoption task needs product decision",
        "Follow up failed run from local adapter smoke",
        "Ship README 5-minute demo path",
        "Review queue has no merge owner",
      ]),
    );
    expect(issueRows.map((issue) => issue.status)).toEqual(
      expect.arrayContaining(["in_progress", "blocked", "todo", "in_review", "backlog"]),
    );

    const labelRows = await db.select().from(labels).where(eq(labels.companyId, result.companyId));
    expect(labelRows.map((label) => label.name)).toEqual(
      expect.arrayContaining(["demo", "blocked", "high-priority", "review-queue", "reflex-loop"]),
    );

    const policyRows = await db.select().from(budgetPolicies).where(eq(budgetPolicies.companyId, result.companyId));
    expect(policyRows.length).toBeGreaterThanOrEqual(3);
    expect(policyRows.some((policy) => policy.scopeType === "company" && policy.amount === 5000)).toBe(true);

    const loopRows = await db.select().from(companyLoops).where(eq(companyLoops.companyId, result.companyId));
    expect(loopRows).toHaveLength(1);
    expect(loopRows[0]).toMatchObject({
      name: "Throughput Optimizer",
      kind: "throughput_optimizer",
      status: "active",
      cadenceKind: "manual",
      riskTier: "low",
    });

    const learningRows = await db.select().from(companyLearnings).where(eq(companyLearnings.companyId, result.companyId));
    expect(learningRows).toHaveLength(1);
    expect(learningRows[0].summary).toContain("Stale and blocked work");

    const outcomeRows = await db.select().from(proposalOutcomes).where(eq(proposalOutcomes.companyId, result.companyId));
    expect(outcomeRows).toHaveLength(1);
    expect(outcomeRows[0]).toMatchObject({ outcomeStatus: "observing" });

    const actions = (await db.select().from(activityLog).where(eq(activityLog.companyId, result.companyId))).map(
      (row) => row.action,
    );
    expect(actions).toContain("demo.ai_engineering.seeded");
    expect(actions).toContain("company_ledger.learning_recorded");
    expect(actions).toContain("company_ledger.proposal_outcome_recorded");

    fetchSpy.mockRestore();
  });

  it("is idempotent when rerun", async () => {
    const first = await seedAiEngineeringCompanyDemo(db, {
      actor: { actorType: "system", actorId: "demo-seed" },
      now: new Date("2026-06-29T12:00:00.000Z"),
    });
    const second = await seedAiEngineeringCompanyDemo(db, {
      actor: { actorType: "system", actorId: "demo-seed" },
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(second.companyId).toBe(first.companyId);
    expect(second.created).toBe(false);

    const [companyRows, agentRows, issueRows, loopRows, learningRows, outcomeRows] = await Promise.all([
      db.select().from(companies).where(eq(companies.name, "Bedlam AI Engineering Company")),
      db.select().from(agents).where(eq(agents.companyId, first.companyId)),
      db.select().from(issues).where(eq(issues.companyId, first.companyId)),
      db.select().from(companyLoops).where(eq(companyLoops.companyId, first.companyId)),
      db.select().from(companyLearnings).where(eq(companyLearnings.companyId, first.companyId)),
      db.select().from(proposalOutcomes).where(eq(proposalOutcomes.companyId, first.companyId)),
    ]);

    expect(companyRows).toHaveLength(1);
    expect(agentRows).toHaveLength(7);
    expect(issueRows).toHaveLength(6);
    expect(loopRows).toHaveLength(1);
    expect(learningRows).toHaveLength(1);
    expect(outcomeRows).toHaveLength(1);
  });

  it("does not collide with an existing non-demo company", async () => {
    const existingId = randomUUID();
    await db.insert(companies).values({
      id: existingId,
      name: "Bedlam AI Engineering Company",
      description: "User-created company with the same display name",
      issuePrefix: "USR",
      requireBoardApprovalForNewAgents: false,
    });

    const result = await seedAiEngineeringCompanyDemo(db, {
      actor: { actorType: "system", actorId: "demo-seed" },
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result.companyId).not.toBe(existingId);
    const companyRows = await db.select().from(companies);
    expect(companyRows).toHaveLength(2);
    expect(companyRows.find((company) => company.id === result.companyId)?.issuePrefix).toBe("AEC");
  });
});
