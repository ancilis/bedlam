import type { CompanyLearningSourceType, ProposalOutcomeStatus } from "../constants.js";

export interface ProposalOutcome {
  id: string;
  companyId: string;
  proposalId: string | null;
  outcomeStatus: ProposalOutcomeStatus;
  summary: string;
  evidenceJson: Record<string, unknown>;
  recordedByUserId: string | null;
  recordedByAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLearning {
  id: string;
  companyId: string;
  sourceType: CompanyLearningSourceType;
  sourceId: string | null;
  category: string;
  summary: string;
  evidenceJson: Record<string, unknown>;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyLedger {
  companyId: string;
  proposalOutcomes: ProposalOutcome[];
  companyLearnings: CompanyLearning[];
}
