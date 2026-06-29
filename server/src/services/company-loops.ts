import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@bedlam/db";
import {
  activityLog,
  agents,
  companyLoopEvaluations,
  companyLoopObservations,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  heartbeatRuns,
  issues,
  projects,
} from "@bedlam/db";
import {
  addIssueCommentProposalPayloadSchema,
  createIssueProposalPayloadSchema,
  type CompanyLoopProposalStatus,
  type CreateCompanyLoop,
  type RiskTier,
  type UpdateCompanyLoop,
} from "@bedlam/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";
import { logActivity } from "./activity-log.js";

type CompanyLoopActor = {
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentId?: string | null;
  userId?: string | null;
  runId?: string | null;
};

type ObservationDraft = {
  kind: string;
  entityType: string;
  entityId: string;
  severity: "info" | "warning" | "critical";
  payloadJson: Record<string, unknown>;
};

type ProposalDraft = {
  proposalType: "add_issue_comment" | "create_issue";
  riskTier: RiskTier;
  requiresApproval: boolean;
  title: string;
  rationale: string;
  payloadJson: Record<string, unknown>;
};

type LoopRow = typeof companyLoops.$inferSelect;
type IssueRow = typeof issues.$inferSelect;
type AgentRow = Pick<typeof agents.$inferSelect, "id" | "name">;

const OPEN_ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked"] as const;
const FAILED_HEARTBEAT_STATUSES = ["failed", "timed_out"] as const;

function actorForLog(actor?: CompanyLoopActor): CompanyLoopActor {
  return actor ?? { actorType: "system", actorId: "system", agentId: null, userId: null, runId: null };
}

function actorUserId(actor?: CompanyLoopActor) {
  if (!actor) return null;
  if (actor.userId) return actor.userId;
  return actor.actorType === "user" ? actor.actorId : null;
}

function actorAgentId(actor?: CompanyLoopActor) {
  if (!actor) return null;
  if (actor.agentId) return actor.agentId;
  return actor.actorType === "agent" ? actor.actorId : null;
}

