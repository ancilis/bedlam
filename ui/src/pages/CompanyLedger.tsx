import { useEffect } from "react";
import { Link, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { CompanyLearning, ProposalOutcome } from "@bedlam/shared";
import { BookOpen, ClipboardCheck, Lightbulb, RefreshCcw } from "lucide-react";
import { companyLedgerApi } from "../api/companyLedger";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const outcomeTone: Record<string, string> = {
  observing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  regressed: "bg-destructive/15 text-destructive",
  rolled_back: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([, value]) => value !== null && value !== undefined).slice(0, 4);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No evidence attached.</p>;
  }

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{formatLabel(key)}</dt>
          <dd className="truncate text-xs text-foreground">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LearningRow({ learning }: { learning: CompanyLearning }) {
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">{formatLabel(learning.category)}</Badge>
          <span className="text-xs text-muted-foreground">{formatLabel(learning.sourceType)}</span>
        </div>
        <p className="text-sm">{learning.summary}</p>
        <EvidenceList evidence={learning.evidenceJson} />
      </div>
      <div className="text-xs text-muted-foreground md:text-right">{formatDate(learning.createdAt)}</div>
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: ProposalOutcome }) {
  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("capitalize", outcomeTone[outcome.outcomeStatus] ?? "bg-muted text-muted-foreground")}>
            {formatLabel(outcome.outcomeStatus)}
          </Badge>
          {outcome.proposalId && (
            <span className="font-mono text-xs text-muted-foreground">{outcome.proposalId.slice(0, 8)}</span>
          )}
        </div>
        <p className="text-sm">{outcome.summary}</p>
        <EvidenceList evidence={outcome.evidenceJson} />
      </div>
      <div className="text-xs text-muted-foreground md:text-right">{formatDate(outcome.createdAt)}</div>
    </div>
  );
}

export function CompanyLedger() {
  const { companyId: routeCompanyId } = useParams<{ companyId?: string }>();
  const { selectedCompanyId } = useCompany();
  const companyId = routeCompanyId ?? selectedCompanyId ?? null;
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Company Operating Ledger" }]);
  }, [setBreadcrumbs]);

  const ledgerQuery = useQuery({
    queryKey: companyId ? queryKeys.companyLedger.list(companyId) : ["company-ledger", "missing-company"],
    queryFn: () => companyLedgerApi.list(companyId!),
    enabled: !!companyId,
  });

  if (!companyId) {
    return <EmptyState icon={BookOpen} message="Bedlam runs an AI-native company through governed loops." />;
  }

  if (ledgerQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const learnings = ledgerQuery.data?.companyLearnings ?? [];
  const outcomes = ledgerQuery.data?.proposalOutcomes ?? [];
  const hasEntries = learnings.length > 0 || outcomes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Company Operating Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Durable outcomes and learnings from governed loops.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/loops">Loops</Link>
          </Button>
        </div>
      </div>

      {!hasEntries && (
        <EmptyState icon={RefreshCcw} message="Bedlam runs an AI-native company through governed loops." />
      )}

      {hasEntries && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                Latest Learnings
              </h2>
              <span className="text-xs text-muted-foreground">{learnings.length}</span>
            </div>
            <div className="border border-border">
              {learnings.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No learnings recorded.</p>
              ) : (
                learnings.map((learning) => <LearningRow key={learning.id} learning={learning} />)
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" />
                Proposal Outcomes
              </h2>
              <span className="text-xs text-muted-foreground">{outcomes.length}</span>
            </div>
            <div className="border border-border">
              {outcomes.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">No proposal outcomes recorded.</p>
              ) : (
                outcomes.map((outcome) => <OutcomeRow key={outcome.id} outcome={outcome} />)
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
