import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  companyLearnings,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  createDb,
  proposalOutcomes,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companyLedgerService } from "../services/company-ledger.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company ledger tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("companyLedgerService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companyLedgerService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-company-ledger-");
    db = createDb(tempDb.connectionString);
    svc = companyLedgerService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(proposalOutcomes);
    await db.delete(companyLearnings);
    await db.delete(companyLoopProposals);
    await db.delete(companyLoopRuns);
    await db.delete(companyLoops);
    await db.delete(activityLog);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedFixture() {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const agentId = randomUUID();

    await db.insert(companies).values([
      {
        id: companyId,
        name: "Ledger Co",
        issuePrefix: "LED",
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Other Co",
        issuePrefix: "OTH",
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Quality Steward",
      role: "quality_steward",
      status: "active",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    const [loop] = await db
      .insert(companyLoops)
      .values({
        companyId,
        name: "Throughput Optimizer",
        kind: "throughput_optimizer",
        status: "active",
      })
      .returning();
    const [run] = await db
      .insert(companyLoopRuns)
      .values({
        companyId,
        loopId: loop.id,
        status: "ready_to_apply",
      })
      .returning();
    const [proposal] = await db
      .insert(companyLoopProposals)
      .values({
        companyId,
        loopRunId: run.id,
        proposalType: "add_issue_comment",
        status: "applied",
        riskTier: "low",
        requiresApproval: false,
        title: "Comment on stale work",
        payloadJson: {},
      })
      .returning();

    return { companyId, otherCompanyId, agentId, proposalId: proposal.id };
  }

  it("records and lists proposal outcomes and learnings inside one company boundary", async () => {
    const { companyId, otherCompanyId, agentId, proposalId } = await seedFixture();

    const outcome = await svc.recordProposalOutcome(
      companyId,
      {
        proposalId,
        outcomeStatus: "succeeded",
        summary: "Comment produced a clear owner checkpoint.",
        evidenceJson: { issueStatusBefore: "stale", issueStatusAfter: "in_review" },
      },
      { actorType: "user", actorId: "board-user", userId: "board-user" },
    );
    const learning = await svc.recordLearning(
      companyId,
      {
        sourceType: "loop_run",
        sourceId: "run-1",
        category: "throughput",
        summary: "Small follow-up comments unblock review queues faster than creating net-new work.",
        evidenceJson: { sampleSize: 3 },
        createdByAgentId: agentId,
      },
      { actorType: "agent", actorId: agentId, agentId },
    );

    expect(outcome.companyId).toBe(companyId);
    expect(outcome.outcomeStatus).toBe("succeeded");
    expect(learning.companyId).toBe(companyId);

    const ledger = await svc.listCompanyLedger(companyId);
    expect(ledger.proposalOutcomes).toHaveLength(1);
    expect(ledger.companyLearnings).toHaveLength(1);
    expect(ledger.proposalOutcomes[0].summary).toContain("owner checkpoint");
    expect(ledger.companyLearnings[0].summary).toContain("follow-up comments");

    const otherLedger = await svc.listCompanyLedger(otherCompanyId);
    expect(otherLedger.proposalOutcomes).toHaveLength(0);
    expect(otherLedger.companyLearnings).toHaveLength(0);

    const actions = (await db.select().from(activityLog).where(eq(activityLog.companyId, companyId))).map(
      (row) => row.action,
    );
    expect(actions).toContain("company_ledger.proposal_outcome_recorded");
    expect(actions).toContain("company_ledger.learning_recorded");
  });

  it("rejects proposal outcomes when the proposal belongs to another company", async () => {
    const { otherCompanyId, proposalId } = await seedFixture();

    await expect(
      svc.recordProposalOutcome(
        otherCompanyId,
        {
          proposalId,
          outcomeStatus: "regressed",
          summary: "This should not cross company boundaries.",
          evidenceJson: {},
        },
        { actorType: "user", actorId: "board-user", userId: "board-user" },
      ),
    ).rejects.toThrow(/Proposal must belong to the ledger company/);

    const leaked = await db
      .select()
      .from(proposalOutcomes)
      .where(and(eq(proposalOutcomes.companyId, otherCompanyId), eq(proposalOutcomes.proposalId, proposalId)));
    expect(leaked).toHaveLength(0);
  });
});
