import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import type { CompanyLoopListItem, CompanyLoopProposal, CompanyLoopRun, CompanyLoopRunDetail } from "@bedlam/shared";
import { Check, FilePlus2, MessageSquarePlus, Play, Plus, RefreshCcw, X } from "lucide-react";
import { companyLoopsApi } from "../api/companyLoops";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusTone: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  archived: "bg-muted text-muted-foreground",
  proposed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-muted text-muted-foreground",
  applied: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
  awaiting_approval: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ready_to_apply: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  evaluating: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className={cn("capitalize", statusTone[value] ?? "bg-muted text-muted-foreground")}>
      {formatLabel(value)}
    </Badge>
  );
}

function riskClass(value: string) {
  if (value === "high") return "bg-destructive/15 text-destructive";
  if (value === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
}

function payloadIssueId(proposal: CompanyLoopProposal) {
  const issueId = proposal.payloadJson.issueId;
  return typeof issueId === "string" ? issueId : null;
}

export function CompanyLoops() {
  const { companyId: routeCompanyId } = useParams<{ companyId?: string }>();
  const { selectedCompanyId } = useCompany();
  const companyId = routeCompanyId ?? selectedCompanyId ?? null;
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "Throughput Optimizer",
    description: "",
    riskTier: "low",
    cadenceKind: "manual",
    intervalSec: "3600",
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Company Reflex Loops" }]);
  }, [setBreadcrumbs]);

  const loopsQuery = useQuery({
    queryKey: companyId ? queryKeys.companyLoops.list(companyId) : ["company-loops", "missing-company"],
    queryFn: () => companyLoopsApi.list(companyId!),
    enabled: !!companyId,
  });

  const loops = loopsQuery.data ?? [];

  useEffect(() => {
    if (!selectedLoopId && loops.length > 0) {
      setSelectedLoopId(loops[0].id);
    }
    if (selectedLoopId && loops.length > 0 && !loops.some((loop) => loop.id === selectedLoopId)) {
      setSelectedLoopId(loops[0].id);
    }
  }, [loops, selectedLoopId]);

  const selectedLoop = useMemo(
    () => loops.find((loop) => loop.id === selectedLoopId) ?? null,
    [loops, selectedLoopId],
  );

  const runsQuery = useQuery({
    queryKey: selectedLoopId ? queryKeys.companyLoops.runs(selectedLoopId) : ["company-loops", "runs", "none"],
    queryFn: () => companyLoopsApi.listRuns(selectedLoopId!),
    enabled: !!selectedLoopId,
  });

  const runs = runsQuery.data ?? [];

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
    if (selectedRunId && runs.length > 0 && !runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const runDetailQuery = useQuery({
    queryKey: selectedRunId ? queryKeys.companyLoops.runDetail(selectedRunId) : ["company-loops", "run-detail", "none"],
    queryFn: () => companyLoopsApi.getRun(selectedRunId!),
    enabled: !!selectedRunId,
  });

  const invalidateLoopData = async (loopId?: string | null, runId?: string | null) => {
    if (companyId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.list(companyId) });
    }
    if (loopId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.runs(loopId) });
    }
    if (runId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.runDetail(runId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyLoops.proposals(runId) });
    }
  };

  const createLoop = useMutation({
    mutationFn: () =>
      companyLoopsApi.create(companyId!, {
        name: draft.name,
        kind: "throughput_optimizer",
        description: draft.description.trim() || null,
        riskTier: draft.riskTier,
        cadenceKind: draft.cadenceKind,
        intervalSec: draft.cadenceKind === "interval" ? Number(draft.intervalSec) : null,
        configJson: {
          staleIssueAgeHours: 24,
          maxHighPriorityOpenIssuesPerAgent: 3,
        },
      }),
    onSuccess: async (loop) => {
      setSelectedLoopId(loop.id);
      await invalidateLoopData(loop.id);
      pushToast({ title: "Loop created", body: "Company Reflex Loop is ready to run.", tone: "success" });
    },
    onError: (error) => {
      pushToast({
        title: "Failed to create loop",
        body: error instanceof Error ? error.message : "Bedlam could not create the loop.",
        tone: "error",
      });
    },
  });

  const runLoop = useMutation({
    mutationFn: (loopId: string) => companyLoopsApi.run(loopId),
    onSuccess: async (run) => {
      setSelectedRunId(run.id);
      await invalidateLoopData(run.loopId, run.id);
      pushToast({ title: "Loop run complete", body: run.summary ?? "Run recorded.", tone: "success" });
    },
    onError: (error) => {
      pushToast({
        title: "Loop run failed",
        body: error instanceof Error ? error.message : "Bedlam could not run the loop.",
        tone: "error",
      });
    },
  });

  const proposalAction = useMutation({
    mutationFn: async ({ proposal, action }: { proposal: CompanyLoopProposal; action: "approve" | "reject" | "apply" }) => {
      if (action === "approve") return companyLoopsApi.approveProposal(proposal.id);
      if (action === "reject") return companyLoopsApi.rejectProposal(proposal.id);
      return companyLoopsApi.applyProposal(proposal.id);
    },
    onSuccess: async (_, variables) => {
      await invalidateLoopData(selectedLoopId, variables.proposal.loopRunId);
    },
    onError: (error) => {
      pushToast({
        title: "Proposal action failed",
        body: error instanceof Error ? error.message : "Bedlam could not update the proposal.",
        tone: "error",
      });
    },
  });

  if (!companyId) {
    return <EmptyState icon={RefreshCcw} message="Select a company to view loops." />;
  }

  if (loopsQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Company Reflex Loops
            <Badge variant="outline">Alpha</Badge>
          </h1>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_auto]">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Loop name"
          />
          <Textarea
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
            rows={1}
            className="min-h-9"
          />
          <Select
            value={draft.riskTier}
            onValueChange={(value) => setDraft((current) => ({ ...current, riskTier: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low risk</SelectItem>
              <SelectItem value="medium">Medium risk</SelectItem>
              <SelectItem value="high">High risk</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={draft.cadenceKind}
            onValueChange={(value) => setDraft((current) => ({ ...current, cadenceKind: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Cadence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="interval">Interval</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => createLoop.mutate()} disabled={createLoop.isPending || !draft.name.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Loops</h2>
            <span className="text-xs text-muted-foreground">{loops.length}</span>
          </div>
          {loops.length === 0 ? (
            <EmptyState icon={RefreshCcw} message="No loops yet." />
          ) : (
            <div className="space-y-2">
              {loops.map((loop) => (
                <LoopRow
                  key={loop.id}
                  loop={loop}
                  selected={loop.id === selectedLoopId}
                  onSelect={() => {
                    setSelectedLoopId(loop.id);
                    setSelectedRunId(null);
                  }}
                  onRun={() => runLoop.mutate(loop.id)}
                  running={runLoop.isPending && runLoop.variables === loop.id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          {selectedLoop ? (
            <>
              <div className="flex flex-col gap-2 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{selectedLoop.name}</h2>
                    <StatusBadge value={selectedLoop.status} />
                    <Badge variant="secondary" className={riskClass(selectedLoop.riskTier)}>
                      {selectedLoop.riskTier} risk
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatLabel(selectedLoop.kind)} · {formatLabel(selectedLoop.cadenceKind)} · last run {formatDate(selectedLoop.lastRunAt)}
                  </p>
                </div>
                <Button onClick={() => runLoop.mutate(selectedLoop.id)} disabled={runLoop.isPending || selectedLoop.status !== "active"}>
                  <Play className="mr-2 h-4 w-4" />
                  Run
                </Button>
              </div>

              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Runs</h3>
                  {runsQuery.isLoading ? (
                    <PageSkeleton variant="list" />
                  ) : runs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No runs recorded.</div>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          className={cn(
                            "w-full border border-border px-3 py-2 text-left transition-colors hover:bg-accent/60",
                            run.id === selectedRunId ? "bg-accent" : "bg-background",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge value={run.status} />
                            <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                          </div>
                          {run.summary && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{run.summary}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <RunDetail
                  run={runs.find((candidate) => candidate.id === selectedRunId) ?? null}
                  detail={runDetailQuery.data ?? null}
                  loading={runDetailQuery.isLoading}
                  proposalActionPending={proposalAction.isPending ? proposalAction.variables?.proposal.id ?? null : null}
                  onProposalAction={(proposal, action) => proposalAction.mutate({ proposal, action })}
                />
              </div>
            </>
          ) : (
            <EmptyState icon={RefreshCcw} message="Select or create a loop." />
          )}
        </section>
      </div>
    </div>
  );
}

function LoopRow({
  loop,
  selected,
  running,
  onSelect,
  onRun,
}: {
  loop: CompanyLoopListItem;
  selected: boolean;
  running: boolean;
  onSelect: () => void;
  onRun: () => void;
}) {
  return (
    <div className={cn("border border-border bg-background", selected && "bg-accent")}>
      <button type="button" onClick={onSelect} className="w-full px-3 py-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{loop.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{formatLabel(loop.kind)}</div>
          </div>
          <StatusBadge value={loop.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className={riskClass(loop.riskTier)}>
            {loop.riskTier}
          </Badge>
          <span>{formatLabel(loop.cadenceKind)}</span>
          <span>last {formatDate(loop.lastRunAt)}</span>
        </div>
      </button>
      <div className="border-t border-border px-3 py-2">
        <Button size="sm" variant="outline" onClick={onRun} disabled={running || loop.status !== "active"} className="w-full">
          <Play className="mr-2 h-3.5 w-3.5" />
          Run now
        </Button>
      </div>
    </div>
  );
}

function RunDetail({
  run,
  detail,
  loading,
  proposalActionPending,
  onProposalAction,
}: {
  run: CompanyLoopRun | null;
  detail: CompanyLoopRunDetail | null;
  loading: boolean;
  proposalActionPending: string | null;
  onProposalAction: (proposal: CompanyLoopProposal, action: "approve" | "reject" | "apply") => void;
}) {
  if (!run) {
    return <EmptyState icon={RefreshCcw} message="Select a run." />;
  }

  if (loading) {
    return <PageSkeleton variant="detail" />;
  }

  if (!detail) {
    return <EmptyState icon={RefreshCcw} message="Run detail unavailable." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={detail.status} />
          <span className="text-sm text-muted-foreground">
            Started {formatDate(detail.startedAt)} · finished {formatDate(detail.finishedAt)}
          </span>
        </div>
        {detail.summary && <p className="text-sm text-muted-foreground">{detail.summary}</p>}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Observations</h3>
        {detail.observations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No observations.</div>
        ) : (
          <div className="divide-y divide-border border border-border">
            {detail.observations.map((observation) => (
              <div key={observation.id} className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{formatLabel(observation.kind)}</span>
                    <Badge variant="outline" className="capitalize">{observation.severity}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {observation.entityType} · {observation.entityId}
                  </div>
                </div>
                {observation.entityType === "issue" && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/issues/${observation.entityId}`}>Open issue</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Proposals</h3>
        {detail.proposals.length === 0 ? (
          <div className="text-sm text-muted-foreground">No proposals.</div>
        ) : (
          <div className="space-y-3">
            {detail.proposals.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                proposal={proposal}
                pending={proposalActionPending === proposal.id}
                onAction={(action) => onProposalAction(proposal, action)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProposalRow({
  proposal,
  pending,
  onAction,
}: {
  proposal: CompanyLoopProposal;
  pending: boolean;
  onAction: (action: "approve" | "reject" | "apply") => void;
}) {
  const issueId = payloadIssueId(proposal);
  const canApprove = proposal.status === "proposed" && proposal.requiresApproval;
  const canReject = proposal.status === "proposed" || proposal.status === "approved";
  const canApply = proposal.status === "approved" || (!proposal.requiresApproval && proposal.status === "proposed");

  return (
    <div className="border border-border bg-background p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {proposal.proposalType === "create_issue" ? (
              <FilePlus2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{proposal.title}</span>
            <StatusBadge value={proposal.status} />
            <Badge variant="secondary" className={riskClass(proposal.riskTier)}>
              {proposal.riskTier}
            </Badge>
          </div>
          {proposal.rationale && <p className="text-sm text-muted-foreground">{proposal.rationale}</p>}
          {issueId && (
            <Button asChild size="sm" variant="link" className="h-auto px-0">
              <Link to={`/issues/${issueId}`}>Open affected issue</Link>
            </Button>
          )}
          {proposal.error && <p className="text-sm text-destructive">{proposal.error}</p>}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {canApprove && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onAction("approve")}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onAction("reject")}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </Button>
          )}
          {canApply && (
            <Button size="sm" disabled={pending} onClick={() => onAction("apply")}>
              Apply
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
