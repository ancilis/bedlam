export interface DashboardSummary {
  companyId: string;
  company: {
    id: string;
    name: string;
    mission: string | null;
    status: string;
    issuePrefix: string;
  };
  org: {
    totalAgents: number;
    roots: Array<{
      id: string;
      name: string;
      role: string;
      title: string | null;
      status: string;
    }>;
    agents: Array<{
      id: string;
      name: string;
      role: string;
      title: string | null;
      status: string;
      reportsTo: string | null;
    }>;
  };
  work: {
    open: number;
    blocked: number;
    stale: Array<{
      id: string;
      identifier: string | null;
      title: string;
      status: string;
      priority: string;
      assigneeAgentId: string | null;
      updatedAt: Date;
    }>;
    highPriorityBacklog: Array<{
      id: string;
      identifier: string | null;
      title: string;
      status: string;
      priority: string;
    }>;
  };
  spend: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
    activeBudgetPolicies: number;
  };
  loops: {
    active: number;
    throughputOptimizer: {
      id: string;
      name: string;
      status: string;
      lastRunAt: Date | null;
    } | null;
    latestRuns: Array<{
      id: string;
      loopId: string;
      status: string;
      summary: string | null;
      createdAt: Date;
    }>;
  };
  proposals: {
    latest: Array<{
      id: string;
      loopRunId: string;
      proposalType: string;
      status: string;
      title: string;
      riskTier: string;
      requiresApproval: boolean;
      createdAt: Date;
    }>;
  };
  learnings: {
    latest: Array<{
      id: string;
      sourceType: string;
      category: string;
      summary: string;
      createdAt: Date;
    }>;
  };
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
}
