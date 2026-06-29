import type {
  CompanyLoopCadenceKind,
  CompanyLoopKind,
  CompanyLoopObservationSeverity,
  CompanyLoopProposalStatus,
  CompanyLoopProposalType,
  CompanyLoopRunStatus,
  CompanyLoopStatus,
  RiskTier,
} from "../constants.js";

export interface CompanyLoop {
  id: string;
  companyId: string;
  name: string;
  kind: CompanyLoopKind;
  description: string | null;
  status: CompanyLoopStatus;
  cadenceKind: CompanyLoopCadenceKind;
  intervalSec: number | null;
  riskTier: RiskTier;
  ownerAgentId: string | null;
  evaluatorAgentId: string | null;
  configJson: Record<string, unknown>;
  lastRunAt: Date | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLoopRun {
  id: string;
  companyId: string;
  loopId: string;
  status: CompanyLoopRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  inputSnapshotJson: Record<string, unknown> | null;
  diagnosisJson: Record<string, unknown> | null;
  summary: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLoopObservation {
  id: string;
  companyId: string;
  loopRunId: string;
  kind: string;
  entityType: string;
  entityId: string;
  severity: CompanyLoopObservationSeverity;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLoopProposal {
  id: string;
  companyId: string;
  loopRunId: string;
  proposalType: CompanyLoopProposalType;
  status: CompanyLoopProposalStatus;
  riskTier: RiskTier;
  requiresApproval: boolean;
  title: string;
  rationale: string | null;
  payloadJson: Record<string, unknown>;
  approvalId: string | null;
  appliedAt: Date | null;
  appliedByUserId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLoopEvaluation {
  id: string;
  companyId: string;
  loopRunId: string;
  score: number | null;
  passed: boolean;
  checksJson: Array<Record<string, unknown>>;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLoopRunDetail extends CompanyLoopRun {
  loop: CompanyLoop | null;
  observations: CompanyLoopObservation[];
  proposals: CompanyLoopProposal[];
  evaluations: CompanyLoopEvaluation[];
}

export interface CompanyLoopListItem extends CompanyLoop {
  lastRun: CompanyLoopRun | null;
}
