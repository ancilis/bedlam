import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@bedlam/db";
import {
  agents,
  companies,
  companyLearnings,
  companyLoopProposals,
  proposalOutcomes,
} from "@bedlam/db";
import type { RecordCompanyLearning, RecordProposalOutcome } from "@bedlam/shared";
import { notFound, unprocessable } from "../errors.js";
import { logActivity } from "./activity-log.js";

type CompanyLedgerActor = {
  actorType: "user" | "agent" | "system";
  actorId: string;
  agentId?: string | null;
  userId?: string | null;
  runId?: string | null;
};

function actorUserId(actor?: CompanyLedgerActor) {
  if (!actor) return null;
  if (actor.userId) return actor.userId;
  return actor.actorType === "user" ? actor.actorId : null;
}

function actorAgentId(actor?: CompanyLedgerActor) {
  if (!actor) return null;
  if (actor.agentId) return actor.agentId;
  return actor.actorType === "agent" ? actor.actorId : null;
}

function safeActor(actor?: CompanyLedgerActor): CompanyLedgerActor {
  return actor ?? { actorType: "system", actorId: "system" };
}

async function assertCompanyExists(db: Db, companyId: string) {
  const company = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0] ?? null);
  if (!company) throw notFound("Company not found");
}

async function validateAgentInCompany(db: Db, companyId: string, agentId: string | null | undefined) {
  if (!agentId) return;
  const agent = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.id, agentId)))
    .then((rows) => rows[0] ?? null);
  if (!agent) throw unprocessable("Learning creator agent must belong to the ledger company");
}

async function validateProposalInCompany(db: Db, companyId: string, proposalId: string | null | undefined) {
  if (!proposalId) return;
  const proposal = await db
    .select({ id: companyLoopProposals.id })
    .from(companyLoopProposals)
    .where(and(eq(companyLoopProposals.companyId, companyId), eq(companyLoopProposals.id, proposalId)))
    .then((rows) => rows[0] ?? null);
  if (!proposal) throw unprocessable("Proposal must belong to the ledger company");
}

export function companyLedgerService(db: Db) {
  return {
    listCompanyLedger: async (companyId: string, limit = 25) => {
      await assertCompanyExists(db, companyId);
      const cappedLimit = Math.max(1, Math.min(limit, 200));
      const [outcomes, learnings] = await Promise.all([
        db
          .select()
          .from(proposalOutcomes)
          .where(eq(proposalOutcomes.companyId, companyId))
          .orderBy(desc(proposalOutcomes.createdAt), desc(proposalOutcomes.id))
          .limit(cappedLimit),
        db
          .select()
          .from(companyLearnings)
          .where(eq(companyLearnings.companyId, companyId))
          .orderBy(desc(companyLearnings.createdAt), desc(companyLearnings.id))
          .limit(cappedLimit),
      ]);
      return {
        companyId,
        proposalOutcomes: outcomes,
        companyLearnings: learnings,
      };
    },

    recordProposalOutcome: async (
      companyId: string,
      input: RecordProposalOutcome,
      actor?: CompanyLedgerActor,
    ) => {
      await assertCompanyExists(db, companyId);
      await validateProposalInCompany(db, companyId, input.proposalId);
      const now = new Date();
      const [created] = await db
        .insert(proposalOutcomes)
        .values({
          companyId,
          proposalId: input.proposalId ?? null,
          outcomeStatus: input.outcomeStatus,
          summary: input.summary,
          evidenceJson: input.evidenceJson ?? {},
          recordedByUserId: actorUserId(actor),
          recordedByAgentId: actorAgentId(actor),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const logActor = safeActor(actor);
      await logActivity(db, {
        companyId,
        actorType: logActor.actorType,
        actorId: logActor.actorId,
        agentId: actorAgentId(logActor),
        runId: logActor.runId ?? null,
        action: "company_ledger.proposal_outcome_recorded",
        entityType: "proposal_outcome",
        entityId: created.id,
        details: {
          proposalId: created.proposalId,
          outcomeStatus: created.outcomeStatus,
          summary: created.summary,
        },
      });
      return created;
    },

    recordLearning: async (
      companyId: string,
      input: RecordCompanyLearning,
      actor?: CompanyLedgerActor,
    ) => {
      await assertCompanyExists(db, companyId);
      await validateAgentInCompany(db, companyId, input.createdByAgentId);
      const now = new Date();
      const [created] = await db
        .insert(companyLearnings)
        .values({
          companyId,
          sourceType: input.sourceType ?? "manual",
          sourceId: input.sourceId ?? null,
          category: input.category ?? "general",
          summary: input.summary,
          evidenceJson: input.evidenceJson ?? {},
          createdByUserId: actorUserId(actor),
          createdByAgentId: input.createdByAgentId ?? actorAgentId(actor),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const logActor = safeActor(actor);
      await logActivity(db, {
        companyId,
        actorType: logActor.actorType,
        actorId: logActor.actorId,
        agentId: actorAgentId(logActor),
        runId: logActor.runId ?? null,
        action: "company_ledger.learning_recorded",
        entityType: "company_learning",
        entityId: created.id,
        details: {
          sourceType: created.sourceType,
          sourceId: created.sourceId,
          category: created.category,
          summary: created.summary,
        },
      });
      return created;
    },
  };
}
