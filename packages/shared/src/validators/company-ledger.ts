import { z } from "zod";
import { COMPANY_LEARNING_SOURCE_TYPES, PROPOSAL_OUTCOME_STATUSES } from "../constants.js";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const recordProposalOutcomeSchema = z.object({
  proposalId: z.string().uuid().optional().nullable(),
  outcomeStatus: z.enum(PROPOSAL_OUTCOME_STATUSES),
  summary: z.string().trim().min(1).max(4_000),
  evidenceJson: jsonObjectSchema.optional().default({}),
});

export type RecordProposalOutcome = z.infer<typeof recordProposalOutcomeSchema>;

export const recordCompanyLearningSchema = z.object({
  sourceType: z.enum(COMPANY_LEARNING_SOURCE_TYPES).optional().default("manual"),
  sourceId: z.string().trim().min(1).max(200).optional().nullable(),
  category: z.string().trim().min(1).max(120).optional().default("general"),
  summary: z.string().trim().min(1).max(4_000),
  evidenceJson: jsonObjectSchema.optional().default({}),
  createdByAgentId: z.string().uuid().optional().nullable(),
});

export type RecordCompanyLearning = z.infer<typeof recordCompanyLearningSchema>;
