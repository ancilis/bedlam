import { z } from "zod";
import {
  COMPANY_LOOP_CADENCE_KINDS,
  COMPANY_LOOP_KINDS,
  COMPANY_LOOP_PROPOSAL_STATUSES,
  COMPANY_LOOP_PROPOSAL_TYPES,
  COMPANY_LOOP_STATUSES,
  ISSUE_PRIORITIES,
  RISK_TIERS,
} from "../constants.js";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const createCompanyLoopSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(COMPANY_LOOP_KINDS).default("throughput_optimizer"),
  description: z.string().trim().max(2_000).optional().nullable(),
  status: z.enum(COMPANY_LOOP_STATUSES).optional().default("active"),
  cadenceKind: z.enum(COMPANY_LOOP_CADENCE_KINDS).optional().default("manual"),
  intervalSec: z.number().int().min(60).max(31_536_000).optional().nullable(),
  riskTier: z.enum(RISK_TIERS).optional().default("low"),
  ownerAgentId: z.string().uuid().optional().nullable(),
  evaluatorAgentId: z.string().uuid().optional().nullable(),
  configJson: jsonObjectSchema.optional().default({}),
});

export type CreateCompanyLoop = z.infer<typeof createCompanyLoopSchema>;

export const updateCompanyLoopSchema = createCompanyLoopSchema.partial().extend({
  status: z.enum(COMPANY_LOOP_STATUSES).optional(),
});

export type UpdateCompanyLoop = z.infer<typeof updateCompanyLoopSchema>;

export const runCompanyLoopSchema = z.object({});
export type RunCompanyLoop = z.infer<typeof runCompanyLoopSchema>;

export const addIssueCommentProposalPayloadSchema = z.object({
  issueId: z.string().uuid(),
  body: z.string().trim().min(1).max(20_000),
});

export type AddIssueCommentProposalPayload = z.infer<typeof addIssueCommentProposalPayloadSchema>;

export const createIssueProposalPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(20_000).optional().nullable(),
  priority: z.enum(ISSUE_PRIORITIES).optional().default("medium"),
  projectId: z.string().uuid().optional().nullable(),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

export type CreateIssueProposalPayload = z.infer<typeof createIssueProposalPayloadSchema>;

export const companyLoopProposalPayloadSchema = z.discriminatedUnion("proposalType", [
  z.object({
    proposalType: z.literal("add_issue_comment"),
    payloadJson: addIssueCommentProposalPayloadSchema,
  }),
  z.object({
    proposalType: z.literal("create_issue"),
    payloadJson: createIssueProposalPayloadSchema,
  }),
]);

export type CompanyLoopProposalPayload = z.infer<typeof companyLoopProposalPayloadSchema>;

export const approveCompanyLoopProposalSchema = z.object({
  note: z.string().trim().max(2_000).optional().nullable(),
});

export type ApproveCompanyLoopProposal = z.infer<typeof approveCompanyLoopProposalSchema>;

export const rejectCompanyLoopProposalSchema = z.object({
  note: z.string().trim().max(2_000).optional().nullable(),
});

export type RejectCompanyLoopProposal = z.infer<typeof rejectCompanyLoopProposalSchema>;

export const applyCompanyLoopProposalSchema = z.object({});
export type ApplyCompanyLoopProposal = z.infer<typeof applyCompanyLoopProposalSchema>;

export const companyLoopProposalActionSchema = z.object({
  proposalType: z.enum(COMPANY_LOOP_PROPOSAL_TYPES).optional(),
  status: z.enum(COMPANY_LOOP_PROPOSAL_STATUSES).optional(),
});

export type CompanyLoopProposalAction = z.infer<typeof companyLoopProposalActionSchema>;
