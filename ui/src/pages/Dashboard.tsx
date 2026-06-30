import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { companyLoopsApi } from "../api/companyLoops";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";

import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CircleDot,
  DollarSign,
  GitPullRequest,
  LayoutDashboard,
  Lightbulb,
  Network,
  PauseCircle,
  Play,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, DashboardSummary, Issue } from "@bedlam/shared";
import { PluginSlotOutlet } from "@/plugins/slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

const statusTone: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  proposed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-muted text-muted-foreground",
  applied: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
  succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function StatusPill({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", statusTone[value] ?? "bg-muted text-muted-foreground")}>
      {formatLabel(value)}
    </Badge>
  );
}

function DashboardPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </section>
  );
}

function DashboardIssueLink({
  issue,
}: {
  issue: {
    id: string;
    identifier: string | null;
    title: string;
    status: string;
    priority: string;
    updatedAt?: Date | string;
  };
}) {
  return (
    <Link
      to={`/issues/${issue.identifier ?? issue.id}`}
      className="grid gap-1 text-sm no-underline text-inherit hover:text-foreground"
    >
      <span className="line-clamp-2">{issue.title}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusIcon status={issue.status} />
        <span className="font-mono">{issue.identifier ?? issue.id.slice(0, 8)}</span>
        <span>{formatLabel(issue.priority)}</span>
        {issue.updatedAt && <span>{timeAgo(issue.updatedAt)}</span>}
      </span>
    </Link>
  );
}

function CommandCenterSection({
  data,
  throughputRunning,
  onRunThroughput,
}: {
  data: DashboardSummary;
  throughputRunning: boolean;
  onRunThroughput: () => void;
}) {
  const throughputLoop = data.loops.throughputOptimizer;
  const staleWork = data.work.stale.slice(0, 4);
  const highPriorityBacklog = data.work.highPriorityBacklog.slice(0, 3);
  const latestRuns = data.loops.latestRuns.slice(0, 3);
  const latestProposals = data.proposals.latest.slice(0, 3);
  const latestLearnings = data.learnings.latest.slice(0, 3);
  const emptyOperatingSignals = !throughputLoop && latestRuns.length === 0 && latestProposals.length === 0 && latestLearnings.length === 0;
  const mission = data.company.mission ?? "Bedlam runs an AI-native company through governed loops.";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Command Center</p>
          <h2 className="truncate text-2xl font-semibold tracking-tight">{data.company.name}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{mission}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {throughputLoop && (
            <Button
              size="sm"
              onClick={onRunThroughput}
              disabled={throughputRunning || throughputLoop.status !== "active"}
            >
              <Play className="mr-2 h-4 w-4" />
              Run Throughput Optimizer
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/loops">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Loops
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/ledger">
              <BookOpen className="mr-2 h-4 w-4" />
              Ledger
            </Link>
          </Button>
        </div>
      </div>

      {emptyOperatingSignals && (
        <div className="border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Bedlam runs an AI-native company through governed loops.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="h-4 w-4" />
            Mission
          </div>
          <p className="mt-2 line-clamp-3 text-sm">{mission}</p>
        </div>
        <div className="border border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Network className="h-4 w-4" />
            Org
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.org.totalAgents}</p>
          <p className="text-xs text-muted-foreground">
            {data.org.roots.map((agent) => agent.name).join(", ") || "No leadership agents"}
          </p>
        </div>
        <div className="border border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CircleDot className="h-4 w-4" />
            Open Work
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{data.work.open}</p>
          <p className="text-xs text-muted-foreground">
            {data.work.blocked} blocked · {data.work.stale.length} stale · {data.work.highPriorityBacklog.length} high priority
          </p>
        </div>
        <div className="border border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Spend
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCents(data.spend.monthSpendCents)}</p>
          <p className="text-xs text-muted-foreground">
            {data.spend.monthBudgetCents > 0
              ? `${data.spend.monthUtilizationPercent}% of ${formatCents(data.spend.monthBudgetCents)}`
              : "No monthly cap"} · {data.spend.activeBudgetPolicies} policies
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel icon={AlertTriangle} title="Blocked and Stale Work">
          {staleWork.length === 0 && highPriorityBacklog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked, stale, or high-priority backlog work.</p>
          ) : (
            <>
              {staleWork.map((issue) => (
                <DashboardIssueLink key={`stale-${issue.id}`} issue={issue} />
              ))}
              {highPriorityBacklog.map((issue) => (
                <DashboardIssueLink key={`backlog-${issue.id}`} issue={{ ...issue, updatedAt: undefined }} />
              ))}
            </>
          )}
        </DashboardPanel>

        <DashboardPanel icon={RefreshCcw} title="Active Loops">
          {throughputLoop ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Link to="/loops" className="truncate text-sm font-medium text-foreground no-underline">
                  {throughputLoop.name}
                </Link>
                <StatusPill value={throughputLoop.status} />
              </div>
              <p className="text-xs text-muted-foreground">Last run {formatDate(throughputLoop.lastRunAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active throughput optimizer loop.</p>
          )}
          <div className="space-y-2">
            {latestRuns.map((run) => (
              <div key={run.id} className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill value={run.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                </div>
                {run.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{run.summary}</p>}
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel icon={BookOpen} title="Ledger Signals">
          {latestProposals.length === 0 && latestLearnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proposals or learnings recorded.</p>
          ) : (
            <>
              {latestProposals.map((proposal) => (
                <div key={proposal.id} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="line-clamp-1">{proposal.title}</span>
                    <StatusPill value={proposal.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatLabel(proposal.proposalType)} · {proposal.riskTier} risk
                  </p>
                </div>
              ))}
              {latestLearnings.map((learning) => (
                <div key={learning.id} className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="line-clamp-1">{learning.summary}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatLabel(learning.category)} · {formatDate(learning.createdAt)}
                  </p>
                </div>
              ))}
            </>
          )}
        </DashboardPanel>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const runThroughputLoop = useMutation({
    mutationFn: (loopId: string) => companyLoopsApi.run(loopId),
    onSuccess: async (run) => {
      if (selectedCompanyId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.list(selectedCompanyId) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.companyLedger.list(selectedCompanyId) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.runs(run.loopId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.runDetail(run.id) });
      pushToast({ title: "Throughput optimizer ran", body: run.summary ?? "Loop run recorded.", tone: "success" });
    },
    onError: (mutationError) => {
      pushToast({
        title: "Loop run failed",
        body: mutationError instanceof Error ? mutationError.message : "Bedlam could not run the throughput optimizer.",
        tone: "error",
      });
    },
  });

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Bedlam. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {data && (
        <>
          {data.budgets.activeIncidents > 0 ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused · {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <CommandCenterSection
            data={data}
            throughputRunning={runThroughputLoop.isPending}
            onRunThroughput={() => {
              if (data.loops.throughputOptimizer) {
                runThroughputLoop.mutate(data.loops.throughputOptimizer.id);
              }
            }}
          />

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Run Activity" subtitle="Last 14 days">
              <RunActivityChart runs={runs ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Priority" subtitle="Last 14 days">
              <PriorityChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Status" subtitle="Last 14 days">
              <IssueStatusChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Success Rate" subtitle="Last 14 days">
              <SuccessRateChart runs={runs ?? []} />
            </ChartCard>
          </div>

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Tasks */}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Status icon - left column on mobile */}
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex"><StatusIcon status={issue.status} /></span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name
                                ? <span className="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
