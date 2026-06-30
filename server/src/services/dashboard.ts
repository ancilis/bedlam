import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@bedlam/db";
import {
  agents,
  approvals,
  budgetPolicies,
  companies,
  companyLearnings,
  companyLoopProposals,
  companyLoopRuns,
  companyLoops,
  costEvents,
  goals,
  issues,
} from "@bedlam/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const orgAgents = await db
        .select({
          id: agents.id,
          name: agents.name,
          role: agents.role,
          title: agents.title,
          status: agents.status,
          reportsTo: agents.reportsTo,
        })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .orderBy(agents.reportsTo, agents.name);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );
      const [missionGoal, staleWork, highPriorityBacklog, loopRows, latestLoopRuns, latestProposals, latestLearnings, activeBudgetPolicyRows] =
        await Promise.all([
          db
            .select()
            .from(goals)
            .where(and(eq(goals.companyId, companyId), eq(goals.level, "company"), eq(goals.status, "active")))
            .orderBy(desc(goals.createdAt))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          db
            .select({
              id: issues.id,
              identifier: issues.identifier,
              title: issues.title,
              status: issues.status,
              priority: issues.priority,
              assigneeAgentId: issues.assigneeAgentId,
              updatedAt: issues.updatedAt,
            })
            .from(issues)
            .where(
              and(
                eq(issues.companyId, companyId),
                inArray(issues.status, ["in_progress", "in_review", "blocked"]),
                lt(issues.updatedAt, staleBefore),
              ),
            )
            .orderBy(issues.updatedAt)
            .limit(10),
          db
            .select({
              id: issues.id,
              identifier: issues.identifier,
              title: issues.title,
              status: issues.status,
              priority: issues.priority,
            })
            .from(issues)
            .where(
              and(
                eq(issues.companyId, companyId),
                inArray(issues.status, ["backlog", "todo"]),
                inArray(issues.priority, ["critical", "high"]),
              ),
            )
            .orderBy(desc(issues.priority), desc(issues.updatedAt))
            .limit(10),
          db
            .select()
            .from(companyLoops)
            .where(eq(companyLoops.companyId, companyId))
            .orderBy(desc(companyLoops.updatedAt), desc(companyLoops.createdAt)),
          db
            .select({
              id: companyLoopRuns.id,
              loopId: companyLoopRuns.loopId,
              status: companyLoopRuns.status,
              summary: companyLoopRuns.summary,
              createdAt: companyLoopRuns.createdAt,
            })
            .from(companyLoopRuns)
            .where(eq(companyLoopRuns.companyId, companyId))
            .orderBy(desc(companyLoopRuns.createdAt))
            .limit(5),
          db
            .select({
              id: companyLoopProposals.id,
              loopRunId: companyLoopProposals.loopRunId,
              proposalType: companyLoopProposals.proposalType,
              status: companyLoopProposals.status,
              title: companyLoopProposals.title,
              riskTier: companyLoopProposals.riskTier,
              requiresApproval: companyLoopProposals.requiresApproval,
              createdAt: companyLoopProposals.createdAt,
            })
            .from(companyLoopProposals)
            .where(eq(companyLoopProposals.companyId, companyId))
            .orderBy(desc(companyLoopProposals.createdAt))
            .limit(5),
          db
            .select({
              id: companyLearnings.id,
              sourceType: companyLearnings.sourceType,
              category: companyLearnings.category,
              summary: companyLearnings.summary,
              createdAt: companyLearnings.createdAt,
            })
            .from(companyLearnings)
            .where(eq(companyLearnings.companyId, companyId))
            .orderBy(desc(companyLearnings.createdAt))
            .limit(5),
          db
            .select({ count: sql<number>`count(*)` })
            .from(budgetPolicies)
            .where(and(eq(budgetPolicies.companyId, companyId), eq(budgetPolicies.isActive, true)))
            .then((rows) => Number(rows[0]?.count ?? 0)),
        ]);

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);
      const throughputOptimizer = loopRows.find((loop) => loop.kind === "throughput_optimizer") ?? null;
      const mission = company.description ?? missionGoal?.description ?? missionGoal?.title ?? null;

      return {
        companyId,
        company: {
          id: company.id,
          name: company.name,
          mission,
          status: company.status,
          issuePrefix: company.issuePrefix,
        },
        org: {
          totalAgents: orgAgents.length,
          roots: orgAgents
            .filter((agent) => agent.reportsTo === null)
            .map(({ id, name, role, title, status }) => ({ id, name, role, title, status })),
          agents: orgAgents,
        },
        work: {
          open: taskCounts.open,
          blocked: taskCounts.blocked,
          stale: staleWork,
          highPriorityBacklog,
        },
        spend: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
          activeBudgetPolicies: activeBudgetPolicyRows,
        },
        loops: {
          active: loopRows.filter((loop) => loop.status === "active").length,
          throughputOptimizer: throughputOptimizer
            ? {
              id: throughputOptimizer.id,
              name: throughputOptimizer.name,
              status: throughputOptimizer.status,
              lastRunAt: throughputOptimizer.lastRunAt,
            }
            : null,
          latestRuns: latestLoopRuns,
        },
        proposals: {
          latest: latestProposals,
        },
        learnings: {
          latest: latestLearnings,
        },
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
      };
    },
  };
}