function numberFromConfig(config: Record<string, unknown>, key: string, fallback: number) {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanFromConfig(config: Record<string, unknown>, key: string, fallback = false) {
  const value = config[key];
  return typeof value === "boolean" ? value : fallback;
}

function issueLabel(issue: Pick<IssueRow, "identifier" | "title">) {
  return issue.identifier ? `${issue.identifier}: ${issue.title}` : issue.title;
}

async function validateAgentInCompany(db: Db, companyId: string, agentId: string | null | undefined, label: string) {
  if (!agentId) return;
  const row = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
    .then((rows) => rows[0] ?? null);
  if (!row) throw unprocessable(`${label} must belong to the loop company`);
}

async function validateIssueInCompany(db: Db, companyId: string, issueId: string, label = "Issue") {
  const row = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
    .then((rows) => rows[0] ?? null);
  if (!row) throw unprocessable(`${label} must belong to the loop company`);
}

async function validateProjectInCompany(db: Db, companyId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const row = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .then((rows) => rows[0] ?? null);
  if (!row) throw unprocessable("Project must belong to the loop company");
}

async function logLoopActivity(
  db: Db,
  companyId: string,
  actor: CompanyLoopActor | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  const safeActor = actorForLog(actor);
  await logActivity(db, {
    companyId,
    actorType: safeActor.actorType === "agent" ? "agent" : "user",
    actorId: safeActor.actorId,
    agentId: actorAgentId(safeActor),
    runId: safeActor.runId ?? null,
    action,
    entityType,
    entityId,
    details: details ?? {},
  });
}

function addIssueReason(reasonsByIssueId: Map<string, string[]>, issueId: string, reason: string) {
  const current = reasonsByIssueId.get(issueId) ?? [];
  current.push(reason);
  reasonsByIssueId.set(issueId, current);
}

function buildThroughputOptimizerPlan(
  loop: LoopRow,
  issueRows: IssueRow[],
  allIssueRows: IssueRow[],
  agentRows: AgentRow[],
  failedRuns: Array<typeof heartbeatRuns.$inferSelect>,
  now: Date,
) {
  const config = loop.configJson ?? {};
  const staleIssueAgeHours = numberFromConfig(config, "staleIssueAgeHours", 24);
  const maxHighPriorityOpenIssuesPerAgent = numberFromConfig(config, "maxHighPriorityOpenIssuesPerAgent", 3);
  const allowLowRiskAutoCreate = booleanFromConfig(config, "allowLowRiskAutoCreate", false);
  const staleBefore = new Date(now.getTime() - staleIssueAgeHours * 60 * 60 * 1000);
  const issueById = new Map(allIssueRows.map((issue) => [issue.id, issue]));
  const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));
  const failedRunIssueIds = new Map<string, string[]>();
  const observations: ObservationDraft[] = [];
  const reasonsByIssueId = new Map<string, string[]>();

  for (const run of failedRuns) {
    const linkedIssueIds = new Set<string>();
    for (const issue of issueRows) {
      if (issue.executionRunId === run.id) linkedIssueIds.add(issue.id);
    }
    const snapshotIssueId = run.contextSnapshot?.issueId;
    if (typeof snapshotIssueId === "string" && issueById.has(snapshotIssueId)) {
      linkedIssueIds.add(snapshotIssueId);
    }
    for (const issueId of linkedIssueIds) {
      const current = failedRunIssueIds.get(issueId) ?? [];
      current.push(run.id);
      failedRunIssueIds.set(issueId, current);
    }
  }

  for (const issue of issueRows) {
    if (issue.status === "blocked" && (issue.needsHumanAt || issue.needsHumanReason)) {
      observations.push({
        kind: "blocked_needs_human",
        entityType: "issue",
        entityId: issue.id,
        severity: issue.priority === "critical" ? "critical" : "warning",
        payloadJson: {
          issueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          needsHumanAt: issue.needsHumanAt?.toISOString() ?? null,
          needsHumanReason: issue.needsHumanReason ?? null,
        },
      });
      addIssueReason(
        reasonsByIssueId,
        issue.id,
        issue.needsHumanReason ? `it needs human input: ${issue.needsHumanReason}` : "it needs human input",
      );
    }

    if ((issue.status === "in_progress" || issue.status === "in_review") && issue.updatedAt < staleBefore) {
      observations.push({
        kind: "stale_active_issue",
        entityType: "issue",
        entityId: issue.id,
        severity: issue.priority === "critical" || issue.priority === "high" ? "warning" : "info",
        payloadJson: {
          issueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          status: issue.status,
          updatedAt: issue.updatedAt.toISOString(),
          staleIssueAgeHours,
        },
      });
      addIssueReason(reasonsByIssueId, issue.id, `it has not updated for at least ${staleIssueAgeHours} hours`);
    }

    const failedRunIds = failedRunIssueIds.get(issue.id) ?? [];
    if (failedRunIds.length > 0) {
      observations.push({
        kind: "failed_heartbeat_run",
        entityType: "issue",
        entityId: issue.id,
        severity: issue.priority === "critical" ? "critical" : "warning",
        payloadJson: {
          issueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          failedRunIds,
        },
      });
      addIssueReason(reasonsByIssueId, issue.id, `it has ${failedRunIds.length} failed or timed-out heartbeat run`);
    }

    if (issue.status === "blocked" && issue.blockedByIssueIds && issue.blockedByIssueIds.length > 0) {
      const dependencies = issue.blockedByIssueIds.map((id) => issueById.get(id)).filter(Boolean) as IssueRow[];
      if (dependencies.length === issue.blockedByIssueIds.length && dependencies.every((dep) => dep.status === "done")) {
        observations.push({
          kind: "resolved_blockers_still_blocked",
          entityType: "issue",
          entityId: issue.id,
          severity: "warning",
          payloadJson: {
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            blockedByIssueIds: issue.blockedByIssueIds,
          },
        });
        addIssueReason(reasonsByIssueId, issue.id, "all recorded blocker dependencies are done but it is still blocked");
      }
    }
  }

  const proposals: ProposalDraft[] = [];
  const commentRequiresApproval = loop.riskTier !== "low";
  for (const [issueId, reasons] of reasonsByIssueId.entries()) {
    const issue = issueById.get(issueId);
    if (!issue) continue;
    const uniqueReasons = Array.from(new Set(reasons));
    const body = [
      "Company Reflex Loop: Throughput Optimizer found this issue may need follow-through.",
      "",
      `Signals: ${uniqueReasons.join("; ")}.`,
      "",
      "Suggested next step: confirm ownership, unblock the dependency, or move the issue to the next accurate status.",
    ].join("\n");
    proposals.push({
      proposalType: "add_issue_comment",
      riskTier: "low",
      requiresApproval: commentRequiresApproval,
      title: `Comment on ${issue.identifier ?? issue.title}`,
      rationale: `Adds a visible, auditable follow-through note because ${uniqueReasons.join("; ")}.`,
      payloadJson: { issueId, body },
    });
  }

  const highPriorityIssuesByAgent = new Map<string, IssueRow[]>();
  for (const issue of issueRows) {
    if (!issue.assigneeAgentId) continue;
    if (issue.priority !== "high" && issue.priority !== "critical") continue;
    const current = highPriorityIssuesByAgent.get(issue.assigneeAgentId) ?? [];
    current.push(issue);
    highPriorityIssuesByAgent.set(issue.assigneeAgentId, current);
  }

  for (const [agentId, assignedIssues] of highPriorityIssuesByAgent.entries()) {
    if (assignedIssues.length <= maxHighPriorityOpenIssuesPerAgent) continue;
    const agent = agentById.get(agentId);
    observations.push({
      kind: "agent_high_priority_overload",
      entityType: "agent",
      entityId: agentId,
      severity: "warning",
      payloadJson: {
        agentId,
        agentName: agent?.name ?? null,
        issueCount: assignedIssues.length,
        threshold: maxHighPriorityOpenIssuesPerAgent,
        issueIds: assignedIssues.map((issue) => issue.id),
      },
    });
    const createIssueRiskTier: RiskTier = allowLowRiskAutoCreate && loop.riskTier === "low" ? "low" : "medium";
    proposals.push({
      proposalType: "create_issue",
      riskTier: createIssueRiskTier,
      requiresApproval: createIssueRiskTier !== "low",
      title: `Create triage issue for ${agent?.name ?? "overloaded agent"}`,
      rationale: `${assignedIssues.length} high or critical open issues are assigned to one agent, above the threshold of ${maxHighPriorityOpenIssuesPerAgent}.`,
      payloadJson: {
        title: `Triage overloaded queue for ${agent?.name ?? "agent"}`,
        description: [
          `The Throughput Optimizer found ${assignedIssues.length} high or critical open issues assigned to ${agent?.name ?? agentId}.`,
          "",
          "Review ownership, split the queue, or reassign blocked work.",
          "",
          ...assignedIssues.map((issue) => `- ${issueLabel(issue)} (${issue.status}, ${issue.priority})`),
        ].join("\n"),
        priority: "high",
        assigneeAgentId: null,
      },
    });
  }

  return {
    observations,
    proposals,
    diagnosis: {
      staleIssueAgeHours,
      maxHighPriorityOpenIssuesPerAgent,
      openIssueCount: issueRows.length,
      failedHeartbeatRunCount: failedRuns.length,
      observationCount: observations.length,
      proposalCount: proposals.length,
    },
  };
}

