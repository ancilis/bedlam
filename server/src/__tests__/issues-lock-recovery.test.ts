import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  createDb,
  heartbeatRuns,
  issues,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { issueService } from "../services/issues.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres issue lock recovery tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("issue lock recovery", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof issueService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-issues-lock-recovery-");
    db = createDb(tempDb.connectionString);
    svc = issueService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompanyAndAgent() {
    const companyId = randomUUID();
    const agentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Bedlam",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    return { companyId, agentId };
  }

  async function seedRun(
    companyId: string,
    agentId: string,
    status: "queued" | "running" | "failed" | "succeeded" | "cancelled",
  ) {
    const runId = randomUUID();
    const terminal = status === "failed" || status === "succeeded" || status === "cancelled";
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status,
      startedAt: status === "queued" ? null : new Date("2026-04-12T12:00:00.000Z"),
      finishedAt: terminal ? new Date("2026-04-12T12:01:00.000Z") : null,
    });
    return runId;
  }

  async function getIssue(issueId: string) {
    return db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
  }

  it("release with clearExecution clears terminal execution locks without releasing ownership", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const runId = await seedRun(companyId, agentId, "failed");
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Recover stale lock",
      status: "in_review",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: runId,
      executionRunId: runId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
    });

    const released = await svc.release(issueId, undefined, null, { clearExecution: true });

    expect(released?.status).toBe("in_review");
    expect(released?.assigneeAgentId).toBe(agentId);
    expect(released?.checkoutRunId).toBeNull();
    expect(released?.executionRunId).toBeNull();
    expect(released?.executionAgentNameKey).toBeNull();
    expect(released?.executionLockedAt).toBeNull();
  });

  it("release with clearExecution clears missing execution locks without releasing ownership", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const missingRunId = randomUUID();
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.execute(sql.raw("ALTER TABLE issues DISABLE TRIGGER ALL"));
    try {
      await db.insert(issues).values({
        id: issueId,
        companyId,
        title: "Recover missing lock",
        status: "in_review",
        priority: "critical",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: missingRunId,
        executionAgentNameKey: "codexcoder",
        executionLockedAt: lockedAt,
      });
    } finally {
      await db.execute(sql.raw("ALTER TABLE issues ENABLE TRIGGER ALL"));
    }

    const released = await svc.release(issueId, undefined, null, { clearExecution: true });

    expect(released?.status).toBe("in_review");
    expect(released?.assigneeAgentId).toBe(agentId);
    expect(released?.checkoutRunId).toBeNull();
    expect(released?.executionRunId).toBeNull();
    expect(released?.executionAgentNameKey).toBeNull();
    expect(released?.executionLockedAt).toBeNull();
  });

  it("release with clearExecution is a no-op when no execution lock exists", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const checkoutRunId = await seedRun(companyId, agentId, "failed");
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "No execution lock",
      status: "in_review",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId,
      executionRunId: null,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
    });

    const released = await svc.release(issueId, undefined, null, { clearExecution: true });

    expect(released?.status).toBe("in_review");
    expect(released?.assigneeAgentId).toBe(agentId);
    expect(released?.checkoutRunId).toBe(checkoutRunId);
    expect(released?.executionRunId).toBeNull();
    expect(released?.executionAgentNameKey).toBe("codexcoder");
    expect(released?.executionLockedAt?.toISOString()).toBe(lockedAt.toISOString());
  });

  it("release with clearExecution lets the assigned agent clear a stale run held by a previous checkout", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const staleRunId = await seedRun(companyId, agentId, "failed");
    const actorRunId = await seedRun(companyId, agentId, "running");
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Recover my stale lock",
      status: "in_progress",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: staleRunId,
      executionRunId: staleRunId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
    });

    const released = await svc.release(issueId, agentId, actorRunId, { clearExecution: true });

    expect(released?.status).toBe("in_progress");
    expect(released?.assigneeAgentId).toBe(agentId);
    expect(released?.checkoutRunId).toBeNull();
    expect(released?.executionRunId).toBeNull();
    expect(released?.executionAgentNameKey).toBeNull();
    expect(released?.executionLockedAt).toBeNull();
  });

  it("release without clearExecution preserves execution locks", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const runId = await seedRun(companyId, agentId, "failed");
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Keep execution lock",
      status: "in_progress",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: runId,
      executionRunId: runId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
    });

    const released = await svc.release(issueId);

    expect(released?.status).toBe("todo");
    expect(released?.assigneeAgentId).toBeNull();
    expect(released?.checkoutRunId).toBeNull();
    expect(released?.executionRunId).toBe(runId);
    expect(released?.executionAgentNameKey).toBe("codexcoder");
    expect(released?.executionLockedAt?.toISOString()).toBe(lockedAt.toISOString());
  });

  it("release with clearExecution rejects active execution locks", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const runId = await seedRun(companyId, agentId, "running");
    const issueId = randomUUID();
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Do not clear active lock",
      status: "in_progress",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: runId,
      executionRunId: runId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
    });

    await expect(svc.release(issueId, undefined, null, { clearExecution: true })).rejects.toMatchObject({
      status: 409,
    });

    const preserved = await getIssue(issueId);
    expect(preserved?.status).toBe("in_progress");
    expect(preserved?.assigneeAgentId).toBe(agentId);
    expect(preserved?.checkoutRunId).toBe(runId);
    expect(preserved?.executionRunId).toBe(runId);
    expect(preserved?.executionAgentNameKey).toBe("codexcoder");
    expect(preserved?.executionLockedAt?.toISOString()).toBe(lockedAt.toISOString());
  });

  it("checkout adopts terminal execution locks for an otherwise allowed assigned todo issue", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const staleRunId = await seedRun(companyId, agentId, "failed");
    const actorRunId = await seedRun(companyId, agentId, "running");
    const issueId = randomUUID();

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Adopt stale execution",
      status: "todo",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: null,
      executionRunId: staleRunId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: new Date("2026-04-12T12:00:30.000Z"),
    });

    const checkedOut = await svc.checkout(issueId, agentId, ["todo"], actorRunId);

    expect(checkedOut.status).toBe("in_progress");
    expect(checkedOut.assigneeAgentId).toBe(agentId);
    expect(checkedOut.checkoutRunId).toBe(actorRunId);
    expect(checkedOut.executionRunId).toBe(actorRunId);
    expect(checkedOut.executionAgentNameKey).toBeNull();
    expect(checkedOut.executionLockedAt).toBeInstanceOf(Date);
  });

  it("checkout rejects active execution locks", async () => {
    const { companyId, agentId } = await seedCompanyAndAgent();
    const activeRunId = await seedRun(companyId, agentId, "queued");
    const actorRunId = await seedRun(companyId, agentId, "running");
    const issueId = randomUUID();

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Keep active execution",
      status: "todo",
      priority: "critical",
      assigneeAgentId: agentId,
      checkoutRunId: null,
      executionRunId: activeRunId,
      executionAgentNameKey: "codexcoder",
      executionLockedAt: new Date("2026-04-12T12:00:30.000Z"),
    });

    await expect(svc.checkout(issueId, agentId, ["todo"], actorRunId)).rejects.toMatchObject({
      status: 409,
    });

    const preserved = await getIssue(issueId);
    expect(preserved?.status).toBe("todo");
    expect(preserved?.checkoutRunId).toBeNull();
    expect(preserved?.executionRunId).toBe(activeRunId);
  });
});
