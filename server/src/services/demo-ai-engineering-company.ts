import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@bedlam/db";
import {
  activityLog,
  agents,
  budgetPolicies,
  companies,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  goals,
  heartbeatRuns,
  issueLabels,
  issues,
  labels,
  projects,
} from "@bedlam/db";
import { companyLedgerService } from "./company-ledger.js";
import { companyLoopsService } from "./company-loops.js";
import { logActivity } from "./activity-log.js";

const DEMO_COMPANY_NAME = "Bedlam AI Engineering Company";
const DEMO_COMPANY_PREFIX = "AEC";

type DemoActor = {
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentId?: string | null;
  userId?: string | null;
  runId?: string | null;
};

export type AiEngineeringCompanyDemoSeedResult = {
  companyId: string;
  created: boolean;
  agentIds: Record<string, string>;
  projectId: string;
  issueIds: Record<string, string>;
  loopId: string;
};

function hoursBefore(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function actorUserId(actor: DemoActor) {
  if (actor.userId) return actor.userId;
  return actor.actorType === "user" ? actor.actorId : null;
}

function actorAgentId(actor: DemoActor) {
  if (actor.agentId) return actor.agentId;
  return actor.actorType === "agent" ? actor.actorId : null;
}

async function findCompany(db: Db) {
  return db
    .select()
    .from(companies)
    .where(eq(companies.issuePrefix, DEMO_COMPANY_PREFIX))
    .then((rows) => rows[0] ?? null);
}

async function ensureCompany(db: Db, now: Date) {
  const existing = await findCompany(db);
  if (existing) return { company: existing, created: false };

  const [company] = await db
    .insert(companies)
    .values({
      name: DEMO_COMPANY_NAME,
      description: "A deterministic local-first agent company control plane demo for improving Bedlam.",
      status: "active",
      issuePrefix: DEMO_COMPANY_PREFIX,
      budgetMonthlyCents: 5000,
      spentMonthlyCents: 875,
      requireBoardApprovalForNewAgents: false,
      brandColor: "#0f766e",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { company, created: true };
}

async function ensureAgent(
  db: Db,
  input: {
    companyId: string;
    name: string;
    role: string;
    title: string;
    reportsTo?: string | null;
    capabilities: string;
    budgetMonthlyCents: number;
    icon: string;
    now: Date;
  },
) {
  const existing = await db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, input.companyId), eq(agents.name, input.name)))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(agents)
    .values({
      companyId: input.companyId,
      name: input.name,
      role: input.role,
      title: input.title,
      icon: input.icon,
      status: "active",
      reportsTo: input.reportsTo ?? null,
      capabilities: input.capabilities,
      adapterType: "process",
      adapterConfig: {
        command: "echo",
        args: [`${input.name} demo fixture: no external model or CLI call required.`],
        timeoutSec: 30,
      },
      runtimeConfig: {},
      permissions: { demo: true, autonomousMutations: false },
      budgetMonthlyCents: input.budgetMonthlyCents,
      spentMonthlyCents: Math.round(input.budgetMonthlyCents * 0.16),
      metadata: { demoSeed: "ai_engineering_company" },
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureGoal(
  db: Db,
  input: {
    companyId: string;
    title: string;
    description: string;
    level: string;
    status: string;
    parentId?: string | null;
    ownerAgentId?: string | null;
    now: Date;
  },
) {
  const existing = await db
    .select()
    .from(goals)
    .where(and(eq(goals.companyId, input.companyId), eq(goals.title, input.title)))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(goals)
    .values({
      companyId: input.companyId,
      title: input.title,
      description: input.description,
      level: input.level,
      status: input.status,
      parentId: input.parentId ?? null,
      ownerAgentId: input.ownerAgentId ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureProject(
  db: Db,
  input: {
    companyId: string;
    goalId: string;
    leadAgentId: string;
    now: Date;
  },
) {
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.companyId, input.companyId), eq(projects.name, "Improve Bedlam")))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(projects)
    .values({
      companyId: input.companyId,
      goalId: input.goalId,
      leadAgentId: input.leadAgentId,
      name: "Improve Bedlam",
      description: "Make Bedlam instantly adoptable by shipping the AI Engineering Company flagship demo.",
      status: "in_progress",
      color: "#0f766e",
      executionWorkspacePolicy: {
        workspaceStrategy: "reuse_existing",
        demoOnly: true,
      },
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureLabel(db: Db, companyId: string, name: string, color: string, now: Date) {
  const existing = await db
    .select()
    .from(labels)
    .where(and(eq(labels.companyId, companyId), eq(labels.name, name)))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(labels)
    .values({ companyId, name, color, createdAt: now, updatedAt: now })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureIssue(
  db: Db,
  input: {
    companyId: string;
    projectId: string;
    goalId: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assigneeAgentId?: string | null;
    createdByAgentId?: string | null;
    blockedReason?: string | null;
    needsHumanReason?: string | null;
    needsHumanAt?: Date | null;
    executionRunId?: string | null;
    updatedAt: Date;
    now: Date;
  },
) {
  const existing = await db
    .select()
    .from(issues)
    .where(and(eq(issues.companyId, input.companyId), eq(issues.title, input.title)))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(issues)
    .values({
      companyId: input.companyId,
      projectId: input.projectId,
      goalId: input.goalId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeAgentId: input.assigneeAgentId ?? null,
      createdByAgentId: input.createdByAgentId ?? null,
      blockedReason: input.blockedReason ?? null,
      needsHumanReason: input.needsHumanReason ?? null,
      needsHumanAt: input.needsHumanAt ?? null,
      executionRunId: input.executionRunId ?? null,
      startedAt: input.status === "in_progress" ? input.updatedAt : null,
      originKind: "manual",
      originId: "demo-ai-engineering-company",
      createdAt: input.now,
      updatedAt: input.updatedAt,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureIssueLabel(db: Db, companyId: string, issueId: string, labelId: string) {
  const existing = await db
    .select()
    .from(issueLabels)
    .where(and(eq(issueLabels.issueId, issueId), eq(issueLabels.labelId, labelId)))
    .then((rows) => rows[0] ?? null);
  if (existing) return;
  await db.insert(issueLabels).values({ companyId, issueId, labelId });
}

async function ensureFailedRun(db: Db, companyId: string, agentId: string, now: Date) {
  const existing = await db
    .select()
    .from(heartbeatRuns)
    .where(and(eq(heartbeatRuns.companyId, companyId), eq(heartbeatRuns.externalRunId, "demo-failed-run-1")))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;
  const failedAt = hoursBefore(now, 36);
  return db
    .insert(heartbeatRuns)
    .values({
      companyId,
      agentId,
      invocationSource: "assignment",
      status: "failed",
      startedAt: failedAt,
      finishedAt: failedAt,
      externalRunId: "demo-failed-run-1",
      error: "Demo fixture: local adapter exited before writing a follow-up note.",
      contextSnapshot: { demoSeed: "ai_engineering_company" },
      createdAt: failedAt,
      updatedAt: failedAt,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureBudgetPolicy(
  db: Db,
  input: {
    companyId: string;
    scopeType: string;
    scopeId: string;
    amount: number;
    warnPercent: number;
    now: Date;
  },
) {
  const existing = await db
    .select()
    .from(budgetPolicies)
    .where(
      and(
        eq(budgetPolicies.companyId, input.companyId),
        eq(budgetPolicies.scopeType, input.scopeType),
        eq(budgetPolicies.scopeId, input.scopeId),
        eq(budgetPolicies.metric, "billed_cents"),
        eq(budgetPolicies.windowKind, "monthly"),
      ),
    )
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return db
    .insert(budgetPolicies)
    .values({
      companyId: input.companyId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      metric: "billed_cents",
      windowKind: "monthly",
      amount: input.amount,
      warnPercent: input.warnPercent,
      hardStopEnabled: true,
      notifyEnabled: true,
      isActive: true,
      createdByUserId: "demo-seed",
      updatedByUserId: "demo-seed",
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .then((rows) => rows[0]);
}

async function ensureLoop(
  db: Db,
  input: {
    companyId: string;
    ownerAgentId: string;
    evaluatorAgentId: string;
    actor: DemoActor;
  },
) {
  const existing = await db
    .select()
    .from(companyLoops)
    .where(and(eq(companyLoops.companyId, input.companyId), eq(companyLoops.kind, "throughput_optimizer")))
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  return companyLoopsService(db).createLoop(
    input.companyId,
    {
      name: "Throughput Optimizer",
      kind: "throughput_optimizer",
      description: "Diagnose stale, blocked, failed, and overloaded work without making unsafe changes.",
      status: "active",
      cadenceKind: "manual",
      riskTier: "low",
      ownerAgentId: input.ownerAgentId,
      evaluatorAgentId: input.evaluatorAgentId,
      configJson: {
        staleIssueAgeHours: 24,
        maxHighPriorityOpenIssuesPerAgent: 2,
        allowLowRiskAutoCreate: false,
        demoSeed: "ai_engineering_company",
      },
    },
    input.actor,
  );
}

async function ensureInitialLoopRun(db: Db, loopId: string, companyId: string, actor: DemoActor) {
  const existing = await db
    .select()
    .from(companyLoopRuns)
    .where(eq(companyLoopRuns.loopId, loopId))
    .orderBy(desc(companyLoopRuns.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existing) return existing;

  const run = await companyLoopsService(db).runLoopManually(loopId, actor);
  await logActivity(db, {
    companyId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    agentId: actorAgentId(actor),
    runId: actor.runId ?? null,
    action: "demo.ai_engineering.loop_ran",
    entityType: "company_loop_run",
    entityId: run.id,
    details: { loopId, status: run.status },
  });
  return run;
}

async function ensureLedgerEntries(db: Db, companyId: string, runId: string, actor: DemoActor) {
  const ledger = companyLedgerService(db);
  const existing = await ledger.listCompanyLedger(companyId, 50);
  if (existing.companyLearnings.length === 0) {
    await ledger.recordLearning(
      companyId,
      {
        sourceType: "demo_seed",
        sourceId: "ai_engineering_company",
        category: "throughput",
        summary: "Stale and blocked work should be diagnosed by governed loops before agents create more work.",
        evidenceJson: {
          loopRunId: runId,
          demoSignals: ["stale_in_progress", "blocked", "failed_run", "review_queue"],
        },
      },
      actor,
    );
  }

  if (existing.proposalOutcomes.length === 0) {
    const proposal = await db
      .select()
      .from(companyLoopProposals)
      .where(eq(companyLoopProposals.loopRunId, runId))
      .orderBy(desc(companyLoopProposals.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    await ledger.recordProposalOutcome(
      companyId,
      {
        proposalId: proposal?.id ?? null,
        outcomeStatus: "observing",
        summary: "Demo proposal is being observed so the company can learn whether the intervention improves flow.",
        evidenceJson: {
          loopRunId: runId,
          proposalType: proposal?.proposalType ?? null,
        },
      },
      actor,
    );
  }
}

export async function seedAiEngineeringCompanyDemo(
  db: Db,
  opts: {
    actor?: DemoActor;
    now?: Date;
  } = {},
): Promise<AiEngineeringCompanyDemoSeedResult> {
  const now = opts.now ?? new Date();
  const actor = opts.actor ?? { actorType: "system", actorId: "demo-seed" };
  const { company, created } = await ensureCompany(db, now);

  const ceo = await ensureAgent(db, {
    companyId: company.id,
    name: "CEO",
    role: "ceo",
    title: "Chief Executive Officer",
    icon: "crown",
    capabilities: "Sets mission, reviews company health, and approves safe operating changes.",
    budgetMonthlyCents: 1200,
    now,
  });
  const cto = await ensureAgent(db, {
    companyId: company.id,
    name: "CTO",
    role: "cto",
    title: "Chief Technology Officer",
    reportsTo: ceo.id,
    icon: "circuit-board",
    capabilities: "Owns engineering direction, decomposition, and technical risk.",
    budgetMonthlyCents: 1000,
    now,
  });
  const engineer = await ensureAgent(db, {
    companyId: company.id,
    name: "Engineer",
    role: "engineer",
    title: "Product Engineer",
    reportsTo: cto.id,
    icon: "code",
    capabilities: "Implements scoped Bedlam improvements and reports blockers.",
    budgetMonthlyCents: 900,
    now,
  });
  const reviewer = await ensureAgent(db, {
    companyId: company.id,
    name: "Reviewer",
    role: "qa",
    title: "Code Reviewer",
    reportsTo: cto.id,
    icon: "eye",
    capabilities: "Reviews proposals, checks tests, and prevents unsafe changes.",
    budgetMonthlyCents: 700,
    now,
  });
  const merger = await ensureAgent(db, {
    companyId: company.id,
    name: "Merger",
    role: "devops",
    title: "Merge Steward",
    reportsTo: cto.id,
    icon: "git-branch",
    capabilities: "Keeps review queues moving and merges approved work.",
    budgetMonthlyCents: 650,
    now,
  });
  const budgetSteward = await ensureAgent(db, {
    companyId: company.id,
    name: "Budget Steward",
    role: "cfo",
    title: "Budget Steward",
    reportsTo: ceo.id,
    icon: "shield",
    capabilities: "Tracks spend, warns on burn, and protects hard budget stops.",
    budgetMonthlyCents: 450,
    now,
  });
  const qualitySteward = await ensureAgent(db, {
    companyId: company.id,
    name: "Quality Steward",
    role: "qa",
    title: "Quality Steward",
    reportsTo: cto.id,
    icon: "radar",
    capabilities: "Evaluates loop outputs, regression risk, and durable learnings.",
    budgetMonthlyCents: 500,
    now,
  });

  const missionGoal = await ensureGoal(db, {
    companyId: company.id,
    title: "Make Bedlam instantly adoptable",
    description: "A new user should understand and trust Bedlam as a local-first agent company control plane in five minutes.",
    level: "company",
    status: "active",
    ownerAgentId: ceo.id,
    now,
  });
  const demoGoal = await ensureGoal(db, {
    companyId: company.id,
    title: "Create a 5-minute AI company wow moment",
    description: "Install the demo company, run a reflex loop, and see governed proposals plus ledger entries.",
    level: "team",
    status: "active",
    parentId: missionGoal.id,
    ownerAgentId: cto.id,
    now,
  });
  await ensureGoal(db, {
    companyId: company.id,
    title: "Keep every autonomous change safe and reviewable",
    description: "No hidden model spend, no autonomous config changes, and no unsafe budget changes.",
    level: "team",
    status: "active",
    parentId: missionGoal.id,
    ownerAgentId: qualitySteward.id,
    now,
  });

  const project = await ensureProject(db, {
    companyId: company.id,
    goalId: demoGoal.id,
    leadAgentId: cto.id,
    now,
  });

  const labelMap = new Map<string, string>();
  for (const [name, color] of [
    ["demo", "#0f766e"],
    ["blocked", "#dc2626"],
    ["high-priority", "#f97316"],
    ["review-queue", "#6366f1"],
    ["reflex-loop", "#0891b2"],
  ] as const) {
    const label = await ensureLabel(db, company.id, name, color, now);
    labelMap.set(name, label.id);
  }

  const failedRun = await ensureFailedRun(db, company.id, engineer.id, now);
  const issueInputs = [
    {
      key: "staleImplementation",
      title: "Stale in-progress implementation needs owner checkpoint",
      description: "A realistic in-progress task has not reported progress recently. The loop should detect stale active work.",
      status: "in_progress",
      priority: "high",
      assigneeAgentId: engineer.id,
      createdByAgentId: cto.id,
      updatedAt: hoursBefore(now, 72),
      labels: ["demo", "high-priority", "reflex-loop"],
    },
    {
      key: "blockedCliAdoption",
      title: "Blocked CLI adoption task needs product decision",
      description: "The command surface is blocked until the board chooses whether demo install belongs in onboarding or a separate command.",
      status: "blocked",
      priority: "high",
      assigneeAgentId: cto.id,
      createdByAgentId: ceo.id,
      blockedReason: "Needs board decision on default onboarding behavior.",
      needsHumanReason: "Choose whether `bedlam demo ai-engineering` should run during onboarding.",
      needsHumanAt: hoursBefore(now, 18),
      updatedAt: hoursBefore(now, 30),
      labels: ["demo", "blocked", "high-priority"],
    },
    {
      key: "failedRunFollowUp",
      title: "Follow up failed run from local adapter smoke",
      description: "A failed deterministic run needs a visible follow-up so the company can diagnose why work stalled.",
      status: "todo",
      priority: "critical",
      assigneeAgentId: engineer.id,
      createdByAgentId: qualitySteward.id,
      executionRunId: failedRun.id,
      updatedAt: hoursBefore(now, 8),
      labels: ["demo", "high-priority", "reflex-loop"],
    },
    {
      key: "readmeDemo",
      title: "Ship README 5-minute demo path",
      description: "Make the local-first agent company pitch obvious with exact commands and expected output.",
      status: "backlog",
      priority: "high",
      assigneeAgentId: null,
      createdByAgentId: ceo.id,
      updatedAt: hoursBefore(now, 4),
      labels: ["demo", "high-priority"],
    },
    {
      key: "reviewQueue",
      title: "Review queue has no merge owner",
      description: "Several proposed docs and UI updates are waiting for a merger to decide what is safe to apply.",
      status: "in_review",
      priority: "medium",
      assigneeAgentId: reviewer.id,
      createdByAgentId: cto.id,
      updatedAt: hoursBefore(now, 54),
      labels: ["demo", "review-queue", "reflex-loop"],
    },
    {
      key: "budgetGuardrail",
      title: "Confirm demo cannot change budgets or model config autonomously",
      description: "The Budget Steward needs a visible guardrail task proving the demo only proposes safe work.",
      status: "todo",
      priority: "medium",
      assigneeAgentId: budgetSteward.id,
      createdByAgentId: ceo.id,
      updatedAt: hoursBefore(now, 6),
      labels: ["demo"],
    },
  ];

  const issueIds: Record<string, string> = {};
  for (const issueInput of issueInputs) {
    const issue = await ensureIssue(db, {
      companyId: company.id,
      projectId: project.id,
      goalId: demoGoal.id,
      title: issueInput.title,
      description: issueInput.description,
      status: issueInput.status,
      priority: issueInput.priority,
      assigneeAgentId: issueInput.assigneeAgentId,
      createdByAgentId: issueInput.createdByAgentId,
      blockedReason: issueInput.blockedReason,
      needsHumanReason: issueInput.needsHumanReason,
      needsHumanAt: issueInput.needsHumanAt,
      executionRunId: issueInput.executionRunId,
      updatedAt: issueInput.updatedAt,
      now,
    });
    issueIds[issueInput.key] = issue.id;
    for (const labelName of issueInput.labels) {
      const labelId = labelMap.get(labelName);
      if (labelId) await ensureIssueLabel(db, company.id, issue.id, labelId);
    }
  }

  await ensureBudgetPolicy(db, {
    companyId: company.id,
    scopeType: "company",
    scopeId: company.id,
    amount: 5000,
    warnPercent: 70,
    now,
  });
  for (const agent of [engineer, reviewer, budgetSteward]) {
    await ensureBudgetPolicy(db, {
      companyId: company.id,
      scopeType: "agent",
      scopeId: agent.id,
      amount: agent.budgetMonthlyCents,
      warnPercent: 80,
      now,
    });
  }
  await ensureBudgetPolicy(db, {
    companyId: company.id,
    scopeType: "project",
    scopeId: project.id,
    amount: 2500,
    warnPercent: 75,
    now,
  });

  const loop = await ensureLoop(db, {
    companyId: company.id,
    ownerAgentId: cto.id,
    evaluatorAgentId: qualitySteward.id,
    actor,
  });
  const run = await ensureInitialLoopRun(db, loop.id, company.id, actor);
  await ensureLedgerEntries(db, company.id, run.id, actor);

  const seedLog = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(and(eq(activityLog.companyId, company.id), eq(activityLog.action, "demo.ai_engineering.seeded")))
    .then((rows) => rows[0] ?? null);
  if (!seedLog) {
    await logActivity(db, {
      companyId: company.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actorAgentId(actor),
      runId: actor.runId ?? null,
      action: "demo.ai_engineering.seeded",
      entityType: "company",
      entityId: company.id,
      details: {
        projectId: project.id,
        loopId: loop.id,
        deterministic: true,
      },
    });
  }

  return {
    companyId: company.id,
    created,
    agentIds: {
      ceo: ceo.id,
      cto: cto.id,
      engineer: engineer.id,
      reviewer: reviewer.id,
      merger: merger.id,
      budgetSteward: budgetSteward.id,
      qualitySteward: qualitySteward.id,
    },
    projectId: project.id,
    issueIds,
    loopId: loop.id,
  };
}