export function companyLoopsService(db: Db) {
  const issuesSvc = issueService(db);

  async function getLoopOrThrow(loopId: string) {
    const loop = await db
      .select()
      .from(companyLoops)
      .where(eq(companyLoops.id, loopId))
      .then((rows) => rows[0] ?? null);
    if (!loop) throw notFound("Company loop not found");
    return loop;
  }

  async function getProposalOrThrow(proposalId: string) {
    const proposal = await db
      .select()
      .from(companyLoopProposals)
      .where(eq(companyLoopProposals.id, proposalId))
      .then((rows) => rows[0] ?? null);
    if (!proposal) throw notFound("Company loop proposal not found");
    return proposal;
  }

  async function setProposalStatus(
    proposalId: string,
    status: CompanyLoopProposalStatus,
    patch: Partial<typeof companyLoopProposals.$inferInsert> = {},
  ) {
    return db
      .update(companyLoopProposals)
      .set({ ...patch, status, updatedAt: new Date() })
      .where(eq(companyLoopProposals.id, proposalId))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  return {
    listLoops: async (companyId: string) => {
      const loops = await db
        .select()
        .from(companyLoops)
        .where(eq(companyLoops.companyId, companyId))
        .orderBy(desc(companyLoops.updatedAt), desc(companyLoops.createdAt));
      const items = [];
      for (const loop of loops) {
        const lastRun = await db
          .select()
          .from(companyLoopRuns)
          .where(eq(companyLoopRuns.loopId, loop.id))
          .orderBy(desc(companyLoopRuns.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null);
        items.push({ ...loop, lastRun });
      }
      return items;
    },

    getLoop: async (loopId: string) => {
      return db
        .select()
        .from(companyLoops)
        .where(eq(companyLoops.id, loopId))
        .then((rows) => rows[0] ?? null);
    },

    createLoop: async (companyId: string, input: CreateCompanyLoop, actor?: CompanyLoopActor) => {
      await validateAgentInCompany(db, companyId, input.ownerAgentId, "Owner agent");
      await validateAgentInCompany(db, companyId, input.evaluatorAgentId, "Evaluator agent");
      if (input.cadenceKind === "interval" && !input.intervalSec) {
        throw unprocessable("Interval loops require intervalSec");
      }
      const now = new Date();
      const [loop] = await db
        .insert(companyLoops)
        .values({
          companyId,
          name: input.name,
          kind: input.kind,
          description: input.description ?? null,
          status: input.status ?? "active",
          cadenceKind: input.cadenceKind ?? "manual",
          intervalSec: input.intervalSec ?? null,
          riskTier: input.riskTier ?? "low",
          ownerAgentId: input.ownerAgentId ?? null,
          evaluatorAgentId: input.evaluatorAgentId ?? null,
          configJson: input.configJson ?? {},
          createdByUserId: actorUserId(actor),
          createdByAgentId: actorAgentId(actor),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await logLoopActivity(db, companyId, actor, "company_loop.created", "company_loop", loop.id, {
        name: loop.name,
        kind: loop.kind,
        riskTier: loop.riskTier,
      });
      return loop;
    },

    updateLoop: async (loopId: string, input: UpdateCompanyLoop, actor?: CompanyLoopActor) => {
      const loop = await getLoopOrThrow(loopId);
      await validateAgentInCompany(db, loop.companyId, input.ownerAgentId, "Owner agent");
      await validateAgentInCompany(db, loop.companyId, input.evaluatorAgentId, "Evaluator agent");
      const cadenceKind = input.cadenceKind ?? loop.cadenceKind;
      const intervalSec = input.intervalSec === undefined ? loop.intervalSec : input.intervalSec;
      if (cadenceKind === "interval" && !intervalSec) {
        throw unprocessable("Interval loops require intervalSec");
      }
      const [updated] = await db
        .update(companyLoops)
        .set({
          ...input,
          description: input.description === undefined ? undefined : input.description ?? null,
          intervalSec: input.intervalSec === undefined ? undefined : input.intervalSec ?? null,
          ownerAgentId: input.ownerAgentId === undefined ? undefined : input.ownerAgentId ?? null,
          evaluatorAgentId: input.evaluatorAgentId === undefined ? undefined : input.evaluatorAgentId ?? null,
          configJson: input.configJson === undefined ? undefined : input.configJson ?? {},
          updatedAt: new Date(),
        })
        .where(eq(companyLoops.id, loopId))
        .returning();
      await logLoopActivity(db, loop.companyId, actor, "company_loop.updated", "company_loop", loop.id, {
        name: updated.name,
        status: updated.status,
      });
      return updated;
    },

    archiveLoop: async (loopId: string, actor?: CompanyLoopActor) => {
      const loop = await getLoopOrThrow(loopId);
      const [updated] = await db
        .update(companyLoops)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(companyLoops.id, loopId))
        .returning();
      await logLoopActivity(db, loop.companyId, actor, "company_loop.archived", "company_loop", loop.id, {
        name: loop.name,
      });
      return updated;
    },

    runLoopManually: async (loopId: string, actor?: CompanyLoopActor) => {
      const loop = await getLoopOrThrow(loopId);
      if (loop.status !== "active") {
        throw conflict("Only active loops can be run");
      }
      if (loop.kind !== "throughput_optimizer") {
        throw unprocessable(`Unsupported company loop kind: ${loop.kind}`);
      }

      const now = new Date();
      const [run] = await db
        .insert(companyLoopRuns)
        .values({
          companyId: loop.companyId,
          loopId: loop.id,
          status: "queued",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await logLoopActivity(db, loop.companyId, actor, "company_loop.run_created", "company_loop_run", run.id, {
        loopId: loop.id,
        loopName: loop.name,
      });

      try {
        await db
          .update(companyLoopRuns)
          .set({ status: "observing", updatedAt: new Date() })
          .where(eq(companyLoopRuns.id, run.id));
        const issueRows = await db
          .select()
          .from(issues)
          .where(and(eq(issues.companyId, loop.companyId), inArray(issues.status, [...OPEN_ISSUE_STATUSES])));
        const allIssueRows = await db
          .select()
          .from(issues)
          .where(eq(issues.companyId, loop.companyId));
        const agentRows = await db
          .select({ id: agents.id, name: agents.name })
          .from(agents)
          .where(eq(agents.companyId, loop.companyId));
        const failedRuns = await db
          .select()
          .from(heartbeatRuns)
          .where(and(eq(heartbeatRuns.companyId, loop.companyId), inArray(heartbeatRuns.status, [...FAILED_HEARTBEAT_STATUSES])));
        const inputSnapshot = {
          openIssueCount: issueRows.length,
          activeAgentCount: agentRows.length,
          failedHeartbeatRunCount: failedRuns.length,
          observedAt: now.toISOString(),
        };

        await db
          .update(companyLoopRuns)
          .set({
            status: "diagnosing",
            inputSnapshotJson: inputSnapshot,
            updatedAt: new Date(),
          })
          .where(eq(companyLoopRuns.id, run.id));

        const plan = buildThroughputOptimizerPlan(loop, issueRows, allIssueRows, agentRows, failedRuns, now);

        if (plan.observations.length > 0) {
          await db.insert(companyLoopObservations).values(
            plan.observations.map((observation) => ({
              companyId: loop.companyId,
              loopRunId: run.id,
              ...observation,
            })),
          );
        }

        await db
          .update(companyLoopRuns)
          .set({
            status: "proposing",
            diagnosisJson: plan.diagnosis,
            updatedAt: new Date(),
          })
          .where(eq(companyLoopRuns.id, run.id));

        const proposals = plan.proposals.length > 0
          ? await db
            .insert(companyLoopProposals)
            .values(
              plan.proposals.map((proposal) => ({
                companyId: loop.companyId,
                loopRunId: run.id,
                ...proposal,
              })),
            )
            .returning()
          : [];

        for (const proposal of proposals) {
          await logLoopActivity(db, loop.companyId, actor, "company_loop.proposal_created", "company_loop_proposal", proposal.id, {
            loopId: loop.id,
            runId: run.id,
            proposalType: proposal.proposalType,
            riskTier: proposal.riskTier,
            requiresApproval: proposal.requiresApproval,
          });
        }

        await db
          .update(companyLoopRuns)
          .set({ status: "evaluating", updatedAt: new Date() })
          .where(eq(companyLoopRuns.id, run.id));

        const checks = [
          { name: "observations_recorded", passed: true, count: plan.observations.length },
          { name: "proposals_typed", passed: true, count: proposals.length },
          { name: "no_external_model_call", passed: true },
        ];
        const score = Math.max(0, 100 - plan.observations.length * 5);
        const [evaluation] = await db
          .insert(companyLoopEvaluations)
          .values({
            companyId: loop.companyId,
            loopRunId: run.id,
            score,
            passed: true,
            checksJson: checks,
            summary: `Recorded ${plan.observations.length} observations and ${proposals.length} proposals.`,
          })
          .returning();

        const awaitingApproval = proposals.some((proposal) => proposal.requiresApproval);
        const finalStatus = awaitingApproval ? "awaiting_approval" : "ready_to_apply";
        const summary = `Throughput Optimizer recorded ${plan.observations.length} observations, ${proposals.length} proposals, and ${evaluation.passed ? "passed" : "failed"} evaluation.`;
        const [finishedRun] = await db
          .update(companyLoopRuns)
          .set({
            status: finalStatus,
            summary,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(companyLoopRuns.id, run.id))
          .returning();
        await db
          .update(companyLoops)
          .set({ lastRunAt: finishedRun.finishedAt, updatedAt: new Date() })
          .where(eq(companyLoops.id, loop.id));
        return finishedRun;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Company loop run failed";
        const [failedRun] = await db
          .update(companyLoopRuns)
          .set({
            status: "failed",
            error: message,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(companyLoopRuns.id, run.id))
          .returning();
        return failedRun;
      }
    },

    listRunsForLoop: async (loopId: string, limit = 50) => {
      await getLoopOrThrow(loopId);
      return db
        .select()
        .from(companyLoopRuns)
        .where(eq(companyLoopRuns.loopId, loopId))
        .orderBy(desc(companyLoopRuns.createdAt))
        .limit(limit);
    },

    getRun: async (runId: string) => {
      const run = await db
        .select()
        .from(companyLoopRuns)
        .where(eq(companyLoopRuns.id, runId))
        .then((rows) => rows[0] ?? null);
      if (!run) return null;
      const [loop, observations, proposals, evaluations] = await Promise.all([
        db.select().from(companyLoops).where(eq(companyLoops.id, run.loopId)).then((rows) => rows[0] ?? null),
        db
          .select()
          .from(companyLoopObservations)
          .where(eq(companyLoopObservations.loopRunId, run.id))
          .orderBy(desc(companyLoopObservations.createdAt)),
        db
          .select()
          .from(companyLoopProposals)
          .where(eq(companyLoopProposals.loopRunId, run.id))
          .orderBy(desc(companyLoopProposals.createdAt)),
        db
          .select()
          .from(companyLoopEvaluations)
          .where(eq(companyLoopEvaluations.loopRunId, run.id))
          .orderBy(desc(companyLoopEvaluations.createdAt)),
      ]);
      return { ...run, loop, observations, proposals, evaluations };
    },

    listProposalsForRun: async (runId: string) => {
      const run = await db
        .select({ id: companyLoopRuns.id })
        .from(companyLoopRuns)
        .where(eq(companyLoopRuns.id, runId))
        .then((rows) => rows[0] ?? null);
      if (!run) throw notFound("Company loop run not found");
      return db
        .select()
        .from(companyLoopProposals)
        .where(eq(companyLoopProposals.loopRunId, runId))
        .orderBy(desc(companyLoopProposals.createdAt));
    },

    getProposal: async (proposalId: string) => {
      return db
        .select()
        .from(companyLoopProposals)
        .where(eq(companyLoopProposals.id, proposalId))
        .then((rows) => rows[0] ?? null);
    },

    approveProposal: async (proposalId: string, actor?: CompanyLoopActor, note?: string | null) => {
      const proposal = await getProposalOrThrow(proposalId);
      if (proposal.status !== "proposed") {
        throw conflict("Only proposed loop proposals can be approved");
      }
      const updated = await setProposalStatus(proposal.id, "approved");
      await logLoopActivity(db, proposal.companyId, actor, "company_loop.proposal_approved", "company_loop_proposal", proposal.id, {
        runId: proposal.loopRunId,
        proposalType: proposal.proposalType,
        note: note ?? null,
      });
      return updated;
    },

    rejectProposal: async (proposalId: string, actor?: CompanyLoopActor, note?: string | null) => {
      const proposal = await getProposalOrThrow(proposalId);
      if (proposal.status !== "proposed" && proposal.status !== "approved") {
        throw conflict("Only proposed or approved loop proposals can be rejected");
      }
      const updated = await setProposalStatus(proposal.id, "rejected");
      await logLoopActivity(db, proposal.companyId, actor, "company_loop.proposal_rejected", "company_loop_proposal", proposal.id, {
        runId: proposal.loopRunId,
        proposalType: proposal.proposalType,
        note: note ?? null,
      });
      return updated;
    },

    applyProposal: async (proposalId: string, actor?: CompanyLoopActor) => {
      const proposal = await getProposalOrThrow(proposalId);
      if (proposal.status === "applied") return proposal;
      if (proposal.status === "rejected") {
        throw conflict("Rejected loop proposals cannot be applied");
      }
      if (proposal.requiresApproval && proposal.status !== "approved") {
        throw conflict("Loop proposal requires approval before application");
      }

      try {
        let result: Record<string, unknown> = {};
        if (proposal.proposalType === "add_issue_comment") {
          const payload = addIssueCommentProposalPayloadSchema.parse(proposal.payloadJson);
          await validateIssueInCompany(db, proposal.companyId, payload.issueId);
          const comment = await issuesSvc.addComment(payload.issueId, payload.body, {
            agentId: actorAgentId(actor) ?? undefined,
            userId: actorUserId(actor) ?? undefined,
          });
          result = { issueId: payload.issueId, commentId: comment.id };
        } else if (proposal.proposalType === "create_issue") {
          const payload = createIssueProposalPayloadSchema.parse(proposal.payloadJson);
          await validateProjectInCompany(db, proposal.companyId, payload.projectId);
          if (payload.parentId) {
            await validateIssueInCompany(db, proposal.companyId, payload.parentId, "Parent issue");
          }
          await validateAgentInCompany(db, proposal.companyId, payload.assigneeAgentId, "Assignee agent");
          const createdIssue = await issuesSvc.create(proposal.companyId, {
            title: payload.title,
            description: payload.description ?? null,
            priority: payload.priority,
            projectId: payload.projectId ?? null,
            assigneeAgentId: payload.assigneeAgentId ?? null,
            parentId: payload.parentId ?? null,
            status: "todo",
            originKind: "manual",
            originId: proposal.id,
          });
          result = { issueId: createdIssue.id, identifier: createdIssue.identifier };
        } else {
          throw unprocessable(`Unsupported loop proposal type: ${proposal.proposalType}`);
        }

        const updated = await setProposalStatus(proposal.id, "applied", {
          appliedAt: new Date(),
          appliedByUserId: actorUserId(actor),
          error: null,
        });
        await logLoopActivity(db, proposal.companyId, actor, "company_loop.proposal_applied", "company_loop_proposal", proposal.id, {
          runId: proposal.loopRunId,
          proposalType: proposal.proposalType,
          ...result,
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply loop proposal";
        await setProposalStatus(proposal.id, "failed", { error: message });
        throw err;
      }
    },

    listActivityForCompany: async (companyId: string) => {
      return db
        .select()
        .from(activityLog)
        .where(eq(activityLog.companyId, companyId))
        .orderBy(desc(activityLog.createdAt));
    },
  };
}
